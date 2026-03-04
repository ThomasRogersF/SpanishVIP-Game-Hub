import { ref, set, onValue, off, get } from 'firebase/database';
import { rtdb } from './config';

/**
 * Subscribe to real-time leaderboard updates.
 * @param {string} sessionId
 * @param {Function} callback - receives sorted player array
 * @returns {Function} unsubscribe function
 */
export const subscribeToLeaderboard = (sessionId, callback) => {
  const leaderboardRef = ref(rtdb, `leaderboards/${sessionId}`);

  const handler = (snapshot) => {
    const data = snapshot.val() || {};
    const players = Object.values(data)
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({ ...player, rank: index + 1 }));
    callback(players);
  };

  onValue(leaderboardRef, handler);

  return () => off(leaderboardRef, 'value', handler);
};

/**
 * Update a player's score in the leaderboard.
 * @param {string} sessionId
 * @param {string} nickname
 * @param {number} score
 */
export const updatePlayerScore = async (sessionId, nickname, score) => {
  const playerRef = ref(rtdb, `leaderboards/${sessionId}/${nickname}`);
  await set(playerRef, { nickname, score, updatedAt: Date.now() });
};

/**
 * Get leaderboard snapshot (one-time read).
 * @param {string} sessionId
 * @returns {Array} sorted player array
 */
export const getLeaderboard = async (sessionId) => {
  const snap = await get(ref(rtdb, `leaderboards/${sessionId}`));
  const data = snap.val() || {};
  return Object.values(data)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
};
