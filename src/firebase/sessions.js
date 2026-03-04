import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { generatePin } from '../utils/generatePin';

/**
 * Create a new game session.
 * @param {string} gameType - e.g. 'multiple-choice'
 * @param {Array} questions - array of question objects
 * @param {string} teacherId - teacher's UID
 * @returns {{ sessionId: string, pin: string }}
 */
export const createSession = async (gameType, questions = [], teacherId = '') => {
  const pin = generatePin();
  const docRef = await addDoc(collection(db, 'sessions'), {
    gameType,
    questions,
    teacherId,
    pin,
    status: 'waiting', // waiting | active | finished
    createdAt: serverTimestamp(),
    players: {},
  });
  return { sessionId: docRef.id, pin };
};

/**
 * Join an existing session by PIN.
 * @param {string} pin - 6-digit PIN
 * @param {string} nickname - player's display name
 * @returns {{ sessionId: string, gameType: string }}
 */
export const joinSession = async (pin, nickname) => {
  const q = query(collection(db, 'sessions'), where('pin', '==', pin), where('status', '!=', 'finished'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('No active session found for that PIN.');
  }

  const sessionDoc = snapshot.docs[0];
  const sessionId = sessionDoc.id;
  const data = sessionDoc.data();

  await updateDoc(doc(db, 'sessions', sessionId), {
    [`players.${nickname}`]: { nickname, score: 0, joinedAt: serverTimestamp() },
  });

  return { sessionId, gameType: data.gameType };
};

/**
 * Update session status.
 * @param {string} sessionId
 * @param {'waiting'|'active'|'finished'} status
 */
export const updateSessionStatus = async (sessionId, status) => {
  await updateDoc(doc(db, 'sessions', sessionId), { status });
};

/**
 * Get a session document by ID.
 * @param {string} sessionId
 * @returns {Object} session data
 */
export const getSession = async (sessionId) => {
  const snap = await getDoc(doc(db, 'sessions', sessionId));
  if (!snap.exists()) throw new Error('Session not found.');
  return { id: snap.id, ...snap.data() };
};
