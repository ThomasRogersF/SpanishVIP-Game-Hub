import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createSession } from '../firebase/sessions';
import { generatePin } from '../utils/generatePin';

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
  const [selectedGame, setSelectedGame] = useState('multiple-choice');
  const [creating, setCreating] = useState(false);
  const [currentPin, setCurrentPin] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleCreateSession = async () => {
    setCreating(true);
    setNotice(null);

    try {
      const { sessionId, pin } = await createSession(selectedGame, [], 'teacher-demo');
      setCurrentPin(pin);
      setCurrentSessionId(sessionId);
    } catch {
      // Fallback: demo mode without Firebase
      const demoPin = generatePin();
      setCurrentPin(demoPin);
      setCurrentSessionId(`demo-${demoPin}`);
      setNotice('Demo mode — Firebase not configured. Using a local PIN.');
    } finally {
      setCreating(false);
    }
  };

  const gameLabel = GAME_OPTIONS.find((g) => g.value === selectedGame)?.label ?? '';

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Nav */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-brand-red font-black text-xl hover:text-red-400 transition-colors">
          🇪🇸 SpanishVIP
        </Link>
        <span className="text-slate-400 font-semibold">Teacher Dashboard</span>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Session Creator */}
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h2 className="text-white font-bold text-2xl mb-1">Create a Session</h2>
          <p className="text-slate-400 text-sm mb-6">
            Choose a game, generate a PIN, and share it with your students.
          </p>

          <div className="mb-5">
            <label className="block text-slate-300 text-sm font-semibold mb-2">Game Type</label>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-yellow text-base"
            >
              {GAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreateSession}
            disabled={creating}
            className="w-full bg-brand-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors text-lg mb-4"
          >
            {creating ? 'Creating...' : '⚡ Generate PIN & Start Session'}
          </button>

          {notice && (
            <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-lg px-4 py-2 text-brand-yellow text-sm mb-4">
              {notice}
            </div>
          )}

          {currentPin && (
            <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Share this PIN with students</p>
              <p className="text-6xl font-black text-white tracking-[0.2em] my-2">{currentPin}</p>
              <p className="text-slate-500 text-xs mb-4">{gameLabel}</p>
              <Link
                to={`/game/${selectedGame}/demo`}
                className="inline-block bg-brand-yellow text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 transition-colors text-sm"
              >
                Preview Game →
              </Link>
            </div>
          )}
        </div>

        {/* Live Monitor */}
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h2 className="text-white font-bold text-2xl mb-1">Live Monitor</h2>
          <p className="text-slate-400 text-sm mb-6">
            Track student activity and scores in real time.
          </p>

          {currentSessionId ? (
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-sm">Active Session</span>
                  <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full">
                    LIVE
                  </span>
                </div>
                <p className="text-white font-semibold">{gameLabel}</p>
                <p className="text-slate-500 text-xs font-mono mt-1">ID: {currentSessionId}</p>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-slate-500 text-sm">
                  Real-time student monitoring requires Firebase to be configured.
                  <br />
                  <span className="text-slate-600 text-xs mt-1 block">
                    Students can still play in demo mode.
                  </span>
                </p>
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
    </div>
  );
};

export default TeacherDashboard;
