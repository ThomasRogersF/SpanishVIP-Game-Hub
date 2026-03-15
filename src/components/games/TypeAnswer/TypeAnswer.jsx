import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimer } from '../../../hooks/useTimer';
import { checkAnswer, normalizeString } from '../../../utils/stringMatcher';
import { updatePlayerScore } from '../../../firebase/leaderboard';
import Leaderboard from '../../shared/Leaderboard';
import { isDemo as isDemoMode } from '../../../utils/sessionMode';
import { getCurrentTeacher } from '../../../firebase/teachers';
import { db } from '../../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSyncedCountdown } from '../../../hooks/useSyncedCountdown';
import { useSessionQuestions } from '../../../hooks/useSessionQuestions';
import { recordScoreIfLoggedIn } from '../../../utils/recordScore';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const SAMPLE_QUESTIONS = [
  {
    id: 1,
    question: "How do you say 'Thank you' in Spanish?",
    acceptedAnswers: ['gracias'],
    display: 'Gracias',
    timeLimit: 15,
    hint: "It starts with 'G'",
    wordBank: ['g', 'r', 'a', 'c', 'i', 'a', 's'],
    category: 'vocabulary',
  },
  {
    id: 2,
    question: "Translate: 'I want to eat' in Spanish",
    acceptedAnswers: ['quiero comer', 'yo quiero comer'],
    display: 'Quiero comer',
    timeLimit: 25,
    hint: "Use the verb 'querer'",
    wordBank: null,
    category: 'translation',
  },
  {
    id: 3,
    question: "What is the Spanish word for 'house'?",
    acceptedAnswers: ['casa'],
    display: 'Casa',
    timeLimit: 12,
    hint: "Rhymes with 'salsa'",
    wordBank: ['c', 'a', 's', 'a'],
    category: 'vocabulary',
  },
  {
    id: 4,
    question: "Conjugate 'hablar' for 'nosotros' (we speak)",
    acceptedAnswers: ['hablamos'],
    display: 'Hablamos',
    timeLimit: 20,
    hint: "Ends in '-amos'",
    wordBank: null,
    category: 'conjugation',
  },
  {
    id: 5,
    question: "How do you say 'Good night' in Spanish?",
    acceptedAnswers: ['buenas noches'],
    display: 'Buenas noches',
    timeLimit: 15,
    hint: 'Two words — think evening greeting',
    wordBank: null,
    category: 'vocabulary',
  },
  {
    id: 6,
    question: "What is the Spanish word for 'water'?",
    acceptedAnswers: ['agua'],
    display: 'Agua',
    timeLimit: 12,
    hint: "Starts with 'A'",
    wordBank: ['a', 'g', 'u', 'a'],
    category: 'vocabulary',
  },
];

const DEMO_ANSWERS = {
  0: ['gracias', 'gracias', 'gracies', 'gracias', 'thank you', 'gracias'],
  1: ['quiero comer', 'yo quiero comer', 'quero comer', 'quiero comer'],
  2: ['casa', 'casa', 'cassa', 'casa', 'casa'],
  3: ['hablamos', 'hablamos', 'ablamos', 'hablamos'],
  4: ['buenas noches', 'buenas noches', 'buenas noche', 'buenas noches'],
  5: ['agua', 'agua', 'agua', 'agwa', 'agua'],
};

const ACCENT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ', '¿', '¡'];

const CATEGORY_STYLES = {
  vocabulary: { label: '📚 Vocabulary', cls: 'bg-blue-900 text-blue-300' },
  translation: { label: '🌐 Translation', cls: 'bg-green-900 text-green-300' },
  conjugation: { label: '🔤 Conjugation', cls: 'bg-purple-900 text-purple-300' },
};

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

const levenshtein = (a, b) => {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : 1 + Math.min(matrix[i - 1][j - 1], matrix[i - 1][j], matrix[i][j - 1]);
    }
  }
  return matrix[b.length][a.length];
};

const isCloseAnswer = (studentAnswer, acceptedAnswers) => {
  const norm = normalizeString(studentAnswer);
  return acceptedAnswers.some((a) => levenshtein(norm, normalizeString(a)) === 1);
};

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

const calcScore = (isCorrect, isClose, timeRemaining, timeLimit, hintUsed) => {
  let pts = 0;
  if (isCorrect) {
    const base = 1000;
    const speed = Math.round((timeRemaining / timeLimit) * 1000);
    pts = base + speed;
  } else if (isClose) {
    pts = 500;
  }
  if (hintUsed && pts > 0) pts = Math.max(0, pts - 200);
  return pts;
};

// ---------------------------------------------------------------------------
// WordBank sub-component
// ---------------------------------------------------------------------------

const WordBank = ({ letters, usedIndices, onLetterClick, onClear }) => (
  <div className="mt-3">
    <p className="text-slate-500 text-xs mb-2 text-center">💡 Letter bank — click to append</p>
    <div className="flex flex-wrap gap-2 justify-center mb-2">
      {letters.map((letter, i) => {
        const used = usedIndices.includes(i);
        return (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: used ? 0.3 : 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => !used && onLetterClick(letter, i)}
            disabled={used}
            className="bg-slate-600 hover:bg-slate-500 text-white rounded-lg px-3 py-2 font-mono font-bold cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-800 transition-colors text-sm select-none"
          >
            {letter.toUpperCase()}
          </motion.button>
        );
      })}
    </div>
    <div className="flex justify-center">
      <button
        onClick={onClear}
        className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
      >
        Clear input
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TypeAnswer = () => {
  const { sessionId = 'demo' } = useParams();
  const isDemoFlag = isDemoMode(sessionId);
  const currentAccount = getCurrentTeacher();
  const isTeacher = currentAccount?.role === "teacher";
  const { questions: loadedQuestions, loading: questionsLoading } = useSessionQuestions(sessionId, SAMPLE_QUESTIONS);
  const navigate = useNavigate();
  const nickname = localStorage.getItem('svip_nickname') || 'Player';
  const [sessionStatus, setSessionStatus] = useState('checking');
  const { countdown: syncedCountdown, isReady } = useSyncedCountdown(sessionId);

  useEffect(() => {
    if (isDemoMode(sessionId)) {
      setSessionStatus('active');
      return;
    }
    if (!db) { setSessionStatus('active'); return; }
    const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        setSessionStatus(snap.data().status);
      } else {
        setSessionStatus('not_found');
      }
    });
    return unsubscribe;
  }, [sessionId]);

  // Phase: waiting | playing | feedback | finished
  const [phase, setPhase] = useState('waiting');

  const [qIndex, setQIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [wordBankUsed, setWordBankUsed] = useState([]); // indices of used bank letters
  const [timerTransition, setTimerTransition] = useState('width 1s linear');

  // Results per question
  const [results, setResults] = useState([]); // { question, studentAnswer, display, pts, isCorrect, isClose, timedOut }
  const [totalScore, setTotalScore] = useState(0);
  const totalScoreRef = useRef(0);
  const hintCountRef = useRef(0);

  // Feedback state
  const [feedbackKind, setFeedbackKind] = useState(null); // 'correct' | 'close' | 'wrong' | 'timeout'
  const [feedbackPts, setFeedbackPts] = useState(0);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [inputShake, setInputShake] = useState(false);

  const inputRef = useRef(null);
  const submitRef = useRef(null);
  const inputValueRef = useRef('');
  const demoHintCountRef = useRef(0);   // hints used by simulated demo players
  const demoPendingTimers = useRef([]); // timeout IDs for demo simulation

  const question = loadedQuestions[qIndex] ?? null;

  // Keep inputValueRef in sync (for stale-closure-safe submit)
  const handleInputChange = (e) => {
    const v = e.target.value.slice(0, 50);
    setInputValue(v);
    inputValueRef.current = v;
  };

  // --- Timer ---
  const { timeRemaining, start: startTimer, pause: pauseTimer, reset: resetTimer } = useTimer(
    question?.timeLimit ?? 15,
    () => submitRef.current?.('timeout')
  );

  const timeFraction = question ? timeRemaining / question.timeLimit : 1;
  const timerColor =
    timeFraction > 0.5 ? '#22c55e' : timeFraction > 0.27 ? '#fbbf24' : '#ef4444';

  // ---------------------------------------------------------------------------
  // Synced countdown → start playing
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isReady && phase === 'waiting') {
      setPhase('playing');
    }
  }, [isReady, phase]);

  // ---------------------------------------------------------------------------
  // Start timer when entering playing phase / changing question
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'playing' || !question) return;
    setTimerTransition('none');
    resetTimer(question.timeLimit);
    const t = setTimeout(() => {
      setTimerTransition('width 1s linear');
      startTimer();
      inputRef.current?.focus();
    }, 510);
    return () => clearTimeout(t);
  }, [phase, qIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Auto-focus on question load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (phase === 'playing') {
      inputRef.current?.focus();
    }
    if (phase === 'feedback') {
      inputRef.current?.blur();
    }
  }, [phase, qIndex]);

  // ---------------------------------------------------------------------------
  // Demo simulation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'playing' || !isDemoMode(sessionId)) return;

    // Cancel any leftover timers from the previous question
    demoPendingTimers.current.forEach(clearTimeout);
    demoPendingTimers.current = [];

    const answers = DEMO_ANSWERS[qIndex] || [];
    answers.forEach((ans) => {
      const delay = 5000 + Math.random() * 7000; // 5–12 s random answer time
      const usedHint = Math.random() < 0.25;     // 25 % chance of hint use
      if (usedHint) demoHintCountRef.current += 1;

      const id = setTimeout(() => {
        // Simulation runs in background; scores are tracked via demoHintCountRef.
        // The Leaderboard component renders its own hardcoded demo players, so no
        // Firebase write is needed here.
        void ans; // acknowledge the answer variable (used for hint probability above)
      }, delay);
      demoPendingTimers.current.push(id);
    });

    return () => {
      demoPendingTimers.current.forEach(clearTimeout);
      demoPendingTimers.current = [];
    };
  }, [phase, qIndex, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    (trigger = 'manual') => {
      if (phase !== 'playing') return;
      pauseTimer();

      const raw = inputValueRef.current.trim();
      const timedOut = trigger === 'timeout';
      const isEmpty = raw === '';

      const correct = !isEmpty && checkAnswer(raw, question.acceptedAnswers);
      const close = !correct && !isEmpty && isCloseAnswer(raw, question.acceptedAnswers);
      const pts = calcScore(correct, close, timeRemaining, question.timeLimit, hintUsed);

      const newTotal = totalScoreRef.current + pts;
      totalScoreRef.current = newTotal;
      setTotalScore(newTotal);

      setResults((prev) => [
        ...prev,
        {
          question: question.question,
          display: question.display,
          studentAnswer: raw || '(no answer)',
          pts,
          isCorrect: correct,
          isClose: close,
          timedOut,
        },
      ]);

      const kind = correct ? 'correct' : close ? 'close' : timedOut && isEmpty ? 'timeout' : 'wrong';
      setFeedbackKind(kind);
      setFeedbackPts(pts);
      setPhase('feedback');

      if (kind === 'correct' || kind === 'close') {
        setShowScorePopup(true);
        setTimeout(() => setShowScorePopup(false), 2200);
      }
      if (kind === 'wrong' || kind === 'timeout') {
        setInputShake(true);
        setTimeout(() => setInputShake(false), 500);
      }
    },
    [phase, question, timeRemaining, hintUsed, pauseTimer]
  );

  // Keep submitRef always fresh
  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  // ---------------------------------------------------------------------------
  // Advance after feedback
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'feedback') return;
    const t = setTimeout(async () => {
      if (qIndex + 1 < loadedQuestions.length) {
        setQIndex((i) => i + 1);
        setInputValue('');
        inputValueRef.current = '';
        setShowHint(false);
        setHintUsed(false);
        setWordBankUsed([]);
        setFeedbackKind(null);
        setPhase('playing');
      } else {
        if (!isDemoMode(sessionId)) {
          try {
            await updatePlayerScore(sessionId, nickname, totalScoreRef.current);
          } catch (_) {}
        }
        setPhase('finished');
        recordScoreIfLoggedIn(totalScoreRef.current);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Accent insertion
  // ---------------------------------------------------------------------------

  const insertAccent = useCallback((char) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + char + el.value.slice(end);
    const clipped = next.slice(0, 50);
    setInputValue(clipped);
    inputValueRef.current = clipped;
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + char.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Word bank
  // ---------------------------------------------------------------------------

  const handleBankLetter = useCallback(
    (letter, index) => {
      const el = inputRef.current;
      const start = el?.selectionStart ?? inputValueRef.current.length;
      const end = el?.selectionEnd ?? inputValueRef.current.length;
      const next = (inputValueRef.current.slice(0, start) + letter + inputValueRef.current.slice(end)).slice(0, 50);
      setInputValue(next);
      inputValueRef.current = next;
      setWordBankUsed((prev) => [...prev, index]);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = start + letter.length;
        el?.setSelectionRange(pos, pos);
      });
    },
    []
  );

  const handleClearBank = useCallback(() => {
    setInputValue('');
    inputValueRef.current = '';
    setWordBankUsed([]);
    inputRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Hint click
  // ---------------------------------------------------------------------------

  const handleHint = () => {
    if (hintUsed) return;
    setShowHint(true);
    setHintUsed(true);
    hintCountRef.current += 1;
  };

  // ---------------------------------------------------------------------------
  // Enter key
  // ---------------------------------------------------------------------------

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && phase === 'playing') {
      e.preventDefault();
      handleSubmit('manual');
    }
  };

  // ---------------------------------------------------------------------------
  // Finish stats
  // ---------------------------------------------------------------------------

  const accuracy = useMemo(() => {
    if (results.length === 0) return 0;
    const correct = results.filter((r) => r.isCorrect || r.isClose).length;
    return Math.round((correct / results.length) * 100);
  }, [results]);

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

  // ---------------------------------------------------------------------------
  // Waiting / countdown screen
  // ---------------------------------------------------------------------------

  // Synced countdown screen
  if (sessionStatus === 'active' && !isReady && syncedCountdown !== null) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-800 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl border border-slate-700"
        >
          <div className="text-7xl mb-4">⌨️</div>
          <h1 className="text-3xl font-bold text-white mb-2">Type Answer</h1>
          <p className="text-slate-400 mb-6">Type the exact Spanish answer from memory</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={syncedCountdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="text-7xl font-black text-brand-yellow mb-6"
            >
              {syncedCountdown === 0 ? '🚀' : syncedCountdown}
            </motion.div>
          </AnimatePresence>
          <p className="text-slate-500 text-sm">All players are starting together</p>
        </motion.div>
      </div>
    );
  }

  // Pre-countdown waiting screen
  if (phase === 'waiting' && !isReady) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-800 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl border border-slate-700"
        >
          <div className="text-7xl mb-4">⌨️</div>
          <h1 className="text-3xl font-bold text-white mb-2">Type Answer</h1>
          <p className="text-slate-400 mb-6">Type the exact Spanish answer from memory</p>
          <div className="bg-slate-700 rounded-xl p-4 mb-8 text-left text-sm text-slate-300 space-y-1">
            <p>• Type your answer — accents optional</p>
            <p>• Near-misses earn 500 pts</p>
            <p>• Speed bonus for fast correct answers</p>
            <p>• 💡 Hint costs 200 pts</p>
          </div>
          <p className="text-slate-500 text-sm">Starting…</p>
        </motion.div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Finished screen
  // ---------------------------------------------------------------------------

  if (phase === 'finished') {
    return (
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen bg-[#0f172a] p-4 flex flex-col items-center"
      >
        <div className="w-full max-w-2xl mt-4">
          {/* Score card */}
          <div className="bg-slate-800 rounded-2xl p-8 text-center shadow-2xl border border-slate-700 mb-6">
            <div className="text-6xl mb-3">🏆</div>
            <h1 className="text-3xl font-bold text-white mb-1">Game Over!</h1>
            <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-5 mt-4 mb-2">
              <p className="text-brand-yellow text-sm font-semibold uppercase tracking-widest mb-1">Final Score</p>
              <p className="text-brand-yellow text-5xl font-bold">{totalScore.toLocaleString()}</p>
            </div>
            <div className="flex gap-6 justify-center mt-4 text-sm">
              <div className="text-center">
                <p className="text-slate-400">Accuracy</p>
                <p className="text-white font-bold text-lg">{accuracy}%</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400">Questions</p>
                <p className="text-white font-bold text-lg">{results.length}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400">Hints used</p>
                <p className="text-white font-bold text-lg">{hintCountRef.current}</p>
              </div>
              {isDemoMode(sessionId) && demoHintCountRef.current > 0 && (
                <div className="text-center">
                  <p className="text-slate-400">Demo hints</p>
                  <p className="text-white font-bold text-lg">{demoHintCountRef.current}</p>
                </div>
              )}
            </div>
          </div>

          {/* Question breakdown */}
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 mb-6">
            <h2 className="text-white font-bold text-lg mb-4">Question Breakdown</h2>
            <div className="space-y-3">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 border ${
                    r.isCorrect
                      ? 'bg-green-900/20 border-green-800/50'
                      : r.isClose
                      ? 'bg-yellow-900/20 border-yellow-800/50'
                      : 'bg-red-900/20 border-red-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-xs mb-1 truncate">{r.question}</p>
                      <div className="flex flex-wrap gap-2 items-center text-sm">
                        {r.isCorrect ? (
                          <span className="text-green-400 font-medium">✅ {r.studentAnswer}</span>
                        ) : r.isClose ? (
                          <>
                            <span className="text-yellow-400 font-medium">🤏 {r.studentAnswer}</span>
                            <span className="text-slate-500">→</span>
                            <span className="text-slate-300">{r.display}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-red-400 font-medium line-through">{r.studentAnswer}</span>
                            <span className="text-slate-500">→</span>
                            <span className="text-slate-300">{r.display}</span>
                          </>
                        )}
                        {r.isClose && (
                          <span className="bg-yellow-800 text-yellow-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                            Close!
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${r.pts > 0 ? 'text-brand-yellow' : 'text-slate-500'}`}>
                        +{r.pts.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Leaderboard sessionId={sessionId} />

          {/* Finish screen action buttons */}
          <div className="flex flex-col gap-3 mt-6 mb-8">
            {isDemoFlag ? (
              <>
                <button
                  onClick={() => {
                    setQIndex(0);
                    setTotalScore(0);
                    totalScoreRef.current = 0;
                    hintCountRef.current = 0;
                    demoHintCountRef.current = 0;
                    demoPendingTimers.current.forEach(clearTimeout);
                    demoPendingTimers.current = [];
                    setResults([]);
                    setInputValue('');
                    inputValueRef.current = '';
                    setShowHint(false);
                    setHintUsed(false);
                    setWordBankUsed([]);
                    setCountdown(3);
                    setPhase('waiting');
                  }}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-8 rounded-xl text-lg transition-all"
                >
                  🔄 Play Again
                </button>
                <a
                  href="/"
                  className="text-slate-400 hover:text-white text-sm text-center transition-colors"
                >
                  ← Back to Hub
                </a>
              </>
            ) : isTeacher ? (
              <>
                <a
                  href="/teacher"
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-8 rounded-xl text-lg transition-all text-center"
                >
                  🎮 Start New Session
                </a>
                <a
                  href="/"
                  className="text-slate-400 hover:text-white text-sm text-center transition-colors"
                >
                  ← Back to Hub
                </a>
              </>
            ) : (
              <>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                  <p className="text-slate-300 text-sm">⏳ Ask your teacher to start a new game</p>
                </div>
                <a
                  href="/join"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition-all text-center"
                >
                  🚪 Back to Lobby
                </a>
                <a
                  href="/"
                  className="text-slate-400 hover:text-white text-sm text-center transition-colors"
                >
                  ← Back to Hub
                </a>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // Playing / feedback screen
  // ---------------------------------------------------------------------------

  if (!question) return null; // safety guard
  const catInfo = CATEGORY_STYLES[question.category] ?? { label: question.category, cls: 'bg-slate-700 text-slate-300' };
  const isFeedback = phase === 'feedback';

  // Input border color during feedback
  const inputBorderClass = isFeedback
    ? feedbackKind === 'correct'
      ? 'border-green-400'
      : feedbackKind === 'close'
      ? 'border-yellow-400'
      : 'border-red-500'
    : 'border-slate-500 focus-within:border-yellow-400';

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 flex flex-col items-center">
      {/* Screen flash */}
      <AnimatePresence>
        {isFeedback && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`fixed inset-0 pointer-events-none z-50 ${
              feedbackKind === 'correct'
                ? 'bg-green-500'
                : feedbackKind === 'close'
                ? 'bg-yellow-500'
                : 'bg-red-600'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Score popup */}
      <AnimatePresence>
        {showScorePopup && (
          <motion.div
            key="scorepop"
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -90, scale: 1.15 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 text-center pointer-events-none"
          >
            <p className="text-5xl font-black text-brand-yellow drop-shadow-lg">
              +{feedbackPts.toLocaleString()}
            </p>
            {feedbackKind === 'correct' && feedbackPts > 1000 && (
              <p className="text-green-400 font-bold mt-1 text-lg">⚡ Speed bonus!</p>
            )}
            {feedbackKind === 'close' && (
              <p className="text-yellow-300 font-semibold mt-1">🤏 So close!</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      <div className="w-full max-w-2xl mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-brand-yellow font-bold">{totalScore.toLocaleString()} pts</span>
          <span className="text-slate-400 text-sm">
            {qIndex + 1} / {loadedQuestions.length}
          </span>
        </div>
        {/* Timer bar */}
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            style={{
              width: `${timeFraction * 100}%`,
              backgroundColor: timerColor,
              transition: timerTransition,
              height: '100%',
              borderRadius: '9999px',
            }}
          />
        </div>
        <div className="text-right mt-1">
          <span className="text-xs" style={{ color: timerColor }}>{timeRemaining}s</span>
        </div>
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={qIndex}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-2xl"
        >
          <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
            {/* Category badge */}
            <div className="mb-4">
              <span className={`${catInfo.cls} rounded-full px-3 py-1 text-xs font-semibold`}>
                {catInfo.label}
              </span>
            </div>

            {/* Question */}
            <h2 className="text-white font-bold text-2xl mb-6 leading-snug">{question.question}</h2>

            {/* Hint */}
            <div className="mb-4">
              <button
                onClick={handleHint}
                disabled={isFeedback || hintUsed}
                className="flex items-center gap-2 text-slate-400 hover:text-brand-yellow text-sm transition-colors disabled:opacity-40"
              >
                <span>💡</span>
                <span>
                  {hintUsed ? 'Hint used (-200 pts)' : 'Show hint (-200 pts)'}
                </span>
              </button>
              <AnimatePresence>
                {showHint && (
                  <motion.p
                    key="hint"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-slate-300 text-sm mt-2 bg-slate-700/50 rounded-lg px-3 py-2 border border-slate-600"
                  >
                    {question.hint}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Input */}
            <motion.div
              animate={inputShake ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              initial={{ opacity: 0 }}
              className="relative"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isFeedback}
                maxLength={50}
                placeholder="Type your answer in Spanish…"
                className={`bg-slate-700 border-2 ${inputBorderClass} rounded-xl text-white text-xl p-4 w-full transition-colors outline-none disabled:opacity-60`}
                style={
                  isFeedback && feedbackKind === 'correct'
                    ? { boxShadow: '0 0 0 4px rgba(74,222,128,0.25)' }
                    : undefined
                }
              />
            </motion.div>

            {/* Accent buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-1.5 mt-3"
            >
              {ACCENT_CHARS.map((ch, i) => (
                <motion.button
                  key={ch}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.03 }}
                  onClick={() => insertAccent(ch)}
                  disabled={isFeedback}
                  className="bg-slate-700 hover:bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-600 transition-colors disabled:opacity-30"
                >
                  {ch}
                </motion.button>
              ))}
            </motion.div>

            {/* Word bank */}
            {question.wordBank && !isFeedback && (
              <WordBank
                letters={question.wordBank}
                usedIndices={wordBankUsed}
                onLetterClick={handleBankLetter}
                onClear={handleClearBank}
              />
            )}

            {/* Submit button */}
            {!isFeedback && (
              <button
                onClick={() => handleSubmit('manual')}
                className="w-full mt-5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl px-8 py-4 text-lg transition-colors"
              >
                Submit ↩
              </button>
            )}

            {/* Feedback panel */}
            <AnimatePresence>
              {isFeedback && (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="mt-5"
                >
                  {feedbackKind === 'correct' && (
                    <div className="bg-green-900/30 border border-green-700 rounded-xl p-5 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.4 }}
                        className="text-5xl mb-2"
                      >
                        ✅
                      </motion.div>
                      <p className="text-green-300 font-bold text-xl">¡Correcto!</p>
                      {feedbackPts > 1000 ? (
                        <p className="text-slate-400 text-sm mt-1">
                          +1000 base &nbsp;+{feedbackPts - 1000} speed = {feedbackPts.toLocaleString()} pts
                        </p>
                      ) : (
                        <p className="text-slate-400 text-sm mt-1">+{feedbackPts} pts</p>
                      )}
                    </div>
                  )}

                  {feedbackKind === 'close' && (
                    <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-5 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.4 }}
                        className="text-5xl mb-2"
                      >
                        🤏
                      </motion.div>
                      <p className="text-yellow-300 font-bold text-xl">So close! +{feedbackPts} pts</p>
                      <p className="text-slate-400 text-sm mt-2">
                        You typed: <span className="text-yellow-300">{results.at(-1)?.studentAnswer}</span>
                        &nbsp;|&nbsp; Correct:{' '}
                        <span className="text-green-300">{question.display}</span>
                      </p>
                    </div>
                  )}

                  {(feedbackKind === 'wrong' || feedbackKind === 'timeout') && (
                    <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-5 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.4 }}
                        className="text-5xl mb-2"
                      >
                        {feedbackKind === 'timeout' ? '⏰' : '❌'}
                      </motion.div>
                      <p className="text-red-300 font-bold text-lg">
                        {feedbackKind === 'timeout' ? "Time's up!" : 'Incorrect'}
                      </p>
                      <p className="text-slate-400 text-sm mt-2">
                        {feedbackKind === 'timeout'
                          ? 'The answer was:'
                          : <>You typed: <span className="text-red-400 line-through">{results.at(-1)?.studentAnswer}</span> — correct:</>
                        }
                      </p>
                      <p className="text-white font-bold text-lg mt-1">{question.display}</p>
                    </div>
                  )}

                  <p className="text-slate-500 text-xs text-center mt-3">Next question in a moment…</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TypeAnswer;
