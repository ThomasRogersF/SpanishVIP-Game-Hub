import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Countdown timer hook.
 * @param {number} initialDuration - seconds to count down from
 * @param {Function} onTimeUp - called when timer reaches 0
 * @returns {{ timeRemaining, isRunning, start, pause, reset }}
 */
export const useTimer = (initialDuration, onTimeUp) => {
  const [timeRemaining, setTimeRemaining] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const onTimeUpRef = useRef(onTimeUp);

  // Keep the callback ref always up to date without re-creating the timer
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  });

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return; // already running
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          // Defer callback to avoid state update inside setState
          setTimeout(() => onTimeUpRef.current?.(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const reset = useCallback(
    (newDuration) => {
      clearTimer();
      setIsRunning(false);
      setTimeRemaining(newDuration ?? initialDuration);
    },
    [clearTimer, initialDuration]
  );

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return { timeRemaining, isRunning, start, pause, reset };
};
