import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { createSession, updateSessionStatus, subscribeToSession } from '../firebase/sessions';
import { generatePin } from '../utils/generatePin';
import { getQuestionSets, createQuestionSet, getQuestionSet } from '../firebase/questionSets';
import { getCurrentTeacher, logoutTeacher, migrateTeacherDocuments } from '../firebase/teachers';
import { PUBLIC_TEMPLATES } from '../firebase/seedTemplates';

const GAME_OPTIONS = [
  { value: 'multiple-choice', label: '🎯 Multiple Choice Quiz' },
  { value: 'true-or-false', label: '✅ True or False' },
  { value: 'word-cloud', label: '☁️ Word Cloud' },
  { value: 'puzzle', label: '🧩 Puzzle Sequencing' },
  { value: 'type-answer', label: '⌨️ Type Answer' },
  { value: 'opinion-poll', label: '📊 Opinion Poll' },
  { value: 'robot-run', label: '🤖 Robot Run' },
];

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teacher = getCurrentTeacher();

  useEffect(() => {
    const account = getCurrentTeacher();
    if (!account) {
      navigate('/teacher/login');
      return;
    }
    // Block students from accessing teacher dashboard
    if (account.role === 'student') {
      navigate('/join');
      return;
    }
  }, []);

  useEffect(() => {
    const questionSetId = searchParams.get("questionSetId");
    const gameType = searchParams.get("gameType");
    const autostart = searchParams.get("autostart");
    if (questionSetId) {
      getQuestionSet(questionSetId).then(qs => {
        if (qs) {
          setPreloadedSet(qs);
          setPreloadedSetTitle(qs.title);
          setSelectedGame(qs.gameType || gameType);

          // Auto-trigger session creation if autostart=true
          if (autostart === "true") {
            setTimeout(() => {
              handleCreateSessionWithSet(qs);
            }, 500);
          }
        }
      });
    }
  }, []);

  const handleSignOut = () => {
    logoutTeacher();
    navigate('/teacher/login');
  };

  const handleSeedTemplates = async () => {
    try {
      for (const template of PUBLIC_TEMPLATES) {
        await createQuestionSet({
          ...template,
          questionCount: template.questions.length,
        }, null);
      }
      alert('Public templates seeded!');
    } catch (err) {
      alert('Error seeding templates: ' + err.message);
    }
  };
  const [selectedGame, setSelectedGame] = useState('multiple-choice');
  const [generatedPin, setGeneratedPin] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('idle'); // idle | creating | waiting | active
  const [playerCount, setPlayerCount] = useState(0);
  const [joinedPlayers, setJoinedPlayers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [questionLibrary, setQuestionLibrary] = useState([]);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState('');
  const [preloadedSet, setPreloadedSet] = useState(null);
  const [preloadedSetTitle, setPreloadedSetTitle] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const sets = await getQuestionSets(selectedGame);
        setQuestionLibrary(sets);
      } catch {
        setQuestionLibrary([]);
      }
    })();
    setSelectedQuestionSet('');
  }, [selectedGame]);

  // Subscribe to Firestore session doc to track player joins
  useEffect(() => {
    if (!sessionId || !db) return;
    const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        const players = snap.data().players || {};
        setJoinedPlayers(Object.values(players));
        setPlayerCount(Object.keys(players).length);
      }
    });
    return unsubscribe;
  }, [sessionId]);

  const handleCreateSession = async () => {
    setIsCreating(true);
    setError(null);
    setNotice(null);

    try {
      const questions = preloadedSet?.questions ?? [];
      const gameType = preloadedSet?.gameType ?? selectedGame;
      const { sessionId: newSessionId, pin } = await createSession(gameType, questions, teacher?.teacherId || 'teacher');
      setSessionId(newSessionId);
      setGeneratedPin(pin);
      setSessionStatus('waiting');
      setSelectedGame(gameType);

      // Subscribe to RTDB for fast status updates
      subscribeToSession(newSessionId, (data) => {
        if (data?.playerCount) setPlayerCount(data.playerCount);
      });
    } catch (err) {
      // Fallback: demo mode without Firebase
      const demoPin = generatePin();
      setGeneratedPin(demoPin);
      setSessionId(`demo-${demoPin}`);
      setSessionStatus('waiting');
      setNotice('Demo mode — Firebase not configured. Using a local PIN.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateSessionWithSet = async (qs) => {
    setIsCreating(true);
    setError(null);
    try {
      const questions = qs?.questions ?? [];
      const gameType = qs?.gameType ?? selectedGame;
      const { sessionId: newSessionId, pin } = await createSession(
        gameType, questions, teacher?.teacherId || 'teacher'
      );
      setSessionId(newSessionId);
      setGeneratedPin(pin);
      setSessionStatus('waiting');
      setSelectedGame(gameType);

      if (db && newSessionId) {
        const unsubscribe = onSnapshot(doc(db, 'sessions', newSessionId), (snap) => {
          if (snap.exists()) {
            const players = snap.data().players || {};
            setJoinedPlayers(Object.values(players));
            setPlayerCount(Object.keys(players).length);
          }
        });
        return unsubscribe;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartGame = async () => {
    if (sessionId) {
      await updateSessionStatus(sessionId, 'active');
      setSessionStatus('active');
      navigate(`/game/${selectedGame}/${sessionId}?role=teacher`);
    }
  };

  const handleCancelSession = async () => {
    if (sessionId) {
      try {
        await updateSessionStatus(sessionId, 'finished');
      } catch {
        // ignore if Firebase not available
      }
      setSessionId(null);
      setGeneratedPin(null);
      setSessionStatus('idle');
      setPlayerCount(0);
      setJoinedPlayers([]);
    }
  };

  const gameLabel = GAME_OPTIONS.find((g) => g.value === selectedGame)?.label ?? '';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav
        className="bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0"
        style={{ height: '52px' }}
      >
        <Link to="/">
          <img src="/logo_hires_white.png" alt="SpanishVIP" className="h-8 object-contain" />
        </Link>
        <div className="flex items-center gap-4">
          {teacher && (
            <span className="text-slate-400 text-sm hidden sm:inline">Hi, {teacher.name}</span>
          )}
          <Link to="/editor" className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-700">
            My Templates
          </Link>
          <span className="text-slate-400 font-semibold text-sm hidden sm:inline">Teacher Dashboard</span>
          <button
            onClick={handleSignOut}
            className="text-slate-500 hover:text-slate-300 text-sm border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-6">
        {preloadedSet && (
          <div className="flex items-center justify-between bg-green-950 border border-green-700 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2 text-green-300">
              <span>✅</span>
              <span className="text-sm font-medium">Question set loaded: <strong>{preloadedSetTitle}</strong></span>
              <span className="text-green-500 text-xs">({preloadedSet.questions?.length || 0} questions)</span>
            </div>
            <button
              onClick={() => { setPreloadedSet(null); setPreloadedSetTitle(null); }}
              className="text-green-600 hover:text-green-400 text-xs"
            >
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Session Creator */}
        <div className="bg-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h2 className="text-white font-bold text-2xl mb-1">Create a Session</h2>
          <p className="text-slate-400 text-sm mb-6">
            Choose a game, generate a PIN, and share it with your students.
          </p>

          {sessionStatus === 'idle' && (
            <>
              <div className="mb-5">
                <label className="block text-slate-300 text-sm font-semibold mb-2">Game Type</label>
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-base"
                >
                  {GAME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {questionLibrary.length > 0 && (
                <div className="mb-5">
                  <label className="block text-slate-300 text-sm font-semibold mb-2">Load from Library</label>
                  <select
                    value={selectedQuestionSet}
                    onChange={(e) => setSelectedQuestionSet(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-base"
                  >
                    <option value="">— Select a question set —</option>
                    {questionLibrary.map((qs) => (
                      <option key={qs.id} value={qs.id}>
                        {qs.title || 'Untitled'} ({qs.questionCount || qs.questions?.length || 0} questions)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleCreateSession}
                disabled={isCreating}
                className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white font-bold py-4 rounded-xl text-lg transition-all flex items-center justify-center gap-2 mb-4"
              >
                {isCreating ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating session...</>
                ) : preloadedSet ? (
                  <>🚀 Start Session — {preloadedSetTitle}</>
                ) : (
                  <>⚡ Generate PIN & Start Session</>
                )}
              </button>

              {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2 mb-4">
                  {error}
                </div>
              )}

              {notice && (
                <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-4 py-2 text-yellow-400 text-sm mb-4">
                  {notice}
                </div>
              )}
            </>
          )}

          {/* Waiting Room — shown after session is created */}
          {sessionStatus === 'waiting' && (
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              {notice && (
                <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-4 py-2 text-yellow-400 text-sm mb-4">
                  {notice}
                </div>
              )}

              {/* Big PIN display */}
              <p className="text-slate-400 text-sm mb-2">Share this PIN with your students:</p>
              <div className="text-6xl font-black text-yellow-400 tracking-widest text-center py-4">
                {generatedPin}
              </div>

              {/* Join URL */}
              <p className="text-slate-400 text-sm text-center mb-4">
                or go to: <span className="text-white font-mono">{window.location.origin}/join</span>
              </p>

              {/* Game type */}
              <p className="text-slate-500 text-xs text-center mb-4">{gameLabel}</p>

              {/* Player count */}
              <div className="flex items-center gap-2 justify-center text-green-400 mb-4">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span>{playerCount} {playerCount === 1 ? 'student' : 'students'} joined</span>
              </div>

              {/* Player list - shows nicknames as they join */}
              <div className="flex flex-wrap gap-2 my-4 min-h-12">
                {joinedPlayers.map((player) => (
                  <motion.div
                    key={player.nickname}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-slate-700 rounded-full px-3 py-1 text-sm text-white flex items-center gap-1"
                  >
                    <span>👤</span> {player.nickname}
                  </motion.div>
                ))}
              </div>

              {/* Start Game button */}
              <button
                onClick={handleStartGame}
                disabled={playerCount === 0}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-lg transition-all"
              >
                {playerCount === 0 ? 'Waiting for students...' : `Start Game with ${playerCount} ${playerCount === 1 ? 'student' : 'students'} →`}
              </button>

              {/* Cancel session */}
              <button onClick={handleCancelSession} className="w-full mt-3 text-slate-500 hover:text-slate-300 text-sm">
                Cancel session
              </button>
            </div>
          )}
        </div>

        {/* Live Monitor */}
        <div className="bg-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h2 className="text-white font-bold text-2xl mb-1">Live Monitor</h2>
          <p className="text-slate-400 text-sm mb-6">
            Track student activity and scores in real time.
          </p>

          {sessionId ? (
            <div className="space-y-4">
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-sm">Active Session</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    sessionStatus === 'waiting'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {sessionStatus === 'waiting' ? 'WAITING' : 'LIVE'}
                  </span>
                </div>
                <p className="text-white font-semibold">{gameLabel}</p>
                <p className="text-slate-500 text-xs font-mono mt-1">PIN: {generatedPin}</p>
                <p className="text-slate-600 text-xs font-mono mt-0.5">ID: {sessionId}</p>
              </div>

              <div className="bg-slate-950 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm font-semibold mb-2">Players ({playerCount})</p>
                {joinedPlayers.length > 0 ? (
                  <div className="space-y-1">
                    {joinedPlayers.map((player) => (
                      <div key={player.nickname} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                        <span className="text-white text-sm">👤 {player.nickname}</span>
                        <span className="text-slate-400 text-xs">Score: {player.score || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600 text-sm">No players yet...</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-700 rounded-xl">
              <div className="text-center">
                <p className="text-4xl mb-3">📡</p>
                <p className="text-slate-500 text-sm">
                  Select a game and create a session
                  <br />
                  to monitor students here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center mt-8 pb-4 space-y-2">
        <a href="/test" className="text-slate-600 hover:text-slate-400 text-xs transition-colors block">
          Multiplayer Test Suite
        </a>
        {teacher?.name?.toLowerCase() === 'admin' && (
          <button onClick={handleSeedTemplates} className="text-slate-600 hover:text-slate-400 text-xs transition-colors">
            Seed Public Templates
          </button>
        )}
        {teacher?.name?.toLowerCase() === "admin" && (
          <button onClick={async () => { await migrateTeacherDocuments(); alert("✅ Accounts migrated!"); }}
            className="text-slate-600 hover:text-slate-400 text-xs mt-2">
            🔧 Migrate Accounts
          </button>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
