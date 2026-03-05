import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PinEntry from '../components/shared/PinEntry';
import { joinSession } from '../firebase/sessions';

const StudentJoin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async ({ pin, nickname }) => {
    setLoading(true);
    setError(null);

    try {
      const { sessionId, gameType } = await joinSession(pin, nickname);
      const route = `/game/${gameType.replace(/_/g, '-')}/${sessionId}`;
      navigate(route);
    } catch (err) {
      // Demo fallback: any valid 6-digit PIN drops into Multiple Choice demo
      if (pin.length === 6) {
        navigate('/game/multiple-choice/demo');
      } else {
        setError(err.message || 'Invalid PIN. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
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

            <PinEntry onSubmit={handleSubmit} loading={loading} error={error} />

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
