import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { isDemo } from "../utils/sessionMode";

// Returns { questions, loading, error }
// In demo mode: returns the fallback questions passed in
// In live mode: fetches questions from the session document in Firestore
export const useSessionQuestions = (sessionId, fallbackQuestions = []) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);

      // Demo mode — use fallback sample questions
      if (isDemo(sessionId)) {
        setQuestions(fallbackQuestions);
        setLoading(false);
        return;
      }

      // Live mode — fetch from Firestore session document
      if (!db) {
        setQuestions(fallbackQuestions);
        setLoading(false);
        return;
      }

      try {
        const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
        if (sessionSnap.exists()) {
          const sessionData = sessionSnap.data();
          const sessionQuestions = sessionData.questions;

          // Use session questions if they exist and have content
          // Otherwise fall back to sample questions
          if (sessionQuestions && sessionQuestions.length > 0) {
            setQuestions(sessionQuestions);
          } else {
            setQuestions(fallbackQuestions);
          }
        } else {
          setQuestions(fallbackQuestions);
        }
      } catch (err) {
        console.error("Failed to load session questions:", err);
        setError(err.message);
        setQuestions(fallbackQuestions); // fallback on error
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { questions, loading, error };
};
