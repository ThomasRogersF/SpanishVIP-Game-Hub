import { db, rtdb } from "./config";
import {
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  query, where, getDocs, serverTimestamp
} from "firebase/firestore";
import { ref, set, get, update, onValue, off } from "firebase/database";
import { generatePin } from "../utils/generatePin";

// Create a new game session in Firestore
export const createSession = async (gameType, questions = [], teacherId = "teacher") => {
  if (!db) throw new Error("Firebase not configured");

  const pin = generatePin();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const sessionData = {
    pin,
    gameType,
    questions,
    teacherId,
    status: "waiting", // waiting | active | finished
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    players: {},
    currentQuestion: 0,
    settings: {
      showLeaderboard: true,
      allowLateJoin: true,
    }
  };

  await setDoc(doc(db, "sessions", sessionId), sessionData);

  // Also write to Realtime DB for fast lookups
  if (rtdb) {
    await set(ref(rtdb, `sessions/${sessionId}`), {
      pin,
      gameType,
      status: "waiting",
      createdAt: Date.now(),
    });
  }

  return { sessionId, pin };
};

// Join a session by PIN — returns sessionId if found
export const joinSession = async (pin, nickname) => {
  if (!db) throw new Error("Firebase not configured");

  // Query Firestore for session with this PIN that is waiting or active
  const q = query(
    collection(db, "sessions"),
    where("pin", "==", pin.toString().trim())
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("PIN not found. Check the PIN and try again.");
  }

  // Find a session that isn't finished
  const validSession = snap.docs.find(d => d.data().status !== "finished");

  if (!validSession) {
    throw new Error("This game has already ended. Ask your teacher for a new PIN.");
  }

  const sessionId = validSession.id;
  const sessionData = validSession.data();

  // Add player to session
  const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  await updateDoc(doc(db, "sessions", sessionId), {
    [`players.${nickname}`]: {
      nickname,
      playerId,
      joinedAt: serverTimestamp(),
      score: 0,
      status: "joined"
    }
  });

  // Store player info in localStorage
  localStorage.setItem("svip_nickname", nickname);
  localStorage.setItem("svip_session_id", sessionId);
  localStorage.setItem("svip_player_id", playerId);
  localStorage.setItem("svip_game_type", sessionData.gameType);

  return { sessionId, gameType: sessionData.gameType, pin };
};

// Get a session by ID
export const getSession = async (sessionId) => {
  if (!db) return null;
  const snap = await getDoc(doc(db, "sessions", sessionId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Update session status
export const updateSessionStatus = async (sessionId, status) => {
  if (!db) return;
  await updateDoc(doc(db, "sessions", sessionId), {
    status,
    updatedAt: serverTimestamp()
  });
  if (rtdb) {
    await update(ref(rtdb, `sessions/${sessionId}`), { status });
  }
};

// Subscribe to session changes (real-time)
export const subscribeToSession = (sessionId, callback) => {
  if (!rtdb) return () => {};
  const sessionRef = ref(rtdb, `sessions/${sessionId}`);
  onValue(sessionRef, (snap) => {
    callback(snap.val());
  });
  return () => off(sessionRef);
};

// Delete a session (cleanup)
export const deleteSession = async (sessionId) => {
  if (!db) return;
  await deleteDoc(doc(db, "sessions", sessionId));
  if (rtdb) {
    await set(ref(rtdb, `sessions/${sessionId}`), null);
  }
};
