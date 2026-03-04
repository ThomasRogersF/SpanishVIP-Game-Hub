import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSession } from '../hooks/useSession';
import { useLeaderboard } from '../hooks/useLeaderboard';

const DEMO_PLAYERS = [
  { nickname: 'ProfeCarlos', score: 1850, rank: 1 },
  { nickname: 'MariaSVIP', score: 1620, rank: 2 },
  { nickname: 'JuanAprendiz', score: 1340, rank: 3 },
  { nickname: 'AnaEstudiante', score: 980, rank: 4 },
  { nickname: 'PedroNuevo', score: 720, rank: 5 },
  { nickname: 'LuisPlayer', score: 610, rank: 6 },
  { nickname: 'SofiaLearner', score: 480, rank: 7 },
];

const PODIUM_STYLES = {
  1: { color: 'bg-yellow-400 text-black', height: 'h-28', label: '🥇 1st' },
  2: { color: 'bg-slate-400 text-black', height: 'h-20', label: '🥈 2nd' },
  3: { color: 'bg-amber-600 text-white', height: 'h-14', label: '🥉 3rd' },
};

const GameResults = () => {
  const { sessionId } = useParams();
  const { session, loading: sessionLoading } = useSession(sessionId);
  const { players } = useLeaderboard(sessionId);

  const displayPlayers = players.length > 0 ? players : DEMO_PLAYERS;
  const top3 = displayPlayers.slice(0, 3);
  const chartData = displayPlayers.slice(0, 10).map((p) => ({
    name: p.nickname.length > 12 ? p.nickname.slice(0, 12) + '…' : p.nickname,
    score: p.score,
  }));

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Nav */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-brand-red font-black text-xl hover:text-red-400 transition-colors">
          🇪🇸 SpanishVIP
        </Link>
        <span className="text-slate-400 font-semibold">Game Results</span>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {/* Title */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <h1 className="text-4xl font-black text-white mb-2">🏆 Final Results</h1>
          {session && (
            <p className="text-slate-400">
              {session.gameType} · Session {sessionId}
            </p>
          )}
        </motion.div>

        {/* Podium */}
        {top3.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl"
          >
            <h2 className="text-slate-400 text-sm font-bold uppercase tracking-widest text-center mb-8">
              Podium
            </h2>

            {/* Podium visual */}
            <div className="flex items-end justify-center gap-4 mb-6">
              {/* 2nd place (left) */}
              {top3[1] && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-white font-bold text-sm">{top3[1].nickname}</span>
                  <span className="text-slate-400 text-xs">{top3[1].score.toLocaleString()} pts</span>
                  <div className={`w-20 ${PODIUM_STYLES[2].height} ${PODIUM_STYLES[2].color} rounded-t-lg flex items-center justify-center font-black text-sm`}>
                    🥈
                  </div>
                </div>
              )}

              {/* 1st place (center) */}
              {top3[0] && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-white font-bold text-sm">{top3[0].nickname}</span>
                  <span className="text-slate-400 text-xs">{top3[0].score.toLocaleString()} pts</span>
                  <div className={`w-24 ${PODIUM_STYLES[1].height} ${PODIUM_STYLES[1].color} rounded-t-lg flex items-center justify-center font-black text-xl`}>
                    🥇
                  </div>
                </div>
              )}

              {/* 3rd place (right) */}
              {top3[2] && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-white font-bold text-sm">{top3[2].nickname}</span>
                  <span className="text-slate-400 text-xs">{top3[2].score.toLocaleString()} pts</span>
                  <div className={`w-20 ${PODIUM_STYLES[3].height} ${PODIUM_STYLES[3].color} rounded-t-lg flex items-center justify-center font-black text-sm`}>
                    🥉
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl"
        >
          <h2 className="text-white font-bold text-lg mb-6">Top 10 Scores</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
              />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                cursor={{ fill: '#ffffff10' }}
              />
              <Bar dataKey="score" fill="#DC2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Full leaderboard table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl"
        >
          <h2 className="text-white font-bold text-lg mb-4">Full Leaderboard</h2>
          <ol className="space-y-2">
            {displayPlayers.map((player) => (
              <li
                key={player.nickname}
                className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3"
              >
                <span className="w-8 text-center font-bold text-slate-400">
                  {player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : `#${player.rank}`}
                </span>
                <span className="flex-1 text-white font-medium">{player.nickname}</span>
                <span className="text-brand-yellow font-black">
                  {player.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-4 pb-8">
          <Link
            to="/"
            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            ← Back to Hub
          </Link>
          <Link
            to="/game/multiple-choice/demo"
            className="bg-brand-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Play Again →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GameResults;
