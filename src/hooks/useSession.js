import { useState, useEffect } from 'react';
import { getSession } from '../firebase/sessions';

/**
 * Fetch and track a game session.
 * @param {string} sessionId
 * @returns {{ session: Object|null, loading: boolean, error: string|null }}
 */
export const useSession = (sessionId) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId || sessionId === 'demo') {
      setSession({ id: 'demo', gameType: 'multiple-choice', status: 'active', pin: '000000' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getSession(sessionId)
      .then((data) => {
        setSession(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId]);

  return { session, loading, error };
};
