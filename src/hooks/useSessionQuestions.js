import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { isDemo } from "../utils/sessionMode";

export const useSessionQuestions = (sessionId, fallbackQuestions = []) => {
  const [questions, setQuestions] = useState([]); // always start empty
  const [loading, setLoading] = useState(true);   // always start loading
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setQuestions(fallbackQuestions);
      setLoading(false);
      return;
    }

    const loadQuestions = async () => {
      setLoading(true);
      setError(null);

      // Demo mode — use fallback immediately
      if (isDemo(sessionId)) {
        setQuestions(fallbackQuestions);
        setLoading(false);
        return;
      }

      // Live mode — fetch from Firestore
      if (!db) {
        setQuestions(fallbackQuestions);
        setLoading(false);
        return;
      }

      try {
        const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
        if (sessionSnap.exists()) {
          const data = sessionSnap.data();
          const sessionQuestions = data.questions;
          if (Array.isArray(sessionQuestions) && sessionQuestions.length > 0) {
            setQuestions(sessionQuestions);
          } else {
            // Session exists but has no questions — use fallback
            console.warn("Session has no questions, using sample questions");
            setQuestions(fallbackQuestions);
          }
        } else {
          console.warn("Session document not found, using sample questions");
          setQuestions(fallbackQuestions);
        }
      } catch (err) {
        console.error("useSessionQuestions error:", err);
        setError(err.message);
        setQuestions(fallbackQuestions);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { questions, loading, error };
};
