import { db } from "./config";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

export const checkFirebaseConnection = async () => {
  if (!db) return "failed"; // Not configured — skip check
  try {
    const testRef = doc(db, "_health", "ping");
    await setDoc(testRef, { timestamp: Date.now() });
    const snap = await getDoc(testRef);
    await deleteDoc(testRef);
    return snap.exists() ? "connected" : "failed";
  } catch (err) {
    console.warn("Firebase health check failed:", err.message);
    return "failed";
  }
};
