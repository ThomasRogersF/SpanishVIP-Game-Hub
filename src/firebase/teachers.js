import { db } from "./config";
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from "firebase/firestore";

// Simple SHA-256 hash for PIN (not for sensitive data, just basic privacy)
const hashPin = async (pin) => {
  const msgBuffer = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

// Register a new teacher or student account
export const registerTeacher = async (name, pin, role = "teacher") => {
  if (!db) throw new Error("Firebase not configured");
  if (!name || name.trim().length < 2) throw new Error("Name must be at least 2 characters");
  if (!pin || pin.length < 4) throw new Error("PIN must be at least 4 digits");

  // Check if name already taken
  const q = query(collection(db, "teachers"), where("name", "==", name.trim()));
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error("That name is already taken. Choose a different name.");

  const pinHash = await hashPin(pin);

  const ref = await addDoc(collection(db, "teachers"), {
    name: name.trim(),
    pinHash,
    role,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    templateCount: 0,
    totalPoints: 0,
    gamesPlayed: 0,
    weeklyPoints: 0,
    weeklyGamesPlayed: 0,
    weeklyResetAt: serverTimestamp(),
    achievements: [],
  });

  return { teacherId: ref.id, name: name.trim(), role };
};

// Login existing teacher or student
export const loginTeacher = async (name, pin) => {
  if (!db) throw new Error("Firebase not configured");

  const q = query(collection(db, "teachers"), where("name", "==", name.trim()));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("No account found with that name. Check spelling or register.");

  const teacherDoc = snap.docs[0];
  const teacherData = teacherDoc.data();
  const pinHash = await hashPin(pin);

  if (pinHash !== teacherData.pinHash) throw new Error("Incorrect PIN. Please try again.");

  // Update last login
  await updateDoc(doc(db, "teachers", teacherDoc.id), {
    lastLoginAt: serverTimestamp()
  });

  return { teacherId: teacherDoc.id, name: teacherData.name, role: teacherData.role || "teacher" };
};

// Get teacher by ID
export const getTeacher = async (teacherId) => {
  if (!db) return null;
  const snap = await getDoc(doc(db, "teachers", teacherId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Store teacher session in localStorage
export const saveTeacherSession = (teacherId, name, role = "teacher") => {
  localStorage.setItem("svip_teacher_id", teacherId);
  localStorage.setItem("svip_teacher_name", name);
  localStorage.setItem("svip_teacher_role", role);
};

// Get current teacher from localStorage
export const getCurrentTeacher = () => {
  const teacherId = localStorage.getItem("svip_teacher_id");
  const name = localStorage.getItem("svip_teacher_name");
  const role = localStorage.getItem("svip_teacher_role") || "teacher";
  if (!teacherId || !name) return null;
  return { teacherId, name, role };
};

// Logout
export const logoutTeacher = () => {
  localStorage.removeItem("svip_teacher_id");
  localStorage.removeItem("svip_teacher_name");
  localStorage.removeItem("svip_teacher_role");
};

// Update student/teacher score after a game session
export const recordGameScore = async (teacherId, pointsEarned) => {
  if (!db || !teacherId || !pointsEarned) return;

  try {
    const teacherRef = doc(db, "teachers", teacherId);
    const snap = await getDoc(teacherRef);
    if (!snap.exists()) return;

    const data = snap.data();

    // Check if weekly stats need reset (older than 7 days)
    const weeklyResetAt = data.weeklyResetAt?.toMillis?.() || 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const needsWeeklyReset = weeklyResetAt < weekAgo;

    await updateDoc(teacherRef, {
      totalPoints: (data.totalPoints || 0) + pointsEarned,
      gamesPlayed: (data.gamesPlayed || 0) + 1,
      weeklyPoints: needsWeeklyReset ? pointsEarned : (data.weeklyPoints || 0) + pointsEarned,
      weeklyGamesPlayed: needsWeeklyReset ? 1 : (data.weeklyGamesPlayed || 0) + 1,
      weeklyResetAt: needsWeeklyReset ? serverTimestamp() : data.weeklyResetAt,
      lastActiveAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("recordGameScore error:", err);
  }
};

// Get global leaderboard (all-time or weekly top 20)
export const getGlobalLeaderboard = async (type = "allTime") => {
  if (!db) return [];

  try {
    const field = type === "weekly" ? "weeklyPoints" : "totalPoints";
    const q = query(
      collection(db, "teachers"),
      orderBy(field, "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, index) => ({
      rank: index + 1,
      id: d.id,
      name: d.data().name,
      totalPoints: d.data().totalPoints || 0,
      weeklyPoints: d.data().weeklyPoints || 0,
      gamesPlayed: d.data().gamesPlayed || 0,
      weeklyGamesPlayed: d.data().weeklyGamesPlayed || 0,
      role: d.data().role || "teacher",
      achievements: d.data().achievements || [],
    }));
  } catch (err) {
    console.error("getGlobalLeaderboard error:", err);
    return [];
  }
};

// Subscribe to global leaderboard in real-time
export const subscribeToGlobalLeaderboard = (type = "allTime", callback) => {
  if (!db) return () => {};

  const field = type === "weekly" ? "weeklyPoints" : "totalPoints";
  const q = query(
    collection(db, "teachers"),
    orderBy(field, "desc"),
    limit(20)
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d, index) => ({
      rank: index + 1,
      id: d.id,
      name: d.data().name,
      totalPoints: d.data().totalPoints || 0,
      weeklyPoints: d.data().weeklyPoints || 0,
      gamesPlayed: d.data().gamesPlayed || 0,
      weeklyGamesPlayed: d.data().weeklyGamesPlayed || 0,
      role: d.data().role || "teacher",
      achievements: d.data().achievements || [],
    }));
    callback(data);
  });
};

// Migrate teacher documents missing required fields
export const migrateTeacherDocuments = async () => {
  if (!db) return;
  const snap = await getDocs(collection(db, "teachers"));
  const updates = snap.docs
    .filter(d => d.data().totalPoints === undefined)
    .map(d => updateDoc(doc(db, "teachers", d.id), {
      totalPoints: 0,
      weeklyPoints: 0,
      gamesPlayed: 0,
      weeklyGamesPlayed: 0,
      weeklyResetAt: serverTimestamp(),
      role: d.data().role || "teacher",
    }));
  await Promise.all(updates);
  console.log(`Migrated ${updates.length} documents`);
};

// Required Firestore indexes for global leaderboard:
// 1. teachers collection: totalPoints DESC
// 2. teachers collection: weeklyPoints DESC
// These are single-field indexes — Firebase creates them automatically
// but if queries fail, manually create at Firebase Console → Firestore → Indexes
