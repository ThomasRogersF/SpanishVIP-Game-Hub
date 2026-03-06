import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, onValue, off, runTransaction } from 'firebase/database';
import { useTimer } from '../../../hooks/useTimer';
import { updatePlayerScore } from '../../../firebase/leaderboard';
import { rtdb, db } from '../../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import Leaderboard from '../../shared/Leaderboard';
import { isDemo as isDemoCheck } from '../../../utils/sessionMode';

// ── Static Data ───────────────────────────────────────────────────────────────

const questionPool = [
  // Tier 1 — Easy (0–40% escape progress)
  { id: 1, type: 'multiple-choice', tier: 1, question: "¿Cómo se dice 'hello'?", options: ['Hola', 'Adiós', 'Gracias', 'Por favor'], correct: 0, points: 300 },
  { id: 2, type: 'true-false', tier: 1, question: "'Buenas noches' means Good Evening.", isTrue: true, points: 300 },
  { id: 3, type: 'multiple-choice', tier: 1, question: "What is 'water' in Spanish?", options: ['Leche', 'Agua', 'Jugo', 'Café'], correct: 1, points: 300 },
  { id: 4, type: 'true-false', tier: 1, question: "'Gato' means dog in Spanish.", isTrue: false, points: 300 },
  { id: 5, type: 'multiple-choice', tier: 1, question: "How do you say 'thank you'?", options: ['Hola', 'Sí', 'Gracias', 'No'], correct: 2, points: 300 },
  // Tier 2 — Medium (40–75% escape progress)
  { id: 6, type: 'multiple-choice', tier: 2, question: "Which is correct: 'Yo ___ español'?", options: ['hablas', 'hablo', 'habla', 'hablan'], correct: 1, points: 500 },
  { id: 7, type: 'true-false', tier: 2, question: 'In Spanish, adjectives always come BEFORE the noun.', isTrue: false, points: 500 },
  { id: 8, type: 'multiple-choice', tier: 2, question: '¿Cuál es la capital de México?', options: ['Guadalajara', 'Cancún', 'Ciudad de México', 'Monterrey'], correct: 2, points: 500 },
  { id: 9, type: 'true-false', tier: 2, question: "'Ser' and 'Estar' both mean 'to be' in English.", isTrue: true, points: 500 },
  { id: 10, type: 'multiple-choice', tier: 2, question: "Complete: 'Nosotros ___ en casa.'", options: ['estoy', 'está', 'estamos', 'están'], correct: 2, points: 500 },
  // Tier 3 — Hard (75–100% escape progress)
  { id: 11, type: 'multiple-choice', tier: 3, question: 'Which sentence uses the subjunctive correctly?', options: ['Quiero que tú vengas', 'Quiero que tú vienes', 'Quiero que tú venir', 'Quiero que tú vino'], correct: 0, points: 800 },
  { id: 12, type: 'true-false', tier: 3, question: "'Por' and 'Para' are completely interchangeable in Spanish.", isTrue: false, points: 800 },
  { id: 13, type: 'multiple-choice', tier: 3, question: "What is the preterite of 'ir' for 'él'?", options: ['iba', 'fue', 'va', 'irá'], correct: 1, points: 800 },
  { id: 14, type: 'true-false', tier: 3, question: "The word 'éxito' means 'exit' in Spanish.", isTrue: false, points: 800 },
  { id: 15, type: 'multiple-choice', tier: 3, question: 'Which is a false cognate (false friend)?', options: ['animal', 'hospital', 'embarazada', 'hotel'], correct: 2, points: 800 },
];

const flavorMessages = {
  correct: [
    '💨 The robot stumbles! Keep answering!',
    "🚀 Excellent! You're getting closer to the escape pod!",
    '⚡ ¡Muy bien! The robot loses ground!',
    '🌟 Perfect! The escape hatch is opening!',
  ],
  wrong: [
    "😱 The robot heard you! It's getting closer!",
    '🚨 Wrong answer — the robot lunges forward!',
    '⚠️ The robot is closing in! Focus!',
    '🔴 ¡Cuidado! The robot is gaining speed!',
  ],
  consecutive: [
    '🚨 DANGER! The robot is CHARGING! Answer correctly!',
    "💀 The robot is RIGHT BEHIND YOU! Don't panic!",
  ],
  milestones: {
    25: '🛸 First airlock cleared! 75% to go!',
    50: '⚡ Halfway there! The robot is slowing down!',
    75: '🔥 Almost free! One final push!',
    90: '🚀 THE ESCAPE POD IS IN SIGHT!',
  },
};

const NARRATIVE_LINES = [
  'You are trapped on Space Station Español...',
  'An angry robot has detected your presence...',
  'Answer questions correctly to escape!',
  'Wrong answers let the robot get closer...',
  'Work together — the class escapes as ONE!',
];

const OPTION_COLORS = [
  'bg-red-600 hover:bg-red-500 border-red-800',
  'bg-blue-600 hover:bg-blue-500 border-blue-800',
  'bg-yellow-500 hover:bg-yellow-400 border-yellow-700',
  'bg-green-600 hover:bg-green-500 border-green-800',
];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierTimeLimit(tier) {
  return tier === 1 ? 15 : tier === 2 ? 12 : 10;
}

function tierLabel(tier) {
  if (tier === 1) return 'TIER 1 🟢 EASY';
  if (tier === 2) return 'TIER 2 🟡 MEDIUM';
  return 'TIER 3 🔴 HARD';
}

function currentTierFor(ep) {
  return ep < 40 ? 1 : ep < 75 ? 2 : 3;
}

function pickFlavor(isCorrect, consecutive) {
  if (!isCorrect && consecutive >= 2) {
    const arr = flavorMessages.consecutive;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  const arr = isCorrect ? flavorMessages.correct : flavorMessages.wrong;
  return arr[Math.floor(Math.random() * arr.length)];
}

function proximityColor(rp) {
  if (rp > 60) return '#22c55e';
  if (rp > 30) return '#eab308';
  return '#ef4444';
}

const SPACE_BG = { background: 'radial-gradient(ellipse at bottom, #1a1a2e 0%, #0f0f0f 100%)' };
const CAUGHT_BG = { background: 'radial-gradient(ellipse at center, #3b0000 0%, #0f0f0f 100%)' };

// ── Component ─────────────────────────────────────────────────────────────────

const RobotRun = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const isDemo = isDemoCheck(sessionId);
  const nickname = localStorage.getItem('svip_nickname') || 'Player';
  const [sessionStatus, setSessionStatus] = useState('checking');

  useEffect(() => {
    if (isDemo) {
      setSessionStatus('active');
      return;
    }
    if (!db) { setSessionStatus('active'); return; }
    const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        const status = snap.data().status;
        setSessionStatus(status);
      } else {
        setSessionStatus('not_found');
      }
    });
    return unsubscribe;
  }, [sessionId, isDemo]);

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('intro');
  const [countdown, setCountdown] = useState(3);
  const phaseRef = useRef('intro');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Shared game state ──────────────────────────────────────────────────────
  const [escapeProgress, setEscapeProgress] = useState(0);
  const [robotProximity, setRobotProximity] = useState(100);
  const escapeProgressRef = useRef(0);
  const robotProximityRef = useRef(100);
  useEffect(() => { escapeProgressRef.current = escapeProgress; }, [escapeProgress]);
  useEffect(() => { robotProximityRef.current = robotProximity; }, [robotProximity]);

  // ── Questions ──────────────────────────────────────────────────────────────
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const answeredIdsRef = useRef(new Set());

  // ── Player stats ───────────────────────────────────────────────────────────
  const [playerScore, setPlayerScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const consecutiveWrongRef = useRef(0);
  const playerScoreRef = useRef(0);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [flavorText, setFlavorText] = useState('');
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [timerTransition, setTimerTransition] = useState('none');
  const [showMissionBtn, setShowMissionBtn] = useState(false);
  const [robotLunge, setRobotLunge] = useState(false);
  const [barShake, setBarShake] = useState(false);
  const [pointsPopupKey, setPointsPopupKey] = useState(0);
  const [lastPoints, setLastPoints] = useState(0);
  const [milestonesShown, setMilestonesShown] = useState(new Set());

  // ── Misc refs ──────────────────────────────────────────────────────────────
  const demoTimeoutsRef = useRef([]);
  const hasWrittenScoreRef = useRef(false);
  const handledRef = useRef(false);

  // ── Static generated data ──────────────────────────────────────────────────
  const stars = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() < 0.7 ? 1 : 2,
        opacity: 0.3 + Math.random() * 0.7,
      })),
    []
  );

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        color: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'][i % 5],
        delay: `${Math.random() * 2}s`,
        duration: `${1.5 + Math.random() * 1.5}s`,
        width: `${4 + Math.random() * 6}px`,
        height: `${8 + Math.random() * 10}px`,
      })),
    []
  );

  // ── Question selection ─────────────────────────────────────────────────────
  const getNextQuestion = (ep) => {
    const tier = currentTierFor(ep);
    let pool = questionPool.filter((q) => q.tier === tier && !answeredIdsRef.current.has(q.id));
    if (pool.length === 0) {
      // Reset answered for this tier so questions cycle
      const tierIds = new Set(questionPool.filter((q) => q.tier === tier).map((q) => q.id));
      answeredIdsRef.current = new Set([...answeredIdsRef.current].filter((id) => !tierIds.has(id)));
      pool = questionPool.filter((q) => q.tier === tier);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // ── Game reset ─────────────────────────────────────────────────────────────
  const resetGame = () => {
    setPhase('intro');
    setCountdown(3);
    setEscapeProgress(0);
    setRobotProximity(100);
    escapeProgressRef.current = 0;
    robotProximityRef.current = 100;
    setCurrentQuestion(null);
    setPlayerScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setConsecutiveWrong(0);
    consecutiveWrongRef.current = 0;
    playerScoreRef.current = 0;
    setFlavorText('');
    setFeedbackResult(null);
    setShowMissionBtn(false);
    setRobotLunge(false);
    setBarShake(false);
    setMilestonesShown(new Set());
    answeredIdsRef.current = new Set();
    hasWrittenScoreRef.current = false;
    handledRef.current = false;
    demoTimeoutsRef.current.forEach(clearTimeout);
    demoTimeoutsRef.current = [];
  };

  // ── Write final score to Firebase ─────────────────────────────────────────
  const writeScore = () => {
    if (isDemo || hasWrittenScoreRef.current) return;
    hasWrittenScoreRef.current = true;
    updatePlayerScore(sessionId, nickname, playerScoreRef.current).catch((err) =>
      console.warn('Score update skipped:', err.message)
    );
  };

  // ── Timer callback ref (avoids stale closure since useTimer is called before handleAnswer) ──
  const handleAnswerRef = useRef(null);

  const handleTimeUp = () => {
    if (phaseRef.current !== 'playing') return;
    handleAnswerRef.current?.(-1);
  };

  // ── Timer hook ─────────────────────────────────────────────────────────────
  const { timeRemaining, start, pause, reset } = useTimer(15, handleTimeUp);

  // ── Reset + start timer each new question ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !currentQuestion) return;
    const tl = tierTimeLimit(currentQuestion.tier);
    setTimerTransition('none');
    reset(tl);
    const t = setTimeout(() => {
      setTimerTransition('width 0.95s linear');
      start();
    }, 510);
    return () => clearTimeout(t);
  }, [phase, currentQuestion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown 3 → 2 → 1 → 🚀 → playing ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      const q = getNextQuestion(0);
      setCurrentQuestion(q);
      const t = setTimeout(() => setPhase('playing'), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Show "Begin Mission" button after narrative lines finish ──────────────
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setShowMissionBtn(true), NARRATIVE_LINES.length * 1200 + 600);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Feedback auto-advance (800 ms) ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'feedback') return;
    const t = setTimeout(() => {
      const ep = escapeProgressRef.current;
      const rp = robotProximityRef.current;
      if (ep >= 100) {
        writeScore();
        setPhase('escaped');
        return;
      }
      if (rp <= 0) {
        writeScore();
        setPhase('caught');
        return;
      }
      const next = getNextQuestion(ep);
      setCurrentQuestion(next);
      setFeedbackResult(null);
      handledRef.current = false;
      setPhase('playing');
    }, 800);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Firebase shared state subscription (non-demo, playing only) ───────────
  useEffect(() => {
    if (isDemo || phase !== 'playing') return;
    const stateRef = ref(rtdb, `robot-runs/${sessionId}/sharedState`);
    const handler = (snap) => {
      const d = snap.val();
      if (!d) return;
      const ep = d.escapeProgress ?? 0;
      const rp = d.robotProximity ?? 100;
      setEscapeProgress(ep);
      setRobotProximity(rp);
      escapeProgressRef.current = ep;
      robotProximityRef.current = rp;
    };
    onValue(stateRef, handler);
    return () => off(stateRef, 'value', handler);
  }, [sessionId, isDemo, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Demo simulation: staggered "classmates" answering ─────────────────────
  useEffect(() => {
    if (!isDemo || phase !== 'playing') return;
    demoTimeoutsRef.current.forEach(clearTimeout);
    demoTimeoutsRef.current = [];

    // 2–4 simulated classmates per question, 70% accuracy
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const delay = 2500 + Math.random() * 4000;
      const correct = Math.random() < 0.7;
      const t = setTimeout(() => {
        if (phaseRef.current !== 'playing') return;
        const newEp = Math.min(100, escapeProgressRef.current + (correct ? 10 : 0));
        const newRp = Math.max(0, robotProximityRef.current + (correct ? 5 : -15));
        escapeProgressRef.current = newEp;
        robotProximityRef.current = newRp;
        setEscapeProgress(newEp);
        setRobotProximity(newRp);
      }, delay);
      demoTimeoutsRef.current.push(t);
    }
    return () => demoTimeoutsRef.current.forEach(clearTimeout);
  }, [currentQuestion?.id, isDemo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Answer handler ─────────────────────────────────────────────────────────
  const handleAnswer = (chosenIndex) => {
    if (phaseRef.current !== 'playing' || handledRef.current) return;
    handledRef.current = true;
    pause();

    // Cancel pending demo timeouts so they don't fire after answer
    demoTimeoutsRef.current.forEach(clearTimeout);
    demoTimeoutsRef.current = [];

    const q = currentQuestion;
    if (!q) return;

    // Determine correctness
    let isCorrect = false;
    if (chosenIndex !== -1) {
      if (q.type === 'multiple-choice') {
        isCorrect = chosenIndex === q.correct;
      } else {
        // true-false: 0 = TRUE, 1 = FALSE
        isCorrect = chosenIndex === 0 ? q.isTrue : !q.isTrue;
      }
    }

    const prevEp = escapeProgressRef.current;
    const prevRp = robotProximityRef.current;
    const prevConsecutive = consecutiveWrongRef.current;

    let newEp = prevEp;
    let newRp = prevRp;
    let newConsecutive = prevConsecutive;
    let points = 0;

    if (isCorrect) {
      newEp = Math.min(100, prevEp + 10);
      newRp = Math.min(100, prevRp + 5);
      newConsecutive = 0;
      points = q.points;
    } else {
      newRp = prevRp - 15;
      newConsecutive += 1;
      if (newConsecutive >= 2) newRp -= 5;
      newRp = Math.max(0, newRp);
    }

    // Check milestones
    let flavor = '';
    const milestoneKeys = [90, 75, 50, 25];
    for (const m of milestoneKeys) {
      if (newEp >= m && prevEp < m && !milestonesShown.has(m)) {
        flavor = flavorMessages.milestones[m];
        setMilestonesShown((prev) => new Set([...prev, m]));
        break;
      }
    }
    if (!flavor) flavor = pickFlavor(isCorrect, newConsecutive);

    // Update shared state
    setEscapeProgress(newEp);
    setRobotProximity(newRp);
    escapeProgressRef.current = newEp;
    robotProximityRef.current = newRp;

    // Update player stats
    setConsecutiveWrong(newConsecutive);
    consecutiveWrongRef.current = newConsecutive;
    const newScore = playerScoreRef.current + points;
    setPlayerScore(newScore);
    playerScoreRef.current = newScore;
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      setLastPoints(points);
      setPointsPopupKey((k) => k + 1);
    } else {
      setWrongCount((c) => c + 1);
      setRobotLunge(true);
      setBarShake(true);
      setTimeout(() => {
        setRobotLunge(false);
        setBarShake(false);
      }, 600);
    }

    answeredIdsRef.current.add(q.id);
    setFlavorText(flavor);
    setFeedbackResult({ isCorrect, points });

    // Firebase atomic update (non-demo)
    if (!isDemo) {
      const robotDelta = isCorrect ? 5 : -15 - (newConsecutive >= 2 ? 5 : 0);
      runTransaction(ref(rtdb, `robot-runs/${sessionId}/sharedState`), (current) => ({
        escapeProgress: Math.min(100, (current?.escapeProgress ?? prevEp) + (isCorrect ? 10 : 0)),
        robotProximity: Math.max(0, (current?.robotProximity ?? prevRp) + robotDelta),
      })).catch((err) => console.warn('Shared state update skipped:', err.message));
    }

    setPhase('feedback');
  };

  // Keep handleAnswerRef fresh
  useEffect(() => { handleAnswerRef.current = handleAnswer; });

  // ── Derived display values ─────────────────────────────────────────────────
  const q = currentQuestion;
  const tier = q ? q.tier : 1;
  const timeLimit = tierTimeLimit(tier);
  const timerPct = timeLimit > 0 ? (timeRemaining / timeLimit) * 100 : 0;
  const timerBarColor = timerPct > 50 ? '#22c55e' : timerPct > 25 ? '#eab308' : '#ef4444';
  const proxColor = proximityColor(robotProximity);
  const totalAnswered = correctCount + wrongCount;
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  // ── Stars layer ────────────────────────────────────────────────────────────
  const StarsLayer = () =>
    stars.map((s) => (
      <div
        key={s.id}
        style={{
          position: 'absolute',
          top: s.top,
          left: s.left,
          width: s.size,
          height: s.size,
          borderRadius: '50%',
          backgroundColor: 'white',
          opacity: s.opacity,
          pointerEvents: 'none',
        }}
      />
    ));

  // ── Session waiting room (live) ────────────────────────────────
  if (sessionStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-2">Waiting for teacher...</h2>
          <p className="text-slate-400">The game will start soon</p>
          <div className="flex items-center gap-2 justify-center mt-4 text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm">Connected as {nickname}</span>
          </div>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'not_found') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-2">Session not found</h2>
          <p className="text-slate-400 mb-4">This game session doesn't exist or has ended.</p>
          <a href="/join" className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl">Back to Join</a>
        </div>
      </div>
    );
  }

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div
        style={{ ...SPACE_BG, minHeight: '100vh' }}
        className="relative overflow-hidden flex items-center justify-center p-4"
      >
        <StarsLayer />
        {/* Pulsing robot in corner */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: 20, right: 24, fontSize: 56, zIndex: 10 }}
        >
          🤖
        </motion.div>

        <div className="relative z-10 max-w-2xl w-full text-center">
          <motion.h1
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-5xl font-black text-white mb-8 drop-shadow-2xl"
          >
            🚀 Space Station Español
          </motion.h1>

          <div className="space-y-4 mb-10">
            {NARRATIVE_LINES.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 1.2, duration: 0.5 }}
                className="text-lg text-slate-300"
              >
                {line}
              </motion.p>
            ))}
          </div>

          <AnimatePresence>
            {showMissionBtn && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                onClick={() => setPhase('countdown')}
                className="bg-brand-red hover:bg-red-700 text-white font-black text-xl py-4 px-14 rounded-2xl transition-colors shadow-2xl"
              >
                Begin Mission 🚀
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── COUNTDOWN ──────────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div
        style={{ ...SPACE_BG, minHeight: '100vh' }}
        className="relative overflow-hidden flex items-center justify-center"
      >
        <StarsLayer />
        <AnimatePresence mode="wait">
          <motion.div
            key={countdown}
            initial={{ scale: 1.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="relative z-10 text-9xl font-black text-white select-none"
          >
            {countdown === 0 ? '🚀' : countdown}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── ESCAPED (WIN) ──────────────────────────────────────────────────────────
  if (phase === 'escaped') {
    return (
      <div
        style={{ ...SPACE_BG, minHeight: '100vh' }}
        className="relative overflow-hidden flex flex-col items-center justify-center p-4"
      >
        <style>{`
          @keyframes confettiFall {
            from { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
        `}</style>

        {/* Confetti */}
        {confettiPieces.map((c) => (
          <div
            key={c.id}
            style={{
              position: 'fixed',
              left: c.left,
              top: '-20px',
              width: c.width,
              height: c.height,
              backgroundColor: c.color,
              animation: `confettiFall ${c.duration} ${c.delay} ease-in forwards`,
              borderRadius: 2,
              zIndex: 50,
              pointerEvents: 'none',
            }}
          />
        ))}

        <StarsLayer />

        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
          className="relative z-10 bg-slate-800/90 backdrop-blur rounded-3xl p-8 text-center max-w-lg w-full border border-slate-700 shadow-2xl"
        >
          <div className="text-8xl mb-3">🎉</div>
          <h1 className="text-4xl font-black text-white mb-1">¡ESCAPASTE!</h1>
          <p className="text-xl text-brand-yellow mb-6">You escaped Space Station Español!</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-slate-700 rounded-xl p-3">
              <p className="text-2xl font-black text-white">{totalAnswered}</p>
              <p className="text-slate-400 text-xs mt-1">Questions</p>
            </div>
            <div className="bg-slate-700 rounded-xl p-3">
              <p className="text-2xl font-black text-brand-yellow">{accuracy}%</p>
              <p className="text-slate-400 text-xs mt-1">Accuracy</p>
            </div>
            <div className="bg-slate-700 rounded-xl p-3">
              <p className="text-2xl font-black text-green-400">{playerScore}</p>
              <p className="text-slate-400 text-xs mt-1">Your Score</p>
            </div>
          </div>

          <p className="text-slate-400 text-sm mb-5">
            The class answered{' '}
            <span className="text-white font-bold">{totalAnswered}</span> questions to escape! 🚀
          </p>

          <div className="mb-6">
            <Leaderboard sessionId={sessionId || 'demo'} />
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetGame}
              className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Back to Hub
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── CAUGHT (LOSE) ──────────────────────────────────────────────────────────
  if (phase === 'caught') {
    return (
      <div
        style={{ ...CAUGHT_BG, minHeight: '100vh' }}
        className="relative overflow-hidden flex flex-col items-center justify-center p-4"
      >
        <StarsLayer />

        <motion.div
          initial={{ scale: 0.3 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.9 }}
          className="text-[9rem] mb-2 relative z-10 leading-none"
        >
          🤖
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="relative z-10 text-center max-w-lg w-full"
        >
          <h1 className="text-4xl font-black text-white mb-1">The robot caught you!</h1>
          <p className="text-xl text-red-400 mb-6">😱 ¡Inténtalo de nuevo!</p>

          <div className="bg-slate-800/80 rounded-2xl p-6 mb-5 border border-red-900/50">
            <p className="text-slate-300 mb-4">
              You made it to{' '}
              <span className="text-brand-yellow font-black">{Math.round(escapeProgress)}%</span>{' '}
              escape! Next time you'll make it!
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-700 rounded-xl p-3">
                <p className="text-xl font-black text-white">{totalAnswered}</p>
                <p className="text-slate-400 text-xs mt-1">Questions</p>
              </div>
              <div className="bg-slate-700 rounded-xl p-3">
                <p className="text-xl font-black text-brand-yellow">{accuracy}%</p>
                <p className="text-slate-400 text-xs mt-1">Accuracy</p>
              </div>
              <div className="bg-slate-700 rounded-xl p-3">
                <p className="text-xl font-black text-green-400">{playerScore}</p>
                <p className="text-slate-400 text-xs mt-1">Score</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetGame}
              className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Back to Hub
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── PLAYING + FEEDBACK ─────────────────────────────────────────────────────
  return (
    <div
      style={{ ...SPACE_BG, minHeight: '100vh' }}
      className="relative overflow-hidden flex"
    >
      <StarsLayer />

      {/* Feedback screen flash */}
      <AnimatePresence>
        {feedbackResult && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.22 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: feedbackResult.isCorrect ? '#22c55e' : '#ef4444',
              zIndex: 40,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* +Points popup */}
      <AnimatePresence>
        {feedbackResult?.isCorrect && lastPoints > 0 && (
          <motion.div
            key={pointsPopupKey}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -140, opacity: 0, scale: 1.3 }}
            transition={{ duration: 1.3, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          >
            <p className="text-5xl font-black text-white drop-shadow-2xl">+{lastPoints} pts</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main game column */}
      <div className="relative z-10 flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">

        {/* ── Status Bars ───────────────────────────────────────────────── */}
        <div className="flex gap-3 mb-4">

          {/* Escape Progress */}
          <div className="flex-1 bg-slate-800/85 rounded-xl p-3 border border-slate-700">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-slate-300">🚀 Escape Progress</span>
              <span className="text-xs font-black text-green-400">{Math.round(escapeProgress)}%</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden relative">
              <div
                style={{
                  width: `${escapeProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #16a34a, #4ade80)',
                  borderRadius: 9999,
                  transition: 'width 0.6s ease',
                }}
              />
              {/* Milestone tick marks */}
              {[25, 50, 75].map((m) => (
                <div
                  key={m}
                  style={{
                    position: 'absolute',
                    left: `${m}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Robot Distance */}
          <motion.div
            animate={barShake ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 bg-slate-800/85 rounded-xl p-3 border border-slate-700"
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-slate-300">🤖 Robot Distance</span>
              <span className="text-xs font-black" style={{ color: proxColor }}>
                {Math.round(robotProximity)}%
              </span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                style={{
                  width: `${robotProximity}%`,
                  height: '100%',
                  backgroundColor: proxColor,
                  borderRadius: 9999,
                  transition: 'width 0.6s ease, background-color 0.3s',
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* ── Question Area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {q && (
              <motion.div
                key={q.id}
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -60, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="bg-slate-800/90 backdrop-blur rounded-2xl p-6 border border-slate-700 shadow-2xl"
              >
                {/* Tier badge + robot emoji */}
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-slate-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {tierLabel(tier)}
                  </span>
                  <motion.span
                    animate={robotLunge ? { x: [0, -40, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-3xl"
                  >
                    🤖
                  </motion.span>
                </div>

                {/* Question */}
                <p className="text-xl font-bold text-white mb-4 text-center leading-snug">
                  {q.question}
                </p>

                {/* Timer bar */}
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-5">
                  <div
                    style={{
                      width: `${timerPct}%`,
                      height: '100%',
                      backgroundColor: timerBarColor,
                      borderRadius: 9999,
                      transition: timerTransition,
                    }}
                  />
                </div>

                {/* Answer buttons */}
                {q.type === 'multiple-choice' ? (
                  <div className="grid grid-cols-2 gap-3">
                    {q.options.map((opt, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => handleAnswer(i)}
                        disabled={phase === 'feedback'}
                        className={`${OPTION_COLORS[i]} text-white font-bold py-3 px-4 rounded-xl border-b-4 transition-all active:border-b-0 active:translate-y-0.5 text-left disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <span className="font-black mr-2">{OPTION_LABELS[i]}.</span>
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 }}
                      onClick={() => handleAnswer(0)}
                      disabled={phase === 'feedback'}
                      className="bg-green-600 hover:bg-green-500 border-b-4 border-green-900 text-white font-black text-2xl py-6 rounded-xl transition-all active:border-b-0 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      ✓ TRUE
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      onClick={() => handleAnswer(1)}
                      disabled={phase === 'feedback'}
                      className="bg-red-600 hover:bg-red-500 border-b-4 border-red-900 text-white font-black text-2xl py-6 rounded-xl transition-all active:border-b-0 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      ✗ FALSE
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Stats Strip ───────────────────────────────────────────────── */}
        <div className="mt-4 bg-slate-800/80 rounded-xl p-3 border border-slate-700">
          <div className="flex items-center justify-between text-sm flex-wrap gap-1">
            <span>
              <span className="text-green-400 font-bold">✅ {correctCount} correct</span>
              <span className="text-slate-600 mx-2">|</span>
              <span className="text-red-400 font-bold">❌ {wrongCount} wrong</span>
              <span className="text-slate-600 mx-2">|</span>
              <span className="text-brand-yellow font-bold">🏆 {playerScore} pts</span>
            </span>
            {isDemo && (
              <span className="text-slate-500 text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                🎮 Demo
              </span>
            )}
          </div>
          <AnimatePresence mode="wait">
            {flavorText && (
              <motion.p
                key={flavorText}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center text-sm text-slate-300 mt-1.5"
              >
                {flavorText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Leaderboard sidebar (lg+ screens) ─────────────────────────── */}
      <div className="hidden lg:block w-64 relative z-10 p-4 pl-0 shrink-0">
        <Leaderboard sessionId={sessionId || 'demo'} />
      </div>
    </div>
  );
};

export default RobotRun;
