import { db } from "./config";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";

// IMPORTANT: Requires Firestore composite index on questionSets:
// Fields: gameType (ASC) + updatedAt (DESC)
// Create at: Firebase Console → Firestore → Indexes → Add Index
// Collection: questionSets, Fields: gameType Ascending, updatedAt Descending

export const createQuestionSet = async (data) => {
  if (!db) throw new Error("Firebase not configured");
  const ref = await addDoc(collection(db, "questionSets"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateQuestionSet = async (id, data) => {
  if (!db) throw new Error("Firebase not configured");
  await updateDoc(doc(db, "questionSets", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteQuestionSet = async (id) => {
  if (!db) throw new Error("Firebase not configured");
  await deleteDoc(doc(db, "questionSets", id));
};

export const getQuestionSets = async (gameType = null) => {
  if (!db) return [];
  const q = gameType
    ? query(collection(db, "questionSets"), where("gameType", "==", gameType), orderBy("updatedAt", "desc"))
    : query(collection(db, "questionSets"), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getQuestionSet = async (id) => {
  if (!db) return null;
  const snap = await getDoc(doc(db, "questionSets", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
