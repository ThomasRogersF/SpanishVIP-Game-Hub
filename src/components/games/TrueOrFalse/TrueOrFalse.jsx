import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimer } from '../../../hooks/useTimer';
import { calculateScore } from '../../../utils/scoreCalculator';
import { updatePlayerScore } from '../../../firebase/leaderboard';
import Leaderboard from '../../shared/Leaderboard';
import { isDemo } from '../../../utils/sessionMode';
import { db } from '../../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

// ── Data ─────────────────────────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  { id: 1, statement: "In Spanish, 'Buenas noches' means Good Morning.", isTrue: false },
  { id: 2, statement: "The Spanish word for water is 'agua'.", isTrue: true },
  { id: 3, statement: "'Gracias' means Please in Spanish.", isTrue: false },
  { id: 4, statement: "Spain's capital city is Madrid.", isTrue: true },
  { id: 5, statement: "In Spanish, 'rojo' means the color blue.", isTrue: false },
  { id: 6, statement: "'Hola' is a common Spanish greeting.", isTrue: true },
  { id: 7, statement: "The Spanish word for dog is 'gato'.", isTrue: false },
  { id: 8, statement: "'Por favor' means Thank you in Spanish.", isTrue: false },
];

// Multiplier indexed by streak length going INTO the question (capped at index 4 = 3×)
const STREAK_MULTIPLIERS = [1, 1.5, 2, 2.5, 3];
const TIME_LIMIT = 5; // seconds per question

// ── Component ─────────────────────────────────────────────────────────
const TrueOrFalse = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const nickname = localStorage.getItem('svip_nickname') || 'Player';
  const [sessionStatus, setSessionStatus] = useState('checking');

  useEffect(() => {
    if (isDemo(sessionId)) {
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
  }, [sessionId]);

  // Phase state machine: waiting → playing → feedback → playing … → finished
  const [phase, setPhase] = useState('waiting');
  const [countdown, setCountdown] = useState(3);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastResult, setLastResult] = useState(null);

  // Disables the timer bar CSS transition briefly on question reset so it snaps to 100%
  const [timerTransition, setTimerTransition] = useState('none');

  // Refs to avoid stale closures inside async timer callbacks
  const totalScoreRef = useRef(0);
  const streakRef = useRef(0);

  // Always-fresh advance callback — reads latest currentIndex without being a dep
  const advanceRef = useRef(null);
  useEffect(() => {
    advanceRef.current = () => {
      const next = currentIndex + 1;
      if (next >= SAMPLE_QUESTIONS.length) {
        setPhase('finished');
      } else {
        setCurrentIndex(next);
        setPhase('playing');
      }
    };
  });

  // ── Timer ────────────────────────────────────────────────────────
  const handleTimeUp = () => {
    if (phase !== 'playing') return; // guard against late-firing callbacks
    streakRef.current = 0;
    setStreak(0);
    setLastResult({ isCorrect: false, points: 0, newStreak: 0, timedOut: true });
    setPhase('feedback');
  };

  const { timeRemaining, start, pause, reset } = useTimer(TIME_LIMIT, handleTimeUp);

  // ── Waiting countdown (3 → 2 → 1 → 🚀 → playing) ────────────────
  useEffect(() => {
    if (phase !== 'waiting') return;
    if (countdown <= 0) {
      const t = setTimeout(() => setPhase('playing'), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Reset + start timer on each new playing phase ────────────────
  // 510ms delay accounts for AnimatePresence mode="wait": 250ms exit + 250ms enter
  useEffect(() => {
    if (phase !== 'playing') return;
    setTimerTransition('none'); // snap bar to 100% with no animation
    reset(TIME_LIMIT);
    const t = setTimeout(() => {
      setTimerTransition('width 0.95s linear'); // smooth depletion from here
      start();
    }, 510);
    return () => clearTimeout(t);
  }, [phase, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-advance 1.5 s after feedback ───────────────────────────
  useEffect(() => {
    if (phase !== 'feedback') return;
    const t = setTimeout(() => advanceRef.current?.(), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Answer handler ───────────────────────────────────────────────
  const handleAnswer = (userAnswer) => {
    if (phase !== 'playing') return;
    pause();

    const question = SAMPLE_QUESTIONS[currentIndex];
    const isCorrect = userAnswer === question.isTrue;

    // 500 base + up to 500 time bonus → max 1000 before streak multiplier
    const baseScore = calculateScore(isCorrect, timeRemaining, TIME_LIMIT, 500);

    // Multiplier uses streak going INTO this question
    const multiplier = STREAK_MULTIPLIERS[Math.min(streakRef.current, 4)];
    const finalScore = Math.round(baseScore * multiplier);

    const newStreak = isCorrect ? streakRef.current + 1 : 0;
    streakRef.current = newStreak;

    const newTotal = totalScoreRef.current + finalScore;
    totalScoreRef.current = newTotal;

    setStreak(newStreak);
    setHighestStreak((prev) => Math.max(prev, newStreak));
    setTotalScore(newTotal);
    setCorrectCount((prev) => (isCorrect ? prev + 1 : prev));
    setLastResult({ isCorrect, points: finalScore, newStreak, timedOut: false });
    setPhase('feedback');

    if (!isDemo(sessionId)) {
      updatePlayerScore(sessionId, nickname, newTotal).catch((err) =>
        console.warn('Score update skipped:', err.message)
      );
    }
  };

  // ── Play Again ───────────────────────────────────────────────────
  const handlePlayAgain = () => {
    totalScoreRef.current = 0;
    streakRef.current = 0;
    reset(TIME_LIMIT);
    setCurrentIndex(0);
    setTotalScore(0);
    setStreak(0);
    setHighestStreak(0);
    setCorrectCount(0);
    setLastResult(null);
    setCountdown(3);
    setPhase('waiting');
  };

  // ── Derived ──────────────────────────────────────────────────────
  const currentQuestion = SAMPLE_QUESTIONS[currentIndex];
  const barPct = (timeRemaining / TIME_LIMIT) * 100;
  const barColor =
    timeRemaining <= 2 ? 'bg-red-500' : timeRemaining <= 3 ? 'bg-yellow-400' : 'bg-green-500';

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

  // ── WAITING SCREEN (countdown) ────────────────────────────────
  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col">
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <span className="text-slate-400 font-semibold">True or False ✅</span>
        </nav>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center select-none">
            <p className="text-slate-400 text-xl font-semibold mb-8">Get Ready!</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={countdown}
                initial={{ scale: 1.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="text-[9rem] leading-none font-black text-white"
              >
                {countdown > 0 ? countdown : '🚀'}
              </motion.div>
            </AnimatePresence>
            <p className="text-slate-500 text-sm mt-10">
              {SAMPLE_QUESTIONS.length} questions · {TIME_LIMIT} seconds each
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── FINISHED SCREEN ──────────────────────────────────────────────
  if (phase === 'finished') {
    const accuracy = Math.round((correctCount / SAMPLE_QUESTIONS.length) * 100);
    return (
      <div className="min-h-screen bg-[#0f172a] overflow-y-auto">
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <span className="text-slate-400 font-semibold">Game Over!</span>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {/* Score card */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.55 }}
            className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700 shadow-xl"
          >
            <div className="text-6xl mb-3">🏆</div>
            <p className="text-brand-yellow text-xs font-bold uppercase tracking-widest mb-1">
              Final Score
            </p>
            <p className="text-6xl font-black text-white mb-6">
              {totalScore.toLocaleString()}
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-2xl font-black text-white">
                  {correctCount}/{SAMPLE_QUESTIONS.length}
                </p>
                <p className="text-slate-400 text-xs mt-1">correct</p>
              </div>
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-2xl font-black text-brand-yellow">{accuracy}%</p>
                <p className="text-slate-400 text-xs mt-1">accuracy</p>
              </div>
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-2xl font-black text-white">🔥 {highestStreak}</p>
                <p className="text-slate-400 text-xs mt-1">best streak</p>
              </div>
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl"
          >
            <Leaderboard sessionId={sessionId || 'demo'} />
          </motion.div>

          {/* Buttons */}
          <div className="flex gap-3 pb-6">
            <button
              onClick={handlePlayAgain}
              className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors text-lg shadow-lg"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl transition-colors text-lg"
            >
              Back to Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN (playing + feedback) ─────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col relative overflow-hidden">
      {/* Stats bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0">
        {/* Score (left) */}
        <div className="w-24">
          <p className="text-slate-500 text-xs leading-none mb-0.5">Score</p>
          <p className="text-brand-yellow font-black text-xl leading-none">
            {totalScore.toLocaleString()}
          </p>
        </div>

        {/* Question counter + progress dots (center) */}
        <div className="text-center">
          <p className="text-white font-semibold text-sm leading-none mb-1.5">
            Question {currentIndex + 1}
            <span className="text-slate-500"> of {SAMPLE_QUESTIONS.length}</span>
          </p>
          <div className="flex gap-1 justify-center">
            {SAMPLE_QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-1 w-4 rounded-full transition-colors duration-300 ${
                  i < currentIndex
                    ? 'bg-brand-yellow'
                    : i === currentIndex
                    ? 'bg-white'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Streak (right) — pulses on increase via key remount */}
        <div className="w-24 text-right">
          <motion.p
            key={streak}
            initial={{ scale: streak > 0 ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-brand-yellow font-black text-xl leading-none"
          >
            🔥 {streak}
          </motion.p>
          <p className="text-slate-500 text-xs mt-0.5">streak</p>
        </div>
      </div>

      {/* Timer bar — horizontal, depletes left to right */}
      <div className="h-3 bg-slate-700 flex-shrink-0">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${barPct}%`, transition: timerTransition }}
        />
      </div>

      {/* Statement area — fills available space, centered */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-0">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -60, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {/* Statement card */}
              <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700 shadow-xl">
                <p className="text-2xl md:text-3xl font-semibold text-white leading-relaxed">
                  {currentQuestion.statement}
                </p>
              </div>

              {/* Correct answer reveal shown only during feedback on wrong/timeout */}
              <AnimatePresence>
                {phase === 'feedback' && lastResult && !lastResult.isCorrect && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 bg-slate-700 rounded-xl px-5 py-3 text-center border border-slate-600"
                  >
                    <p className="text-slate-300 text-sm">
                      {lastResult.timedOut ? '⏰ Time up! ' : ''}
                      Correct answer:{' '}
                      <span
                        className={`font-bold ${
                          currentQuestion.isTrue ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {currentQuestion.isTrue ? 'TRUE ✅' : 'FALSE ❌'}
                      </span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Answer buttons — TRUE (green) left, FALSE (red) right; stack on mobile */}
      <div className="flex-shrink-0 p-4 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.button
          whileHover={phase === 'playing' ? { scale: 1.02 } : {}}
          whileTap={phase === 'playing' ? { scale: 0.97 } : {}}
          onClick={() => handleAnswer(true)}
          disabled={phase !== 'playing'}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-default text-white text-3xl font-bold py-12 rounded-2xl transition-colors shadow-lg"
        >
          ✅ TRUE
        </motion.button>

        <motion.button
          whileHover={phase === 'playing' ? { scale: 1.02 } : {}}
          whileTap={phase === 'playing' ? { scale: 0.97 } : {}}
          onClick={() => handleAnswer(false)}
          disabled={phase !== 'playing'}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-default text-white text-3xl font-bold py-12 rounded-2xl transition-colors shadow-lg"
        >
          ❌ FALSE
        </motion.button>
      </div>

      {/* ── Fixed overlays ──────────────────────────────────────────── */}

      {/* Full-screen flash: green = correct, red = wrong */}
      <AnimatePresence>
        {phase === 'feedback' && lastResult && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`fixed inset-0 pointer-events-none z-40 ${
              lastResult.isCorrect ? 'bg-green-500' : 'bg-red-600'
            }`}
          />
        )}
      </AnimatePresence>

      {/* +Points popup — animates upward and fades */}
      <AnimatePresence>
        {phase === 'feedback' && lastResult && lastResult.points > 0 && (
          <motion.div
            key="points-popup"
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -140, opacity: 0, scale: 1.3 }}
            transition={{ duration: 1.3, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <p className="text-5xl font-black text-white drop-shadow-2xl">
              +{lastResult.points.toLocaleString()} pts
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streak badge — shown when streak ≥ 2 */}
      <AnimatePresence>
        {phase === 'feedback' && lastResult?.newStreak >= 2 && (
          <motion.div
            key="streak-popup"
            initial={{ scale: 0.5, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="fixed bottom-40 left-0 right-0 flex justify-center pointer-events-none z-50"
          >
            <div className="bg-brand-yellow/95 text-black px-7 py-2.5 rounded-full shadow-2xl">
              <p className="text-2xl font-black tracking-tight">
                🔥 {lastResult.newStreak} STREAK!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrueOrFalse;
