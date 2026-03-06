import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { doc, onSnapshot } from "firebase/firestore";
import { isDemo } from "../utils/sessionMode";

/**
 * Synchronized countdown hook.
 * Returns { countdown, isReady }
 *   countdown: number (5,4,3,2,1,0) — null while waiting
 *   isReady:   true when countdown hits 0 and game should start
 */
export const useSyncedCountdown = (sessionId) => {
  const [countdown, setCountdown] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // In demo mode, do a simple local 3-second countdown
    if (isDemo(sessionId)) {
      let count = 3;
      setCountdown(count);
      intervalRef.current = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(intervalRef.current);
          setCountdown(0);
          setIsReady(true);
        }
      }, 1000);
      return () => clearInterval(intervalRef.current);
    }

    // In live mode, subscribe to session startedAt timestamp
    if (!db) return;

    const unsubscribe = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status !== "active" || !data.startedAt) return;

      // Calculate how many seconds have passed since game started
      const startedAt = data.startedAt.toMillis
        ? data.startedAt.toMillis() // Firestore Timestamp
        : data.startedAt; // Plain number fallback

      const countdownSeconds = data.countdownSeconds || 5;
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const remaining = countdownSeconds - elapsed;

      if (remaining <= 0) {
        // Countdown already done — start immediately (late joiner)
        clearInterval(intervalRef.current);
        setCountdown(0);
        setIsReady(true);
        return;
      }

      // Start ticking from current remaining value
      setCountdown(remaining);
      clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        const nowTick = Date.now();
        const elapsedTick = Math.floor((nowTick - startedAt) / 1000);
        const remainingTick = countdownSeconds - elapsedTick;

        if (remainingTick <= 0) {
          clearInterval(intervalRef.current);
          setCountdown(0);
          setIsReady(true);
        } else {
          setCountdown(remainingTick);
        }
      }, 500); // Tick every 500ms for accuracy
    });

    return () => {
      unsubscribe();
      clearInterval(intervalRef.current);
    };
  }, [sessionId]);

  return { countdown, isReady };
};
