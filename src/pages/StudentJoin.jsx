import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PinEntry from '../components/shared/PinEntry';
import { joinSession } from '../firebase/sessions';
import { getCurrentTeacher, logoutTeacher } from '../firebase/teachers';

const InlinePinForm = ({ onSubmit, loading, error }) => {
  const [pin, setPin] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setValidationError('Please enter a valid 6-digit PIN.');
      return;
    }
    onSubmit(pin);
  };

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Game PIN</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="w-full bg-slate-700 border border-slate-600 text-white text-3xl font-black text-center tracking-[0.5em] rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-slate-500 placeholder:text-lg placeholder:tracking-normal"
        />
      </div>
      {displayError && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2 text-center">
          {displayError}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-xl py-4 rounded-xl transition-colors shadow-lg"
      >
        {loading ? 'Joining...' : 'Join Game →'}
      </button>
    </form>
  );
};

const friendlyError = (message) => {
  if (!message) return 'Something went wrong. Please try again.';
  if (message.includes('PIN not found')) return "That PIN doesn't exist. Double-check with your teacher.";
  if (message.includes('already ended')) return 'This game has ended. Ask your teacher to start a new one.';
  if (message.includes('not configured')) return 'Connection error. Please try again.';
  return message;
};

const StudentJoin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentAccount = getCurrentTeacher();
  const isStudentLoggedIn = currentAccount?.role === "student";
  const isLoggedIn = !!currentAccount;
  const [nickname, setNickname] = useState(
    currentAccount?.name || localStorage.getItem("svip_nickname") || ""
  );

  const handleSubmit = async ({ pin, nickname }) => {
    setLoading(true);
    setError(null);

    try {
      const { sessionId, gameType } = await joinSession(pin, nickname);
      const route = `/game/${gameType.replace(/_/g, '-')}/${sessionId}`;
      navigate(route);
    } catch (err) {
      setError(friendlyError(err.message));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative">
      <div className="absolute top-6 left-6">
        <a
          href="/"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Back to Home
        </a>
      </div>
      {/* Nav */}
      <nav
        className="bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0"
        style={{ height: '52px' }}
      >
        <Link to="/">
          <img src="/logo_hires_white.png" alt="SpanishVIP" className="h-8 object-contain" />
        </Link>
        <span className="text-slate-400 font-semibold text-sm">Join a Game</span>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Card */}
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-700 shadow-2xl text-center">
            <img
              src="/logo_hires_white.png"
              alt="SpanishVIP"
              className="h-12 object-contain mx-auto mb-4"
            />
            <h1 className="text-3xl font-black text-white mb-1">Join a Game</h1>
            <p className="text-slate-400 text-sm mb-8">
              Enter the PIN from your teacher to jump in.
            </p>

            {/* Nickname input or account card */}
            {!isLoggedIn ? (
              <div className="mb-4">
                <label className="text-slate-400 text-sm mb-2 block">Your nickname</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="Enter a nickname..."
                  className="w-full bg-slate-800 border border-slate-600 focus:border-yellow-400 rounded-xl text-white text-lg p-4 outline-none transition-colors"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
                <span className="text-2xl">👤</span>
                <div>
                  <p className="text-white font-medium">{currentAccount.name}</p>
                  <p className="text-slate-400 text-xs">Playing as your account</p>
                </div>
              </div>
            )}

            {/* Guest message */}
            {!isLoggedIn && (
              <p className="text-slate-500 text-xs text-center mb-4">
                Playing as guest — <a href="/teacher/login" className="text-yellow-400 hover:text-yellow-300">create an account</a> to track your scores on the leaderboard
              </p>
            )}

            {isLoggedIn ? (
              <InlinePinForm onSubmit={(pin) => handleSubmit({ pin, nickname })} loading={loading} error={error} />
            ) : (
              <PinEntry onSubmit={handleSubmit} loading={loading} error={error} />
            )}

            <p className="text-slate-600 text-xs mt-6">
              Don't have a PIN?{' '}
              <Link to="/game/multiple-choice/demo" className="text-yellow-400 hover:underline">
                Try a demo game →
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StudentJoin;
