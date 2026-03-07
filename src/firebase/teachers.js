import { db } from "./config";
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, query, where, serverTimestamp
} from "firebase/firestore";

// Simple SHA-256 hash for PIN (not for sensitive data, just basic privacy)
const hashPin = async (pin) => {
  const msgBuffer = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

// Register a new teacher account
export const registerTeacher = async (name, pin) => {
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
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    templateCount: 0
  });

  return { teacherId: ref.id, name: name.trim() };
};

// Login existing teacher
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

  return { teacherId: teacherDoc.id, name: teacherData.name };
};

// Get teacher by ID
export const getTeacher = async (teacherId) => {
  if (!db) return null;
  const snap = await getDoc(doc(db, "teachers", teacherId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Store teacher session in localStorage
export const saveTeacherSession = (teacherId, name) => {
  localStorage.setItem("svip_teacher_id", teacherId);
  localStorage.setItem("svip_teacher_name", name);
};

// Get current teacher from localStorage
export const getCurrentTeacher = () => {
  const teacherId = localStorage.getItem("svip_teacher_id");
  const name = localStorage.getItem("svip_teacher_name");
  if (!teacherId || !name) return null;
  return { teacherId, name };
};

// Logout
export const logoutTeacher = () => {
  localStorage.removeItem("svip_teacher_id");
  localStorage.removeItem("svip_teacher_name");
};
