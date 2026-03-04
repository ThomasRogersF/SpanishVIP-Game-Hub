import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLeaderboard } from '../../hooks/useLeaderboard';

const DEMO_PLAYERS = [
  { nickname: 'ProfeCarlos', score: 1850, rank: 1 },
  { nickname: 'MariaSVIP', score: 1620, rank: 2 },
  { nickname: 'JuanAprendiz', score: 1340, rank: 3 },
  { nickname: 'AnaEstudiante', score: 980, rank: 4 },
  { nickname: 'PedroNew', score: 720, rank: 5 },
];

const RANK_ICONS = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Live leaderboard sidebar.
 * Shows real Firebase data when available, demo data in demo mode.
 * @param {{ sessionId: string }} props
 */
const Leaderboard = ({ sessionId }) => {
  const { players, loading } = useLeaderboard(sessionId);
  const displayPlayers = players.length > 0 ? players : DEMO_PLAYERS;

  return (
    <div className="bg-slate-900 rounded-xl p-4 w-full">
      <h3 className="text-brand-yellow font-bold text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
        <span>🏆</span> Leaderboard
      </h3>

      {loading ? (
        <div className="text-slate-500 text-sm text-center py-4">Loading...</div>
      ) : (
        <ol className="space-y-2">
          <AnimatePresence>
            {displayPlayers.slice(0, 10).map((player) => (
              <motion.li
                key={player.nickname}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2"
              >
                <span className="text-sm w-6 text-center">
                  {RANK_ICONS[player.rank] ?? `#${player.rank}`}
                </span>
                <span className="flex-1 text-white text-sm font-medium truncate">
                  {player.nickname}
                </span>
                <span className="text-brand-yellow text-sm font-bold">
                  {player.score.toLocaleString()}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      {sessionId === 'demo' && (
        <p className="text-slate-600 text-xs text-center mt-3">Demo data — connect Firebase for live scores</p>
      )}
    </div>
  );
};

export default Leaderboard;
