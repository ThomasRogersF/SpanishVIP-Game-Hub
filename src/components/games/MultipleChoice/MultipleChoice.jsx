import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Timer from '../../shared/Timer';
import Leaderboard from '../../shared/Leaderboard';
import { useTimer } from '../../../hooks/useTimer';
import { calculateScore } from '../../../utils/scoreCalculator';
import { isDemo } from '../../../utils/sessionMode';
import { db } from '../../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSyncedCountdown } from '../../../hooks/useSyncedCountdown';
import { useSessionQuestions } from '../../../hooks/useSessionQuestions';
import { recordScoreIfLoggedIn } from '../../../utils/recordScore';

const SAMPLE_QUESTIONS = [
  {
    question: "¿Cómo se dice 'apple' en español?",
    options: ['Manzana', 'Naranja', 'Pera', 'Uva'],
    correct: 0,
  },
  {
    question: "¿Cómo se dice 'house' en español?",
    options: ['Coche', 'Casa', 'Perro', 'Libro'],
    correct: 1,
  },
  {
    question: '¿Cuál es la capital de España?',
    options: ['Barcelona', 'Sevilla', 'Madrid', 'Valencia'],
    correct: 2,
  },
  {
    question: "¿Cómo se dice 'water' en español?",
    options: ['Leche', 'Jugo', 'Café', 'Agua'],
    correct: 3,
  },
  {
    question: "Complete: 'Buenos ___'",
    options: ['Días', 'Tardes', 'Noches', 'Todo lo anterior'],
    correct: 0,
  },
];

const OPTIONS_META = [
  { label: 'A', bg: 'bg-red-600', hover: 'hover:bg-red-500', selected: 'bg-red-700' },
  { label: 'B', bg: 'bg-blue-600', hover: 'hover:bg-blue-500', selected: 'bg-blue-700' },
  { label: 'C', bg: 'bg-yellow-500', hover: 'hover:bg-yellow-400', selected: 'bg-yellow-600' },
  { label: 'D', bg: 'bg-green-600', hover: 'hover:bg-green-500', selected: 'bg-green-700' },
];

const TIME_LIMIT = 20;

const MultipleChoice = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { questions: loadedQuestions, loading: questionsLoading } = useSessionQuestions(sessionId, SAMPLE_QUESTIONS);
  const [sessionStatus, setSessionStatus] = useState('checking');
  const { countdown: syncedCountdown, isReady } = useSyncedCountdown(sessionId);

  // Subscribe to session status for live mode waiting room
  useEffect(() => {
    if (isDemo(sessionId)) {
      setSessionStatus('active');
      return;
    }
    if (!db) {
      setSessionStatus('active');
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        setSessionStatus(snap.data().status);
      } else {
        setSessionStatus('not_found');
      }
    });
    return unsubscribe;
  }, [sessionId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Always-up-to-date advance callback (avoids stale closure in timeouts)
  const advanceRef = useRef(null);
  useEffect(() => {
    advanceRef.current = () => {
      const nextIndex = currentIndex + 1;
      setShowFeedback(false);
      setSelectedAnswer(null);
      if (nextIndex >= loadedQuestions.length) {
        setIsFinished(true);
        recordScoreIfLoggedIn(totalScore);
      } else {
        setCurrentIndex(nextIndex);
      }
    };
  });

  // Time up handler — selectedAnswer check is always current via advanceRef pattern
  const handleTimeUp = () => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(-1); // -1 = timed out
    setLastScore(0);
    setShowFeedback(true);
  };

  const { timeRemaining, start, pause, reset } = useTimer(TIME_LIMIT, handleTimeUp);

  // Restart timer every time a new question loads
  useEffect(() => {
    reset(TIME_LIMIT);
    const t = setTimeout(() => start(), 150);
    return () => clearTimeout(t);
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance after feedback
  useEffect(() => {
    if (!showFeedback) return;
    const t = setTimeout(() => advanceRef.current?.(), 2200);
    return () => clearTimeout(t);
  }, [showFeedback]);

  const handleAnswer = (optionIndex) => {
    if (selectedAnswer !== null || showFeedback) return;
    pause();
    const q = loadedQuestions[currentIndex];
    if (!q) return;
    const isCorrect = optionIndex === q.correct;
    const score = calculateScore(isCorrect, timeRemaining, TIME_LIMIT);
    setSelectedAnswer(optionIndex);
    setLastScore(score);
    setTotalScore((prev) => prev + score);
    setShowFeedback(true);
  };

  const handlePlayAgain = () => {
    setCurrentIndex(0);
    setTotalScore(0);
    setLastScore(0);
    setIsFinished(false);
    setSelectedAnswer(null);
    setShowFeedback(false);
  };

  const getButtonClass = (index) => {
    const meta = OPTIONS_META[index];
    const q = loadedQuestions[currentIndex];
    if (!q) return meta.bg;

    if (!showFeedback) {
      return `${meta.bg} ${meta.hover} cursor-pointer active:scale-95`;
    }
    if (index === q.correct) {
      return 'bg-green-500 ring-4 ring-white scale-105';
    }
    if (index === selectedAnswer && index !== q.correct) {
      return 'bg-red-900 opacity-60';
    }
    return 'opacity-30 cursor-default';
  };

  // ── Loading questions from session ─────────────────────────────────
  if (questionsLoading || loadedQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">Loading questions...</p>
          <p className="text-slate-500 text-sm mt-2">Preparing your game</p>
        </div>
      </div>
    );
  }

  // ── Waiting room (live sessions) ────────────────────────────────
  if (sessionStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-2">Waiting for teacher...</h2>
          <p className="text-slate-400">The game will start soon</p>
          <div className="flex items-center gap-2 justify-center mt-4 text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm">Connected as {localStorage.getItem('svip_nickname') || 'Player'}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Countdown screen (synced) ────────────────────────────────
  if (sessionStatus === 'active' && !isReady && syncedCountdown !== null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-4">Game starting in...</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={syncedCountdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-9xl font-black text-yellow-400"
            >
              {syncedCountdown === 0 ? '🚀' : syncedCountdown}
            </motion.div>
          </AnimatePresence>
          <p className="text-slate-500 text-sm mt-6">
            All players are starting together
          </p>
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
          <a href="/join" className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl">
            Back to Join
          </a>
        </div>
      </div>
    );
  }

  // ── Finished screen ──────────────────────────────────────────────
  if (isFinished) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="bg-slate-800 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl border border-slate-700"
        >
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-1">Game Over!</h1>
          <p className="text-slate-400 mb-6">
            You completed all {loadedQuestions.length} questions
          </p>

          <div className="bg-brand-yellow/10 border border-brand-yellow/40 rounded-xl p-6 mb-6">
            <p className="text-brand-yellow text-xs font-bold uppercase tracking-widest mb-1">
              Final Score
            </p>
            <p className="text-5xl font-black text-white">{totalScore.toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-1">
              Max possible: {(loadedQuestions.length * 2000).toLocaleString()}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePlayAgain}
              className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Back to Hub
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Game screen ──────────────────────────────────────────────────
  const question = loadedQuestions[currentIndex];
  if (!question) return null; // safety guard

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col lg:flex-row">
      {/* Left: Game area */}
      <div className="flex-1 flex flex-col">
        {/* Header bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-slate-400 text-xs mb-1">
                Question {currentIndex + 1} / {loadedQuestions.length}
              </p>
              <div className="w-40 h-1.5 bg-slate-700 rounded-full">
                <div
                  className="h-1.5 bg-brand-red rounded-full transition-all duration-500"
                  style={{ width: `${((currentIndex + 1) / loadedQuestions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-slate-500 text-xs">Score</p>
              <p className="text-brand-yellow font-black text-lg leading-none">
                {totalScore.toLocaleString()}
              </p>
            </div>
            <Timer timeRemaining={timeRemaining} duration={TIME_LIMIT} />
          </div>
        </div>

        {/* Question + Options */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-2xl"
            >
              {/* Question card */}
              <div className="bg-slate-800 rounded-2xl p-8 text-center mb-6 shadow-xl border border-slate-700">
                <p className="text-2xl md:text-3xl font-bold text-white leading-snug">
                  {question.question}
                </p>
              </div>

              {/* Answer grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {question.options.map((option, index) => (
                  <motion.button
                    key={index}
                    whileHover={!showFeedback ? { scale: 1.02 } : {}}
                    whileTap={!showFeedback ? { scale: 0.97 } : {}}
                    onClick={() => handleAnswer(index)}
                    disabled={showFeedback}
                    className={`rounded-xl p-5 text-left transition-all duration-200 text-white font-semibold shadow-lg ${getButtonClass(index)}`}
                  >
                    <span className="block text-xs font-bold mb-1 opacity-70">
                      {OPTIONS_META[index].label}
                    </span>
                    <span className="text-lg">{option}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Leaderboard (desktop) */}
      <aside className="hidden lg:block w-64 xl:w-72 p-4 bg-slate-950 border-l border-slate-800 pt-6">
        <Leaderboard sessionId={sessionId || 'demo'} />
      </aside>

      {/* Feedback overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <motion.div
              initial={{ scale: 0.7, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className={`rounded-2xl px-10 py-8 text-center shadow-2xl ${
                selectedAnswer === loadedQuestions[currentIndex]?.correct
                  ? 'bg-green-600'
                  : 'bg-red-700'
              }`}
            >
              <div className="text-6xl mb-2">
                {selectedAnswer === -1
                  ? '⏰'
                  : selectedAnswer === loadedQuestions[currentIndex]?.correct
                  ? '✅'
                  : '❌'}
              </div>
              <p className="text-white text-2xl font-black">
                {selectedAnswer === -1
                  ? "Time's Up!"
                  : selectedAnswer === loadedQuestions[currentIndex]?.correct
                  ? 'Correct!'
                  : 'Wrong!'}
              </p>
              {lastScore > 0 && (
                <p className="text-white/80 text-lg mt-1">+{lastScore.toLocaleString()} pts</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultipleChoice;
