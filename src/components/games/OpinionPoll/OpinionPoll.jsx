import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTimer } from '../../../hooks/useTimer';
import { updatePlayerScore } from '../../../firebase/leaderboard';
import { rtdb, db } from '../../../firebase/config';
import { ref, set, onValue, off } from 'firebase/database';
import { doc, onSnapshot } from 'firebase/firestore';
import Leaderboard from '../../shared/Leaderboard';
import { isDemo as isDemoCheck } from '../../../utils/sessionMode';
import { getCurrentTeacher } from '../../../firebase/teachers';
import { useSyncedCountdown } from '../../../hooks/useSyncedCountdown';
import { useSessionQuestions } from '../../../hooks/useSessionQuestions';
import { recordScoreIfLoggedIn } from '../../../utils/recordScore';

// ── Data ─────────────────────────────────────────────────────────────
const samplePolls = [
  {
    id: 1,
    question: 'Which Spanish-speaking country would you most like to visit?',
    options: ['🇲🇽 Mexico', '🇪🇸 Spain', '🇨🇴 Colombia', '🇦🇷 Argentina'],
    timeLimit: 20,
    discussionPrompt: 'Why did you choose that country? What do you know about it?',
    category: 'culture',
  },
  {
    id: 2,
    question: 'How do you prefer to practice Spanish?',
    options: ['📱 Apps', '🎬 Movies/TV', '💬 Conversation', '📚 Textbooks'],
    timeLimit: 20,
    discussionPrompt: 'Which method has worked best for you so far?',
    category: 'learning',
  },
  {
    id: 3,
    question: "What's your favorite Spanish food?",
    options: ['🌮 Tacos', '🥘 Paella', '🫔 Arepas', '🥩 Asado'],
    timeLimit: 20,
    discussionPrompt: 'Have you tried any of these? Which would you recommend?',
    category: 'food',
  },
  {
    id: 4,
    question: 'How confident are you speaking Spanish right now?',
    options: ['😰 Not at all', '🙂 A little', '😊 Getting there', '😎 Pretty confident'],
    timeLimit: 20,
    discussionPrompt: 'What would help you feel more confident?',
    category: 'self-assessment',
  },
  {
    id: 5,
    question: 'Which Spanish word do you find hardest to pronounce?',
    options: [
      '🗣️ Perro (dog)',
      '🗣️ Rojo (red)',
      '🗣️ Jirafa (giraffe)',
      '🗣️ Murciélago (bat)',
    ],
    timeLimit: 20,
    discussionPrompt: "Let's practice these together — repeat after me!",
    category: 'pronunciation',
  },
];

// Votes per option for 8 simulated students per poll (sums to SIMULATED_STUDENTS)
const demoVoteDistributions = [
  [3, 2, 1, 2], // poll 0
  [2, 3, 3, 1], // poll 1
  [4, 1, 2, 1], // poll 2
  [1, 2, 4, 1], // poll 3
  [1, 2, 3, 2], // poll 4
];

// ── Constants ─────────────────────────────────────────────────────────
const PARTICIPATION_POINTS = 200;
const MAJORITY_BONUS = 50;
const MINORITY_BONUS = 100;
const SIMULATED_STUDENTS = 8;

const OPTION_COLORS = ['#3B82F6', '#10B981', '#FBBF24', '#EF4444'];

const OPTION_BG = [
  'bg-blue-600 hover:bg-blue-500',
  'bg-green-600 hover:bg-green-500',
  'bg-yellow-500 hover:bg-yellow-400 text-black',
  'bg-red-600 hover:bg-red-500',
];

const CATEGORY_COLORS = {
  culture: 'bg-orange-500',
  learning: 'bg-blue-500',
  food: 'bg-green-500',
  'self-assessment': 'bg-purple-500',
  pronunciation: 'bg-red-500',
};

// ── Helpers ───────────────────────────────────────────────────────────
function buildDemoSchedule(distribution) {
  // Expand distribution into flat list of option indices
  const votes = [];
  distribution.forEach((count, optionIndex) => {
    for (let i = 0; i < count; i++) votes.push(optionIndex);
  });
  // Fisher-Yates shuffle
  for (let i = votes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [votes[i], votes[j]] = [votes[j], votes[i]];
  }
  // Assign random times in [3000, 12000] ms, sorted ascending
  return votes
    .map((optionIndex) => ({
      optionIndex,
      time: Math.floor(Math.random() * 9000) + 3000,
    }))
    .sort((a, b) => a.time - b.time);
}

function stripEmoji(str) {
  // Remove first word (emoji) + space for chart axis labels
  const parts = str.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : str;
}

// ── Component ─────────────────────────────────────────────────────────
const OpinionPoll = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { questions: loadedQuestions, loading: questionsLoading } = useSessionQuestions(sessionId, samplePolls);
  const nickname = localStorage.getItem('svip_nickname') || 'Player';
  const isDemo = isDemoCheck(sessionId);
  const currentAccount = getCurrentTeacher();
  const isTeacher = currentAccount?.role === "teacher";
  const [sessionStatus, setSessionStatus] = useState('checking');
  const { countdown: syncedCountdown, isReady } = useSyncedCountdown(sessionId);

  useEffect(() => {
    if (isDemo) {
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
  }, [sessionId, isDemo]);

  // Phase state machine: waiting → voting → revealing → discussing → finished
  const [phase, setPhase] = useState('waiting');
  const [currentPollIndex, setCurrentPollIndex] = useState(0);
  const [voteCounts, setVoteCounts] = useState(() =>
    Array(samplePolls[0]?.options?.length ?? 4).fill(0)
  );
  const [myVote, setMyVote] = useState(null); // option index or null
  const [pollResults, setPollResults] = useState([]); // per-poll recap
  const [totalPoints, setTotalPoints] = useState(0);
  const [timerTransition, setTimerTransition] = useState('none');
  const [allVoted, setAllVoted] = useState(false);
  const [currentPollBonus, setCurrentPollBonus] = useState(null); // {pts, label}
  const [simulatedVoterCount, setSimulatedVoterCount] = useState(0);

  // Refs for non-stale callbacks
  const demoTimeoutsRef = useRef([]);
  const totalPointsRef = useRef(0);
  const phaseRef = useRef('waiting');
  const myVoteRef = useRef(null);
  const voteCountsRef = useRef(Array(samplePolls[0]?.options?.length ?? 4).fill(0));
  const simulatedCountRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { myVoteRef.current = myVote; }, [myVote]);
  useEffect(() => { voteCountsRef.current = voteCounts; }, [voteCounts]);

  // Always-fresh advance function (runs after every render to capture latest poll index)
  const advanceRef = useRef(null);
  useEffect(() => {
    advanceRef.current = (finalVoteCounts, finalMyVote) => {
      // Synchronously update phaseRef so pending demo timeouts bail out immediately
      phaseRef.current = 'revealing';

      const nonZero = finalVoteCounts.filter((v) => v > 0);
      const maxVotes = nonZero.length > 0 ? Math.max(...finalVoteCounts) : 0;
      const minVotes = nonZero.length > 0 ? Math.min(...nonZero) : 0;

      let bonus = 0;
      let bonusLabel = null;
      if (finalMyVote !== null) {
        bonus = PARTICIPATION_POINTS;
        if (finalVoteCounts[finalMyVote] === maxVotes) {
          bonus += MAJORITY_BONUS;
          bonusLabel = 'With the crowd! 🎉';
        } else if (finalVoteCounts[finalMyVote] === minVotes && nonZero.length > 1) {
          bonus += MINORITY_BONUS;
          bonusLabel = 'Unique opinion! 🦄';
        }
      }

      const newTotal = totalPointsRef.current + bonus;
      totalPointsRef.current = newTotal;
      setTotalPoints(newTotal);
      setCurrentPollBonus(bonus > 0 ? { pts: bonus, label: bonusLabel } : null);

      setPollResults((prev) => [
        ...prev,
        { voteCounts: [...finalVoteCounts], myVote: finalMyVote, pollBonus: bonus },
      ]);

      setPhase('revealing');
    };
  });

  // ── Timer ─────────────────────────────────────────────────────────
  const handleTimeUp = () => {
    if (phaseRef.current !== 'voting') return;
    advanceRef.current?.(voteCountsRef.current, myVoteRef.current);
  };

  const { timeRemaining, start, pause, reset } = useTimer(
    loadedQuestions[currentPollIndex]?.timeLimit ?? 20,
    handleTimeUp
  );

  // ── Synced countdown → start voting ───────────────────────────────
  useEffect(() => {
    if (isReady && phase === 'waiting') {
      const t = setTimeout(() => setPhase('voting'), 500);
      return () => clearTimeout(t);
    }
  }, [isReady, phase]);

  // ── Effect 2: Reset + start timer on each voting phase ──────────
  useEffect(() => {
    if (phase !== 'voting') return;
    setTimerTransition('none');
    reset(loadedQuestions[currentPollIndex]?.timeLimit ?? 20);
    const t = setTimeout(() => {
      setTimerTransition('width 0.95s linear');
      start();
    }, 510);
    return () => clearTimeout(t);
  }, [phase, currentPollIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 3: Demo vote simulation ──────────────────────────────
  useEffect(() => {
    if (phase !== 'voting' || !isDemo) return;

    simulatedCountRef.current = 0;
    setSimulatedVoterCount(0);

    const schedule = buildDemoSchedule(demoVoteDistributions[currentPollIndex]);
    const timeouts = [];

    schedule.forEach(({ optionIndex, time }, scheduleIndex) => {
      const t = setTimeout(() => {
        if (phaseRef.current !== 'voting') return;

        setVoteCounts((prev) => {
          const next = [...prev];
          next[optionIndex]++;
          voteCountsRef.current = next;
          return next;
        });

        simulatedCountRef.current++;
        setSimulatedVoterCount(simulatedCountRef.current);

        // After last simulated student votes, check if player also voted
        if (scheduleIndex === schedule.length - 1) {
          if (myVoteRef.current !== null && phaseRef.current === 'voting') {
            setAllVoted(true);
          }
        }
      }, time);
      timeouts.push(t);
    });

    demoTimeoutsRef.current = timeouts;
    return () => timeouts.forEach(clearTimeout);
  }, [phase, currentPollIndex, isDemo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 4: All voted → auto-advance after 1s ─────────────────
  useEffect(() => {
    if (!allVoted || phase !== 'voting') return;
    const t = setTimeout(() => {
      if (phaseRef.current === 'voting') {
        pause();
        advanceRef.current?.(voteCountsRef.current, myVoteRef.current);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [allVoted, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 5: Revealing → discussing after chart animates ────────
  useEffect(() => {
    if (phase !== 'revealing') return;
    const t = setTimeout(() => setPhase('discussing'), 2000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Effect 6: Firebase live vote subscription (non-demo) ─────────
  useEffect(() => {
    if (isDemo || phase !== 'voting') return;

    const votesRef = ref(rtdb, `polls/${sessionId}/poll${currentPollIndex}/votes`);
    const handler = (snapshot) => {
      const data = snapshot.val() || {};
      const counts = Array(loadedQuestions[currentPollIndex]?.options?.length ?? 4).fill(0);
      Object.values(data).forEach(({ optionIndex }) => {
        if (optionIndex >= 0 && optionIndex < counts.length) counts[optionIndex]++;
      });
      setVoteCounts(counts);
      voteCountsRef.current = counts;
      const totalVoted = counts.reduce((a, b) => a + b, 0);
      setSimulatedVoterCount(totalVoted - (myVoteRef.current !== null ? 1 : 0));
    };

    onValue(votesRef, handler);
    return () => off(votesRef, 'value', handler);
  }, [phase, currentPollIndex, isDemo, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────
  const handleVote = (optionIndex) => {
    if (phase !== 'voting' || myVote !== null) return;

    setMyVote(optionIndex);
    myVoteRef.current = optionIndex;

    setVoteCounts((prev) => {
      const next = [...prev];
      next[optionIndex]++;
      voteCountsRef.current = next;
      return next;
    });

    // If all simulated students already voted, we're done
    if (simulatedCountRef.current >= SIMULATED_STUDENTS) {
      setAllVoted(true);
    }

    if (!isDemo) {
      set(
        ref(rtdb, `polls/${sessionId}/poll${currentPollIndex}/votes/${nickname}`),
        { optionIndex, timestamp: Date.now() }
      ).catch((err) => console.warn('Vote write skipped:', err.message));
    }
  };

  const handleNextPoll = () => {
    demoTimeoutsRef.current.forEach(clearTimeout);
    demoTimeoutsRef.current = [];

    const nextIndex = currentPollIndex + 1;
    if (nextIndex >= loadedQuestions.length) {
      if (!isDemo) {
        updatePlayerScore(sessionId, nickname, totalPointsRef.current).catch((err) =>
          console.warn('Score update skipped:', err.message)
        );
      }
      setPhase('finished');
      recordScoreIfLoggedIn(totalPointsRef.current);
    } else {
      const nextLen = loadedQuestions[nextIndex]?.options?.length ?? 4;
      const freshCounts = Array(nextLen).fill(0);
      voteCountsRef.current = freshCounts;
      myVoteRef.current = null;
      simulatedCountRef.current = 0;

      setCurrentPollIndex(nextIndex);
      setVoteCounts(freshCounts);
      setMyVote(null);
      setAllVoted(false);
      setSimulatedVoterCount(0);
      setCurrentPollBonus(null);
      setPhase('voting');
    }
  };

  const handlePlayAgain = () => {
    demoTimeoutsRef.current.forEach(clearTimeout);
    demoTimeoutsRef.current = [];

    const freshCounts = Array(loadedQuestions[0]?.options?.length ?? 4).fill(0);
    totalPointsRef.current = 0;
    myVoteRef.current = null;
    simulatedCountRef.current = 0;
    voteCountsRef.current = freshCounts;

    reset(loadedQuestions[0]?.timeLimit ?? 20);
    setPhase('waiting');
    setCountdown(3);
    setCurrentPollIndex(0);
    setVoteCounts(freshCounts);
    setMyVote(null);
    setPollResults([]);
    setTotalPoints(0);
    setAllVoted(false);
    setCurrentPollBonus(null);
    setSimulatedVoterCount(0);
  };

  // ── Derived values ────────────────────────────────────────────────
  const currentPoll = loadedQuestions[currentPollIndex];
  if (!currentPoll) return null; // safety guard
  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...voteCounts, 0);
  const winnerIndex = voteCounts.indexOf(maxVotes);

  const chartData = currentPoll.options.map((option, index) => ({
    name: stripEmoji(option),
    votes: voteCounts[index] || 0,
    percentage:
      totalVotes > 0 ? Math.round(((voteCounts[index] || 0) / totalVotes) * 100) : 0,
    color: OPTION_COLORS[index],
  }));

  const barPct = (timeRemaining / currentPoll.timeLimit) * 100;
  const barColor =
    timeRemaining <= 5
      ? 'bg-red-500'
      : timeRemaining <= 10
      ? 'bg-yellow-400'
      : 'bg-green-500';

  const totalStudents = SIMULATED_STUDENTS + 1;
  const votedCount = Math.min(
    simulatedVoterCount + (myVote !== null ? 1 : 0),
    totalStudents
  );

  const isResults = phase === 'revealing' || phase === 'discussing';

  // Custom percentage label rendered above each bar
  const renderBarLabel = (props) => {
    const { x, y, width, index } = props;
    const entry = chartData[index];
    if (!entry || entry.percentage === 0) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#e2e8f0"
        textAnchor="middle"
        fontSize={13}
        fontWeight="bold"
      >
        {entry.percentage}%
      </text>
    );
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

  // ── COUNTDOWN SCREEN (synced) ────────────────────────────────
  if (sessionStatus === 'active' && !isReady && syncedCountdown !== null) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col">
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <span className="text-slate-400 font-semibold">Opinion Poll 🗳️</span>
          <span className="bg-slate-700 text-slate-400 text-xs px-2 py-1 rounded">
            {isDemo ? 'Demo Mode' : `PIN: ${sessionId}`}
          </span>
        </nav>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center select-none">
            <p className="text-slate-400 text-xl font-semibold mb-8">Get Ready to Vote!</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={syncedCountdown}
                initial={{ scale: 1.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="text-[9rem] leading-none font-black text-white"
              >
                {syncedCountdown === 0 ? '🚀' : syncedCountdown}
              </motion.div>
            </AnimatePresence>
            <p className="text-slate-500 text-sm mt-10">
              All players are starting together
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── WAITING SCREEN (pre-countdown) ────────────────────────────────
  if (phase === 'waiting' && !isReady) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col">
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <span className="text-slate-400 font-semibold">Opinion Poll 🗳️</span>
        </nav>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center select-none">
            <p className="text-slate-400 text-xl font-semibold mb-8">Get Ready to Vote!</p>
            <p className="text-slate-500 text-sm mt-10">
              {loadedQuestions.length} polls · {currentPoll?.timeLimit ?? 20} seconds each
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── FINISHED SCREEN ───────────────────────────────────────────────
  if (phase === 'finished') {
    const majorityCount = pollResults.filter((r) => {
      const max = Math.max(...r.voteCounts);
      return r.myVote !== null && r.voteCounts[r.myVote] === max;
    }).length;

    const uniqueCount = pollResults.filter((r) => {
      const nonZero = r.voteCounts.filter((v) => v > 0);
      const min = nonZero.length > 0 ? Math.min(...nonZero) : 0;
      return r.myVote !== null && r.voteCounts[r.myVote] === min && nonZero.length > 1;
    }).length;

    return (
      <div className="min-h-screen bg-[#0f172a] overflow-y-auto">
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <span className="text-brand-red font-black text-xl">🇪🇸 SpanishVIP</span>
          <span className="text-slate-400 font-semibold">Poll Complete!</span>
          <span className="bg-slate-700 text-slate-400 text-xs px-2 py-1 rounded">
            {isDemo ? 'Demo Mode' : `PIN: ${sessionId}`}
          </span>
        </nav>

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto px-4 py-8 space-y-6"
        >
          {/* Header */}
          <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700 shadow-xl">
            <div className="text-6xl mb-3">🗳️</div>
            <h1 className="text-3xl font-black text-white mb-2">Poll Complete!</h1>
            <p className="text-slate-400 mb-4">Thanks for participating, {nickname}!</p>
            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4">
              <p className="text-green-300 text-xl font-bold">
                +{totalPoints} participation points earned!
              </p>
            </div>
          </div>

          {/* Fun stats */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-white font-bold text-lg mb-4">Your Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-brand-yellow">{majorityCount}</p>
                <p className="text-slate-400 text-sm mt-1">times with the crowd 🎉</p>
              </div>
              <div className="bg-slate-900 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-purple-400">{uniqueCount}</p>
                <p className="text-slate-400 text-sm mt-1">unique opinions 🦄</p>
              </div>
            </div>
          </div>

          {/* Poll-by-poll recap */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-white font-bold text-lg mb-4">Poll Recap</h2>
            <div className="space-y-4">
              {pollResults.map((result, idx) => {
                const poll = loadedQuestions[idx];
                const max = Math.max(...result.voteCounts);
                const winIdx = result.voteCounts.indexOf(max);
                const total = result.voteCounts.reduce((a, b) => a + b, 0);
                const winPct = total > 0 ? Math.round((max / total) * 100) : 0;

                return (
                  <div key={idx} className="bg-slate-900 rounded-xl p-4">
                    <p className="text-slate-400 text-xs mb-1">Poll {idx + 1}</p>
                    <p className="text-white font-semibold text-sm mb-3">{poll.question}</p>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-brand-yellow text-sm">🏆 Winner:</span>
                      <span className="text-white text-sm font-medium">
                        {poll.options[winIdx]}
                      </span>
                      <span className="text-slate-400 text-xs">({winPct}%)</span>
                    </div>
                    {result.myVote !== null && (
                      <div
                        className={`text-xs rounded-lg px-3 py-1.5 inline-block ${
                          result.myVote === winIdx
                            ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/30'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        Your vote: {poll.options[result.myVote]}
                        {result.myVote === winIdx && ' 🏆'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <Leaderboard sessionId={sessionId || 'demo'} />
          </div>

          {/* Finish screen action buttons */}
          <div className="flex flex-col gap-3 mt-6 pb-6">
            {isDemo ? (
              <>
                <button
                  onClick={handlePlayAgain}
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

  // ── GAME SCREEN (voting / revealing / discussing) ─────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* Nav */}
      <nav className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-brand-red font-black text-lg">🇪🇸 SpanishVIP</span>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
              CATEGORY_COLORS[currentPoll.category] || 'bg-slate-600'
            }`}
          >
            {currentPoll.category}
          </span>
          <span className="text-slate-400 text-sm font-medium">
            Poll {currentPollIndex + 1} / {loadedQuestions.length}
          </span>
        </div>
        <span className="bg-slate-700 text-slate-400 text-xs px-2 py-1 rounded">
          {isDemo ? 'Demo Mode' : `PIN: ${sessionId}`}
        </span>
      </nav>

      {/* Timer bar */}
      <div className="h-3 bg-slate-700 flex-shrink-0">
        <div
          className={`h-full ${barColor}`}
          style={{
            width: `${isResults ? 0 : barPct}%`,
            transition: isResults ? 'width 0.5s linear' : timerTransition,
          }}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* Poll question — slides in from right on new poll */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPollIndex}
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -60, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="bg-slate-800 rounded-2xl p-6 text-center border border-slate-700 shadow-xl"
            >
              <p className="text-2xl md:text-3xl font-bold text-white leading-relaxed">
                {currentPoll.question}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Voting or Results — swap with AnimatePresence */}
          <AnimatePresence mode="wait">
            {!isResults ? (
              /* ── Voting phase ─────────────────────────────────────── */
              <motion.div
                key="voting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="space-y-4"
              >
                {/* Option buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {currentPoll.options.map((option, index) => {
                    const isSelected = myVote === index;
                    const isDimmed = myVote !== null && myVote !== index;
                    const isTriangleBottom =
                      currentPoll.options.length === 3 && index === 2;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08, duration: 0.3 }}
                        className={
                          isTriangleBottom ? 'col-span-2 flex justify-center' : ''
                        }
                      >
                        <motion.button
                          whileHover={myVote === null ? { scale: 1.03 } : {}}
                          whileTap={myVote === null ? { scale: 0.97 } : {}}
                          onClick={() => handleVote(index)}
                          disabled={myVote !== null}
                          className={[
                            isTriangleBottom ? 'w-1/2' : 'w-full',
                            'py-8 px-6 text-xl font-bold rounded-2xl transition-all duration-200',
                            OPTION_BG[index],
                            isSelected ? 'ring-4 ring-white scale-105' : '',
                            isDimmed ? 'opacity-40 cursor-not-allowed' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {isSelected && <span className="mr-2">✅</span>}
                          {option}
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Vote submitted confirmation */}
                <AnimatePresence>
                  {myVote !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-900/30 border border-green-500/50 rounded-xl p-3 text-center text-green-300 font-medium"
                    >
                      ✅ Vote submitted! Waiting for results...
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Live student counter */}
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-1">
                  {!allVoted && (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  )}
                  <span>
                    {allVoted
                      ? 'All students voted! 🎉'
                      : `${votedCount} of ${totalStudents} students voted`}
                  </span>
                </div>
              </motion.div>
            ) : (
              /* ── Results phase (revealing + discussing) ───────────── */
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-black text-white">📊 Results are in!</h2>
                </div>

                {/* Bar chart */}
                <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 shadow-xl">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 36, right: 16, bottom: 10, left: 0 }}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(value) => [`${value} votes`]}
                        contentStyle={{
                          background: '#1e293b',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Bar
                        dataKey="votes"
                        radius={[6, 6, 0, 0]}
                        label={renderBarLabel}
                        isAnimationActive
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.color}
                            opacity={index === winnerIndex ? 1 : 0.7}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Per-option breakdown below chart */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {currentPoll.options.map((option, index) => (
                      <div
                        key={index}
                        className={`rounded-lg px-3 py-2 flex items-center justify-between ${
                          index === winnerIndex
                            ? 'bg-yellow-900/30 border border-yellow-500/40'
                            : 'bg-slate-900'
                        }`}
                      >
                        <span className="text-white text-xs font-medium truncate flex-1 mr-2">
                          {index === winnerIndex && '🏆 '}
                          {option}
                        </span>
                        <div className="text-right flex-shrink-0">
                          <span className="text-white text-sm font-bold block">
                            {chartData[index].percentage}%
                          </span>
                          <span className="text-slate-400 text-xs">
                            {voteCounts[index]} votes
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discussion prompt — fades in 500ms after chart */}
                <AnimatePresence>
                  {phase === 'discussing' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                      className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4"
                    >
                      <p className="text-yellow-200 font-medium">
                        💬 Discussion: {currentPoll.discussionPrompt}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bonus points notification — slides up from below */}
                <AnimatePresence>
                  {phase === 'discussing' && currentPollBonus && (
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="bg-green-900/30 border border-green-500/50 rounded-xl p-4 text-center"
                    >
                      <p className="text-green-300 font-bold text-lg">
                        +{currentPollBonus.pts} participation points!
                      </p>
                      {currentPollBonus.label && (
                        <p className="text-green-400 text-sm mt-1">
                          {currentPollBonus.label}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Next poll / finish button */}
                <AnimatePresence>
                  {phase === 'discussing' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6, duration: 0.3 }}
                    >
                      <button
                        onClick={handleNextPoll}
                        className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors text-lg shadow-lg"
                      >
                        {currentPollIndex < loadedQuestions.length - 1
                          ? 'Next Poll →'
                          : 'See Results 🏆'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default OpinionPoll;
