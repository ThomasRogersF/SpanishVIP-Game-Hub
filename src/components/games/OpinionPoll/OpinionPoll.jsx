import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const OpinionPoll = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-slate-800 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl border border-slate-700"
      >
        <div className="text-7xl mb-4">📊</div>
        <h1 className="text-3xl font-bold text-white mb-2">Opinion Poll</h1>
        <p className="text-slate-400 mb-6">Live results with charts</p>

        <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-5 mb-8">
          <p className="text-brand-yellow font-bold text-lg">🚧 Coming Soon</p>
          <p className="text-slate-400 text-sm mt-1">
            This game is in development. Check back soon!
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl transition-colors"
        >
          ← Back to Hub
        </button>
      </motion.div>
    </div>
  );
};

export default OpinionPoll;
