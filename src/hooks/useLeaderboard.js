import { useState, useEffect } from 'react';
import { subscribeToLeaderboard } from '../firebase/leaderboard';

/**
 * Subscribe to live leaderboard for a session.
 * Returns demo data when sessionId is 'demo' or Firebase isn't configured.
 * @param {string} sessionId
 * @returns {{ players: Array, loading: boolean }}
 */
export const useLeaderboard = (sessionId) => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || sessionId === 'demo') {
      setLoading(false);
      return;
    }

    let unsubscribe;
    try {
      unsubscribe = subscribeToLeaderboard(sessionId, (data) => {
        setPlayers(data);
        setLoading(false);
      });
    } catch (err) {
      console.warn('Leaderboard subscription unavailable:', err.message);
      setLoading(false);
    }

    return () => {
      try {
        unsubscribe?.();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [sessionId]);

  return { players, loading };
};
