import { useState, useEffect, useRef } from "react";

export const useAutoSave = (data, saveFn, delay = 2000) => {
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const timerRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setStatus("saving");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await saveFn(data);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setStatus("error");
      }
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [data]);

  return status;
};
