import { db } from "./config";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";

// Required Firestore composite indexes:
// 1. visibility (ASC) + updatedAt (DESC) — for getPublicTemplates
// 2. visibility (ASC) + ownerId (ASC) + updatedAt (DESC) — for getPrivateTemplates
// 3. visibility (ASC) + gameType (ASC) + updatedAt (DESC) — for filtered public
// 4. visibility (ASC) + ownerId (ASC) + gameType (ASC) + updatedAt (DESC) — for filtered private
// Create all at: Firebase Console → Firestore → Indexes

// IMPORTANT: Requires Firestore composite index on questionSets:
// Fields: gameType (ASC) + updatedAt (DESC)
// Create at: Firebase Console → Firestore → Indexes → Add Index
// Collection: questionSets, Fields: gameType Ascending, updatedAt Descending

export const createQuestionSet = async (data, teacherId = null) => {
  if (!db) throw new Error("Firebase not configured");
  const ref = await addDoc(collection(db, "questionSets"), {
    ...data,
    visibility: teacherId ? "private" : (data.visibility || "public"),
    ownerId: teacherId || data.ownerId || null,
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

// Get public templates (available to everyone)
export const getPublicTemplates = async (gameType = null) => {
  if (!db) return [];
  const constraints = [where("visibility", "==", "public")];
  if (gameType) constraints.push(where("gameType", "==", gameType));
  constraints.push(orderBy("updatedAt", "desc"));
  const q = query(collection(db, "questionSets"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get private templates for a specific teacher
export const getPrivateTemplates = async (teacherId, gameType = null) => {
  if (!db || !teacherId) return [];
  const constraints = [
    where("visibility", "==", "private"),
    where("ownerId", "==", teacherId)
  ];
  if (gameType) constraints.push(where("gameType", "==", gameType));
  constraints.push(orderBy("updatedAt", "desc"));
  const q = query(collection(db, "questionSets"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
