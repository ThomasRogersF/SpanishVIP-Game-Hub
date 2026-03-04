import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactWordcloud from 'react-wordcloud';
import { useTimer } from '../../../hooks/useTimer';
import { normalizeString } from '../../../utils/stringMatcher';
import Leaderboard from '../../shared/Leaderboard';

// ── Constants ────────────────────────────────────────────────────────

const SAMPLE_PROMPTS = [
  {
    id: 1,
    prompt: "Write one Spanish word you already know",
    timeLimit: 30,
    hasCorrectAnswer: false,
    category: 'poll',
  },
  {
    id: 2,
    prompt: "How do you say 'THANK YOU' in Spanish? (one word)",
    timeLimit: 20,
    hasCorrectAnswer: true,
    acceptedAnswers: ['gracias'],
    category: 'quiz',
  },
  {
    id: 3,
    prompt: "Name a Spanish-speaking country",
    timeLimit: 25,
    hasCorrectAnswer: false,
    category: 'poll',
  },
  {
    id: 4,
    prompt: "What is 'WATER' in Spanish? (one word)",
    timeLimit: 20,
    hasCorrectAnswer: true,
    acceptedAnswers: ['agua'],
    category: 'quiz',
  },
  {
    id: 5,
    prompt: "Describe learning Spanish in ONE word",
    timeLimit: 30,
    hasCorrectAnswer: false,
    category: 'poll',
  },
];

// Simulated classmate responses per prompt (added with staggered delays)
const DEMO_RESPONSES = [
  ['hola', 'gracias', 'hola', 'amigo', 'buenos', 'hola', 'español', 'gracias', 'casa', 'amigo'],
  ['gracias', 'gracias', 'gracias', 'thank you', 'gracias', 'gracia', 'gracias'],
  ['Mexico', 'Spain', 'Mexico', 'Colombia', 'Mexico', 'Argentina', 'Spain', 'Cuba'],
  ['agua', 'agua', 'agua', 'water', 'agua', 'agwa', 'agua'],
  ['fun', 'difícil', 'interesting', 'fun', 'cool', 'difícil', 'amazing', 'fun'],
];

const ACCENT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'];

// Colors for poll-mode word cloud (hashed per word for consistency)
const POLL_COLORS = ['#DC2626', '#FBBF24', '#FFFFFF', '#F97316', '#FDE68A'];

const WORD_CLOUD_OPTIONS = {
  colors: POLL_COLORS,
  enableTooltip: false,
  deterministic: false,
  fontFamily: 'Inter, sans-serif',
  fontSizes: [20, 90],
  fontStyle: 'normal',
  fontWeight: 'bold',
  padding: 4,
  rotations: 2,
  rotationAngles: [0, 90],
  scale: 'sqrt',
  spiral: 'archimedean',
  transitionDuration: 1000,
};

// ── Helper: CategoryBadge ────────────────────────────────────────────
const CategoryBadge = ({ category }) => (
  <span
    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      category === 'quiz'
        ? 'bg-brand-yellow/20 text-brand-yellow'
        : 'bg-blue-500/20 text-blue-400'
    }`}
  >
    {category === 'quiz' ? '🎯 QUIZ' : '📊 POLL'}
  </span>
);

// ── Main component ────────────────────────────────────────────────────
const WordCloudGame = () => {
  const navigate = useNavigate();
  const { sessionId = 'demo' } = useParams();
  const nickname = localStorage.getItem('svip_nickname') || 'Player';

  // ── Phase state machine: waiting → inputting → revealing → …→ finished
  const [phase, setPhase] = useState('waiting');
  const [countdown, setCountdown] = useState(3);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);

  // Input state
  const [inputText, setInputText] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [lastPoints, setLastPoints] = useState(null);

  // Responses: { [promptIndex]: { [responderId]: { answer: string } } }
  const [responses, setResponses] = useState({});

  // Scoring
  const [totalScore, setTotalScore] = useState(0);
  const totalScoreRef = useRef(0);

  // Revealing sub-state
  const [showWordCloud, setShowWordCloud] = useState(false);

  // Timer bar transition control
  const [timerTransition, setTimerTransition] = useState('none');

  // Refs
  const inputRef = useRef(null);
  const advanceRef = useRef(null);

  // ── Always-fresh advance callback ────────────────────────────────
  useEffect(() => {
    advanceRef.current = () => {
      const next = currentPromptIndex + 1;
      if (next >= SAMPLE_PROMPTS.length) {
        setPhase('finished');
      } else {
        setCurrentPromptIndex(next);
        setInputText('');
        setHasSubmitted(false);
        setLastPoints(null);
        setPhase('inputting');
      }
    };
  });

  // ── Timer ────────────────────────────────────────────────────────
  const handleTimeUp = () => {
    if (phase !== 'inputting') return;
    setPhase('revealing');
  };

  const { timeRemaining, start, reset } = useTimer(30, handleTimeUp);

  // ── Waiting countdown ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'waiting') return;
    if (countdown <= 0) {
      const t = setTimeout(() => setPhase('inputting'), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Start timer + focus input on each inputting phase ───────────
  useEffect(() => {
    if (phase !== 'inputting') return;
    const timeLimit = SAMPLE_PROMPTS[currentPromptIndex].timeLimit;
    setTimerTransition('none');
    reset(timeLimit);
    const t = setTimeout(() => {
      setTimerTransition('width 0.95s linear');
      start();
      inputRef.current?.focus();
    }, 510);
    return () => clearTimeout(t);
  }, [phase, currentPromptIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Demo mode: stagger fake classmate responses during inputting ─
  useEffect(() => {
    if (phase !== 'inputting' || sessionId !== 'demo') return;

    const demoAnswers = DEMO_RESPONSES[currentPromptIndex] || [];
    const timeouts = demoAnswers.map((answer, i) => {
      // Spread responses over first ~80% of time limit
      const delay = 1500 + i * 1100 + Math.random() * 600;
      return setTimeout(() => {
        setResponses((prev) => ({
          ...prev,
          [currentPromptIndex]: {
            ...(prev[currentPromptIndex] || {}),
            [`demo_${i}`]: { answer },
          },
        }));
      }, delay);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [phase, currentPromptIndex, sessionId]);

  // ── Revealing: delayed word cloud appearance + auto-advance ─────
  useEffect(() => {
    if (phase !== 'revealing') return;
    setShowWordCloud(false);
    const t1 = setTimeout(() => setShowWordCloud(true), 1000);
    const t2 = setTimeout(() => advanceRef.current?.(), 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, currentPromptIndex]);

  // ── Computed values ──────────────────────────────────────────────
  const currentPrompt = SAMPLE_PROMPTS[currentPromptIndex];
  const currentTimeLimit = currentPrompt.timeLimit;
  const barPct = currentTimeLimit > 0 ? (timeRemaining / currentTimeLimit) * 100 : 0;
  const barColor =
    timeRemaining <= 5 ? 'bg-red-500' : timeRemaining <= 10 ? 'bg-yellow-400' : 'bg-green-500';
  const responseCount = Object.keys(responses[currentPromptIndex] || {}).length;

  // Aggregate responses for the current prompt into word cloud data
  const wordData = useMemo(() => {
    const promptResponses = responses[currentPromptIndex] || {};
    const allAnswers = Object.values(promptResponses)
      .map((r) => r?.answer?.trim())
      .filter(Boolean);

    const freq = {};
    const display = {};

    allAnswers.forEach((answer) => {
      const normalized = normalizeString(answer);
      if (!normalized) return;
      freq[normalized] = (freq[normalized] || 0) + 1;
      if (!display[normalized]) display[normalized] = answer;
    });

    return Object.entries(freq)
      .filter(([, count]) => count > 0)
      .map(([normalized, count]) => ({ text: display[normalized], value: count }));
  }, [responses, currentPromptIndex]);

  // Per-word color: green=correct, gray=wrong (quiz), hashed palette (poll)
  const getWordColor = useCallback(
    (word) => {
      const prompt = SAMPLE_PROMPTS[currentPromptIndex];
      if (prompt.hasCorrectAnswer && prompt.acceptedAnswers) {
        const isCorrect = prompt.acceptedAnswers.some(
          (a) => normalizeString(a) === normalizeString(word.text)
        );
        return isCorrect ? '#22c55e' : '#64748b';
      }
      const hash = word.text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return POLL_COLORS[hash % POLL_COLORS.length];
    },
    [currentPromptIndex]
  );

  const wordCloudCallbacks = useMemo(() => ({ getWordColor }), [getWordColor]);

  // Top N most common answers for a given prompt (for recap)
  const getTopAnswers = (promptIndex, n = 3) => {
    const promptResponses = responses[promptIndex] || {};
    const freq = {};
    Object.values(promptResponses)
      .map((r) => r?.answer?.trim())
      .filter(Boolean)
      .forEach((answer) => {
        const normalized = normalizeString(answer);
        if (normalized) freq[normalized] = { count: (freq[normalized]?.count || 0) + 1, display: answer };
      });
    return Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  };

  // ── Handlers ─────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (hasSubmitted || !inputText.trim()) return;

    const trimmed = inputText.trim();
    const normalized = normalizeString(trimmed);

    let points = 0;
    if (currentPrompt.hasCorrectAnswer) {
      const isCorrect =
        currentPrompt.acceptedAnswers?.some((a) => normalizeString(a) === normalized) ?? false;
      points = isCorrect ? 800 : 0;
    } else {
      points = 200; // participation
    }

    const newTotal = totalScoreRef.current + points;
    totalScoreRef.current = newTotal;

    setTotalScore(newTotal);
    setLastPoints(points);
    setHasSubmitted(true);

    setResponses((prev) => ({
      ...prev,
      [currentPromptIndex]: {
        ...(prev[currentPromptIndex] || {}),
        [nickname]: { answer: trimmed },
      },
    }));
  };

  // Insert accent character at current cursor position
  const insertAccent = (char) => {
    if (hasSubmitted) return;
    const input = inputRef.current;
    const start = input?.selectionStart ?? inputText.length;
    const end = input?.selectionEnd ?? inputText.length;
    const newText = (inputText.slice(0, start) + char + inputText.slice(end)).slice(0, 20);
    setInputText(newText);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(start + 1, start + 1);
        inputRef.current.focus();
      }
    });
  };

  const handlePlayAgain = () => {
    totalScoreRef.current = 0;
    setCurrentPromptIndex(0);
    setTotalScore(0);
    setInputText('');
    setHasSubmitted(false);
    setLastPoints(null);
    setResponses({});
    setShowWordCloud(false);
    setCountdown(3);
    setPhase('waiting');
  };

  // ── WAITING SCREEN ───────────────────────────────────────────────
  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col">
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <span className="text-slate-400 font-semibold">Word Cloud ☁️</span>
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
              {SAMPLE_PROMPTS.length} prompts · type your answers
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── FINISHED SCREEN ──────────────────────────────────────────────
  if (phase === 'finished') {
    const totalResponsesAcrossGame = SAMPLE_PROMPTS.reduce(
      (sum, _, i) => sum + Object.keys(responses[i] || {}).length,
      0
    );
    const maxPossible = SAMPLE_PROMPTS.length * (DEMO_RESPONSES[0].length + 1);
    const participationPct = Math.min(
      Math.round((totalResponsesAcrossGame / maxPossible) * 100),
      97
    );
    const promptsAnswered = SAMPLE_PROMPTS.filter((_, i) => responses[i]?.[nickname]).length;

    return (
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-[#0f172a] overflow-y-auto"
      >
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <span className="text-slate-400 font-semibold">🎉 Game Complete!</span>
        </nav>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {/* Score card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.55 }}
            className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700 shadow-xl"
          >
            <div className="text-6xl mb-3">🎉</div>
            <p className="text-brand-yellow text-xs font-bold uppercase tracking-widest mb-1">
              Final Score
            </p>
            <p className="text-6xl font-black text-white mb-6">{totalScore.toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-2xl font-black text-white">
                  {promptsAnswered}/{SAMPLE_PROMPTS.length}
                </p>
                <p className="text-slate-400 text-xs mt-1">prompts answered</p>
              </div>
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-2xl font-black text-brand-yellow">{participationPct}%</p>
                <p className="text-slate-400 text-xs mt-1">class participation</p>
              </div>
            </div>
          </motion.div>

          {/* Prompt recap */}
          <div className="space-y-3">
            <h2 className="text-slate-400 text-sm font-bold uppercase tracking-widest">
              Prompts Recap
            </h2>
            {SAMPLE_PROMPTS.map((prompt, i) => {
              const top = getTopAnswers(i);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-slate-800 rounded-xl p-5 border border-slate-700"
                >
                  <div className="flex items-start gap-2 mb-3">
                    <CategoryBadge category={prompt.category} />
                    <p className="text-white font-semibold text-sm leading-snug flex-1">
                      {prompt.prompt}
                    </p>
                  </div>

                  {top.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {top.map(({ display, count }, rank) => (
                        <span
                          key={display}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                            rank === 0
                              ? 'bg-brand-red/20 text-brand-red border border-brand-red/30'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {display} ×{count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs">No responses recorded</p>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Leaderboard */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <Leaderboard sessionId={sessionId} />
          </div>

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
      </motion.div>
    );
  }

  // ── REVEALING SCREEN ─────────────────────────────────────────────
  if (phase === 'revealing') {
    const isLastPrompt = currentPromptIndex >= SAMPLE_PROMPTS.length - 1;

    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col">
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <div className="flex items-center gap-3">
            <CategoryBadge category={currentPrompt.category} />
            <span className="text-slate-400 text-sm font-medium">
              Prompt {currentPromptIndex + 1} of {SAMPLE_PROMPTS.length}
            </span>
          </div>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AnimatePresence mode="wait">
            {!showWordCloud ? (
              /* "Revealing answers..." pulsing text */
              <motion.div
                key="revealing-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center"
              >
                <motion.p
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                  className="text-3xl font-bold text-white mb-3"
                >
                  ☁️ Revealing answers...
                </motion.p>
                <p className="text-slate-500 text-sm">
                  {responseCount} {responseCount === 1 ? 'student' : 'students'} responded
                </p>
              </motion.div>
            ) : (
              /* Word cloud + stats */
              <motion.div
                key="word-cloud-view"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="w-full max-w-3xl"
              >
                {/* Prompt recap bar */}
                <div className="bg-slate-800 rounded-2xl px-6 py-4 text-center mb-4 border border-slate-700">
                  <p className="text-slate-300 text-sm leading-snug mb-1">{currentPrompt.prompt}</p>
                  <p className="text-slate-500 text-xs">
                    <span className="text-brand-yellow font-bold">{responseCount}</span>{' '}
                    {responseCount === 1 ? 'student' : 'students'} responded
                    {currentPrompt.hasCorrectAnswer && (
                      <span className="ml-2 text-slate-600">· 🟢 correct · 🩶 other</span>
                    )}
                  </p>
                </div>

                {/* Word cloud */}
                {wordData.length > 0 ? (
                  <div
                    className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
                    style={{ height: '380px', width: '100%' }}
                  >
                    <ReactWordcloud
                      words={wordData}
                      options={WORD_CLOUD_OPTIONS}
                      callbacks={wordCloudCallbacks}
                    />
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-2xl border border-slate-700 h-64 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-5xl mb-3">🤔</div>
                      <p className="text-slate-500">No responses collected yet</p>
                    </div>
                  </div>
                )}

                {/* Next button */}
                <div className="mt-6 text-center">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => advanceRef.current?.()}
                    className="bg-brand-yellow hover:bg-yellow-300 text-black font-bold px-10 py-4 rounded-xl transition-colors text-lg shadow-lg"
                  >
                    {isLastPrompt ? '🏁 See Final Results →' : 'Next Prompt →'}
                  </motion.button>
                  <p className="text-slate-600 text-xs mt-2">Auto-advances in a few seconds</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── INPUTTING SCREEN ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* Stats bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0">
        {/* Score */}
        <div className="w-20">
          <p className="text-slate-500 text-xs leading-none mb-0.5">Score</p>
          <p className="text-brand-yellow font-black text-xl leading-none">
            {totalScore.toLocaleString()}
          </p>
        </div>

        {/* Prompt counter + progress dots */}
        <div className="text-center">
          <p className="text-white font-semibold text-sm leading-none mb-1.5">
            Prompt {currentPromptIndex + 1}
            <span className="text-slate-500"> of {SAMPLE_PROMPTS.length}</span>
          </p>
          <div className="flex gap-1 justify-center">
            {SAMPLE_PROMPTS.map((_, i) => (
              <div
                key={i}
                className={`h-1 w-4 rounded-full transition-colors duration-300 ${
                  i < currentPromptIndex
                    ? 'bg-brand-yellow'
                    : i === currentPromptIndex
                    ? 'bg-white'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Category badge */}
        <div className="w-20 flex justify-end">
          <CategoryBadge category={currentPrompt.category} />
        </div>
      </div>

      {/* Timer bar — horizontal, depletes left to right, red under 5 s */}
      <div className="h-3 bg-slate-700 flex-shrink-0">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${barPct}%`, transition: timerTransition }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPromptIndex}
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -60, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {/* Prompt card */}
              <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700 shadow-xl mb-6">
                <p className="text-2xl md:text-3xl font-bold text-white leading-snug">
                  {currentPrompt.prompt}
                </p>
                {currentPrompt.hasCorrectAnswer && (
                  <p className="text-slate-500 text-xs mt-2">quiz mode — exact match scores 800 pts</p>
                )}
              </div>

              {/* Input area or submitted message */}
              {!hasSubmitted ? (
                <div className="space-y-3">
                  {/* Text input */}
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      maxLength={20}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      placeholder="Type your answer..."
                      className="w-full bg-slate-700 border-2 border-slate-500 focus:border-brand-yellow text-white text-xl p-4 rounded-xl outline-none transition-colors placeholder:text-slate-500"
                    />
                    <span className="absolute bottom-3 right-3 text-slate-500 text-xs font-mono pointer-events-none">
                      {inputText.length} / 20
                    </span>
                  </div>

                  {/* Spanish accent buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {ACCENT_CHARS.map((char) => (
                      <button
                        key={char}
                        onClick={() => insertAccent(char)}
                        className="bg-slate-700 hover:bg-slate-600 text-white rounded px-2.5 py-1.5 text-sm font-bold transition-colors"
                      >
                        {char}
                      </button>
                    ))}
                  </div>

                  {/* Submit */}
                  <motion.button
                    whileHover={inputText.trim() ? { scale: 1.02 } : {}}
                    whileTap={inputText.trim() ? { scale: 0.98 } : {}}
                    onClick={handleSubmit}
                    disabled={!inputText.trim()}
                    className="w-full bg-brand-yellow hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl px-8 py-4 text-lg transition-colors shadow-lg"
                  >
                    Submit Answer →
                  </motion.button>
                </div>
              ) : (
                /* ✅ Submitted state */
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg"
                >
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-white font-bold text-lg mb-1">Answer submitted!</p>
                  {lastPoints !== null && lastPoints > 0 && (
                    <p className="text-brand-yellow font-black text-2xl mb-1">
                      +{lastPoints} pts
                    </p>
                  )}
                  {lastPoints === 0 && currentPrompt.hasCorrectAnswer && (
                    <p className="text-slate-400 text-sm mb-1">Not quite — try the next one!</p>
                  )}
                  <p className="text-slate-500 text-sm mt-1">
                    Wait for the word cloud reveal...
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Live response counter — ticks up as classmates answer */}
          <div className="mt-5 text-center">
            <p className="text-slate-500 text-sm">
              <motion.span
                key={responseCount}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="font-black text-brand-yellow inline-block"
              >
                {responseCount}
              </motion.span>{' '}
              {responseCount === 1 ? 'student has' : 'students have'} answered
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordCloudGame;
