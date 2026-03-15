import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { isDemo as isDemoMode } from '../../../utils/sessionMode';
import { getCurrentTeacher } from '../../../firebase/teachers';
import { db } from '../../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSyncedCountdown } from '../../../hooks/useSyncedCountdown';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTimer } from '../../../hooks/useTimer';
import { updatePlayerScore } from '../../../firebase/leaderboard';
import Leaderboard from '../../shared/Leaderboard';
import { useSessionQuestions } from '../../../hooks/useSessionQuestions';
import { recordScoreIfLoggedIn } from '../../../utils/recordScore';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PUZZLES = [
  {
    id: 1,
    prompt: 'Order the days of the week in Spanish (Mon → Sun)',
    items: ['Miércoles', 'Lunes', 'Domingo', 'Martes', 'Jueves', 'Sábado', 'Viernes'],
    correctOrder: [1, 3, 0, 4, 6, 5, 2], // indices into items[] for correct seq
    hint: 'Lunes = Monday, the first day of the week in Spanish calendars',
    timeLimit: 45,
    type: 'sequence',
  },
  {
    id: 2,
    prompt: 'Build the sentence: "I want to eat a pizza"',
    items: ['quiero', 'pizza', 'Yo', 'comer', 'una'],
    correctOrder: [2, 0, 3, 4, 1],
    hint: 'Spanish word order: Subject → Verb → Infinitive → Object',
    timeLimit: 40,
    type: 'sentence',
  },
  {
    id: 3,
    prompt: 'Order the months Jan → Jun in Spanish',
    items: ['Marzo', 'Enero', 'Junio', 'Febrero', 'Mayo', 'Abril'],
    correctOrder: [1, 3, 0, 5, 4, 2],
    hint: 'Enero = January, the first month',
    timeLimit: 45,
    type: 'sequence',
  },
  {
    id: 4,
    prompt: 'Order numbers 1–5 in Spanish',
    items: ['Tres', 'Uno', 'Cinco', 'Dos', 'Cuatro'],
    correctOrder: [1, 3, 0, 4, 2],
    hint: 'Uno, Dos, Tres… like "uno dos tres" in the song!',
    timeLimit: 30,
    type: 'sequence',
  },
  {
    id: 5,
    prompt: 'Build the greeting: "Good morning, how are you?"',
    items: ['cómo', 'Buenos', 'estás?', 'días,'],
    correctOrder: [1, 3, 0, 2],
    hint: '"Buenos días" means Good Morning',
    timeLimit: 35,
    type: 'sentence',
  },
];

const TILE_BORDER_COLORS = [
  'border-blue-500',
  'border-purple-500',
  'border-yellow-400',
  'border-red-500',
  'border-green-500',
];

// ---------------------------------------------------------------------------
// Score helper
// ---------------------------------------------------------------------------

const calculatePuzzleScore = (studentOrder, correctOrder, timeRemaining, timeLimit) => {
  const totalTiles = correctOrder.length;
  const pointsPerTile = Math.round(1000 / totalTiles);
  let correctCount = 0;
  studentOrder.forEach((item, index) => {
    if (item === correctOrder[index]) correctCount++;
  });
  const baseScore = correctCount * pointsPerTile;
  const isFullyCorrect = correctCount === totalTiles;
  const speedBonus = isFullyCorrect ? Math.round((timeRemaining / timeLimit) * 500) : 0;
  return { score: baseScore + speedBonus, correctCount, isFullyCorrect };
};

// ---------------------------------------------------------------------------
// SortableTile
// ---------------------------------------------------------------------------

const SortableTile = ({ id, label, colorClass, disabled }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: disabled ? 'default' : 'grab',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-slate-700 border-2 ${colorClass} rounded-xl px-4 py-3 text-white font-semibold text-sm select-none shadow-md`}
    >
      {label}
    </div>
  );
};

// ---------------------------------------------------------------------------
// DragOverlayTile (ghost while dragging)
// ---------------------------------------------------------------------------

const DragOverlayTile = ({ label, colorClass }) => (
  <div
    className={`bg-slate-700 border-2 ${colorClass} rounded-xl px-4 py-3 text-white font-semibold text-sm shadow-2xl rotate-3 scale-105`}
  >
    {label}
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PuzzleSequencing = () => {
  const { sessionId = 'demo' } = useParams();
  const isDemoFlag = isDemoMode(sessionId);
  const currentAccount = getCurrentTeacher();
  const isTeacher = currentAccount?.role === "teacher";
  const { questions: loadedQuestions, loading: questionsLoading } = useSessionQuestions(sessionId, PUZZLES);
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

  // Synced countdown → start playing
  useEffect(() => {
    if (isReady && phase === 'waiting') {
      setPhase('playing');
    }
  }, [isReady, phase]);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [lastResult, setLastResult] = useState(null); // { score, correctCount, isFullyCorrect }
  const [showHint, setShowHint] = useState(false);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [activeId, setActiveId] = useState(null); // for DragOverlay
  const [timerTransition, setTimerTransition] = useState('width 1s linear');

  // ordered list of item indices (the student's current arrangement)
  const [orderedItems, setOrderedItems] = useState([]);

  const puzzle = loadedQuestions[puzzleIndex] ?? null;

  const totalScoreRef = useRef(0);
  const submitRef = useRef(null);

  // --- dnd-kit sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- timer ---
  const { timeRemaining, start: startTimer, reset: resetTimer } = useTimer(
    puzzle?.timeLimit ?? 30,
    () => submitRef.current?.()
  );

  const timeFraction = puzzle ? timeRemaining / puzzle.timeLimit : 1;
  const timerColor =
    timeFraction > 0.4 ? '#22c55e' : timeFraction > 0.2 ? '#fbbf24' : '#ef4444';

  // Keep submitRef always fresh
  const handleSubmit = useCallback(() => {
    if (phase !== 'playing') return;
    const result = calculatePuzzleScore(
      orderedItems,
      puzzle.correctOrder,
      timeRemaining,
      puzzle.timeLimit
    );
    const newTotal = totalScoreRef.current + result.score;
    totalScoreRef.current = newTotal;
    setTotalScore(newTotal);
    setLastResult(result);
    setPhase('feedback');
    setShowScorePopup(true);
    setTimeout(() => setShowScorePopup(false), 2000);
  }, [phase, orderedItems, puzzle, timeRemaining]);

  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  // Init ordered items when puzzle changes
  useEffect(() => {
    if (puzzle) {
      // Shuffle items into a random initial order (just 0..n-1 shuffled)
      const indices = puzzle.items.map((_, i) => i);
      // Simple deterministic shuffle so it's always "wrong" to start
      const shuffled = [...indices].sort(() => 0.5 - Math.random());
      setOrderedItems(shuffled);
    }
  }, [puzzleIndex, loadedQuestions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start timer (delayed to allow enter animation)
  useEffect(() => {
    if (phase === 'playing') {
      if (!puzzle) return;
      // Reset bar snap
      setTimerTransition('none');
      resetTimer(puzzle.timeLimit);
      const t = setTimeout(() => {
        setTimerTransition('width 1s linear');
        startTimer();
      }, 510);
      return () => clearTimeout(t);
    }
  }, [phase, puzzleIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Advance after feedback
  useEffect(() => {
    if (phase !== 'feedback') return;
    const t = setTimeout(async () => {
      if (puzzleIndex + 1 < loadedQuestions.length) {
        setPuzzleIndex((i) => i + 1);
        setShowHint(false);
        setPhase('playing');
      } else {
        // Game over
        if (!isDemoMode(sessionId)) {
          try {
            await updatePlayerScore(sessionId, nickname, totalScoreRef.current);
          } catch (_) {}
        }
        setPhase('finished');
        recordScoreIfLoggedIn(totalScoreRef.current);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- DnD handlers ---
  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setOrderedItems((items) => {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // Mobile: move tile up/down
  const moveTile = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= orderedItems.length) return;
    setOrderedItems((items) => arrayMove(items, index, newIndex));
  };

  // Active tile label for DragOverlay
  const activeTileIndex = activeId !== null ? activeId : null;
  const activeTileLabel =
    activeTileIndex !== null && puzzle ? puzzle.items[activeTileIndex] : '';
  const activeTileColor = activeTileIndex !== null
    ? TILE_BORDER_COLORS[activeTileIndex % TILE_BORDER_COLORS.length]
    : '';

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

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

  // ── Countdown screen (synced) ────────────────────────────────
  if (sessionStatus === 'active' && !isReady && syncedCountdown !== null) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-800 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl border border-slate-700"
        >
          <div className="text-7xl mb-4">🧩</div>
          <h1 className="text-3xl font-bold text-white mb-2">Puzzle Sequencing</h1>
          <p className="text-slate-400 mb-6">Drag tiles into the correct order</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={syncedCountdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-7xl font-black text-yellow-400 mb-6"
            >
              {syncedCountdown === 0 ? '🚀' : syncedCountdown}
            </motion.div>
          </AnimatePresence>
          <p className="text-slate-500 text-sm">All players are starting together</p>
        </motion.div>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-800 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl border border-slate-700"
        >
          <div className="text-7xl mb-4">🧩</div>
          <h1 className="text-3xl font-bold text-white mb-2">Puzzle Sequencing</h1>
          <p className="text-slate-400 mb-6">Drag tiles into the correct order</p>
          <div className="bg-slate-700 rounded-xl p-4 mb-8 text-left text-sm text-slate-300 space-y-1">
            <p>• Drag and drop tiles to arrange them</p>
            <p>• Partial credit for each correctly placed tile</p>
            <p>• Speed bonus for fully correct answers</p>
            <p>• Use 💡 for a hint if you're stuck</p>
          </div>
          <button
            onClick={() => setPhase('playing')}
            className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg transition-colors"
          >
            Start Game
          </button>
        </motion.div>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-800 rounded-2xl p-10 text-center max-w-lg w-full shadow-2xl border border-slate-700"
        >
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
          <p className="text-slate-400 mb-6">{loadedQuestions.length} puzzles completed</p>
          <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-6 mb-8">
            <p className="text-brand-yellow text-sm font-semibold uppercase tracking-widest mb-1">
              Final Score
            </p>
            <p className="text-brand-yellow text-5xl font-bold">
              {totalScore.toLocaleString()}
            </p>
          </div>
          <Leaderboard sessionId={sessionId} />
          {/* Finish screen action buttons */}
          <div className="flex flex-col gap-3 mt-6">
            {isDemoFlag ? (
              <>
                <button
                  onClick={() => {
                    setPuzzleIndex(0);
                    setTotalScore(0);
                    totalScoreRef.current = 0;
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
        </motion.div>
      </div>
    );
  }

  // playing | feedback
  if (!puzzle) return null; // safety guard
  const isFeedback = phase === 'feedback';
  const isCorrectFeedback = lastResult?.isFullyCorrect;

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 flex flex-col items-center">
      {/* Screen flash */}
      <AnimatePresence>
        {isFeedback && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className={`fixed inset-0 pointer-events-none z-50 ${
              isCorrectFeedback ? 'bg-green-500' : 'bg-red-600'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Score popup */}
      <AnimatePresence>
        {showScorePopup && lastResult && (
          <motion.div
            key="scorepop"
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 1.2 }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 text-center pointer-events-none"
          >
            <p className="text-5xl font-black text-brand-yellow drop-shadow-lg">
              +{lastResult.score.toLocaleString()}
            </p>
            {lastResult.isFullyCorrect && (
              <p className="text-green-400 font-bold mt-1">Perfect! ⚡ Speed bonus!</p>
            )}
            {!lastResult.isFullyCorrect && lastResult.correctCount > 0 && (
              <p className="text-yellow-300 font-semibold mt-1">
                {lastResult.correctCount}/{puzzle.items.length} correct
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full max-w-2xl mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-sm">
            Puzzle {puzzleIndex + 1} / {loadedQuestions.length}
          </span>
          <span className="text-brand-yellow font-bold">
            {totalScore.toLocaleString()} pts
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
          <span className="text-xs" style={{ color: timerColor }}>
            {timeRemaining}s
          </span>
        </div>
      </div>

      {/* Puzzle card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={puzzleIndex}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-2xl"
        >
          <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
            {/* Puzzle type badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-widest text-slate-500 bg-slate-700 px-2 py-1 rounded-md">
                {puzzle.type === 'sentence' ? '📝 Build the Sentence' : '🔢 Order the Sequence'}
              </span>
            </div>

            {/* Prompt */}
            <h2 className="text-white font-bold text-xl mb-6 leading-snug">{puzzle.prompt}</h2>

            {/* Hint */}
            <div className="mb-5">
              <button
                onClick={() => setShowHint((v) => !v)}
                disabled={isFeedback}
                className="flex items-center gap-2 text-slate-400 hover:text-brand-yellow text-sm transition-colors disabled:opacity-40"
              >
                <span>💡</span>
                <span>{showHint ? 'Hide hint' : 'Show hint'}</span>
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
                    {puzzle.hint}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* DnD zone */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedItems}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex flex-wrap gap-3 min-h-[56px] p-3 bg-slate-900/60 rounded-xl border border-slate-700 mb-4">
                  {orderedItems.map((itemIndex, pos) => {
                    const isCorrectPos = isFeedback && puzzle.correctOrder[pos] === itemIndex;
                    const isWrongPos = isFeedback && puzzle.correctOrder[pos] !== itemIndex;
                    const colorClass = TILE_BORDER_COLORS[itemIndex % TILE_BORDER_COLORS.length];

                    return (
                      <motion.div
                        key={itemIndex}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          x: isFeedback && isWrongPos ? [0, -6, 6, -4, 4, 0] : 0,
                          y: isFeedback && isCorrectPos ? [0, -8, 0] : 0,
                        }}
                        transition={{
                          delay: pos * 0.05,
                          x: isFeedback && isWrongPos
                            ? { duration: 0.4, delay: 0.1 }
                            : undefined,
                          y: isFeedback && isCorrectPos
                            ? { duration: 0.4, delay: 0.1, type: 'spring' }
                            : undefined,
                        }}
                        className="relative"
                      >
                        {/* Position number */}
                        <span className="absolute -top-2 -left-2 bg-slate-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold z-10">
                          {pos + 1}
                        </span>

                        {/* Feedback overlay */}
                        {isFeedback && (
                          <span className="absolute -top-2 -right-2 text-xs z-10">
                            {isCorrectPos ? '✅' : '❌'}
                          </span>
                        )}

                        <SortableTile
                          id={itemIndex}
                          label={puzzle.items[itemIndex]}
                          colorClass={colorClass}
                          disabled={isFeedback}
                        />

                        {/* Mobile up/down arrows */}
                        {!isFeedback && (
                          <div className="flex justify-center gap-1 mt-1 md:hidden">
                            <button
                              onClick={() => moveTile(pos, -1)}
                              disabled={pos === 0}
                              className="text-slate-500 hover:text-white disabled:opacity-20 text-xs px-1"
                            >
                              ◀
                            </button>
                            <button
                              onClick={() => moveTile(pos, 1)}
                              disabled={pos === orderedItems.length - 1}
                              className="text-slate-500 hover:text-white disabled:opacity-20 text-xs px-1"
                            >
                              ▶
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeId !== null && (
                  <DragOverlayTile label={activeTileLabel} colorClass={activeTileColor} />
                )}
              </DragOverlay>
            </DndContext>

            {/* Feedback correct order */}
            <AnimatePresence>
              {isFeedback && !isCorrectFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 bg-green-900/30 border border-green-700/50 rounded-xl p-3"
                >
                  <p className="text-green-400 text-xs font-semibold uppercase tracking-widest mb-2">
                    Correct Order
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {puzzle.correctOrder.map((itemIndex, pos) => (
                      <div
                        key={pos}
                        className="flex items-center gap-1 bg-slate-700 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-slate-400 text-xs">{pos + 1}.</span>
                        <span className="text-white text-sm font-medium">
                          {puzzle.items[itemIndex]}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            {!isFeedback && (
              <motion.button
                onClick={handleSubmit}
                whileTap={{ scale: 0.97 }}
                className="w-full mt-5 bg-brand-red hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg transition-colors"
              >
                Submit Order ✓
              </motion.button>
            )}

            {/* Feedback message */}
            {isFeedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`mt-5 text-center p-4 rounded-xl font-bold text-lg ${
                  isCorrectFeedback
                    ? 'bg-green-800/40 text-green-300 border border-green-700'
                    : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                }`}
              >
                {isCorrectFeedback
                  ? '🎉 Perfect order!'
                  : `${lastResult.correctCount}/${puzzle.items.length} tiles in the right spot`}
                <p className="text-sm font-normal mt-1 text-slate-400">
                  Next puzzle in a moment…
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PuzzleSequencing;
