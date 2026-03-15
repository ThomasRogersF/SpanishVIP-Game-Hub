import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { checkFirebaseConnection } from '../firebase/healthCheck';
import { getCurrentTeacher, logoutTeacher, subscribeToGlobalLeaderboard } from '../firebase/teachers';

const GAMES = [
  {
    id: 'multiple-choice',
    title: 'Multiple Choice Quiz',
    emoji: '🎯',
    description: '4 options, speed + accuracy scoring',
    route: '/game/multiple-choice/demo',
    accentBar: 'bg-blue-500',
    buttonClass: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  {
    id: 'true-or-false',
    title: 'True or False',
    emoji: '✅',
    description: 'Rapid-fire, streak combos',
    route: '/game/true-or-false/demo',
    accentBar: 'bg-green-500',
    buttonClass: 'bg-green-500 hover:bg-green-600 text-white',
  },
  {
    id: 'word-cloud',
    title: 'Word Cloud',
    emoji: '☁️',
    description: 'Free-form answers visualized',
    route: '/game/word-cloud/demo',
    accentBar: 'bg-purple-500',
    buttonClass: 'bg-purple-500 hover:bg-purple-600 text-white',
  },
  {
    id: 'puzzle',
    title: 'Puzzle Sequencing',
    emoji: '🧩',
    description: 'Drag and drop ordering',
    route: '/game/puzzle/demo',
    accentBar: 'bg-yellow-400',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-500 text-black',
  },
  {
    id: 'type-answer',
    title: 'Type Answer',
    emoji: '⌨️',
    description: 'Type the exact answer',
    route: '/game/type-answer/demo',
    accentBar: 'bg-red-500',
    buttonClass: 'bg-red-500 hover:bg-red-600 text-white',
  },
  {
    id: 'opinion-poll',
    title: 'Opinion Poll',
    emoji: '📊',
    description: 'Live results with charts',
    route: '/game/opinion-poll/demo',
    accentBar: 'bg-pink-500',
    buttonClass: 'bg-pink-500 hover:bg-pink-600 text-white',
  },
  {
    id: 'robot-run',
    title: 'Robot Run',
    emoji: '🤖',
    description: 'Escape the robot narrative game',
    route: '/game/robot-run/demo',
    accentBar: 'bg-indigo-500',
    buttonClass: 'bg-indigo-500 hover:bg-indigo-600 text-white',
    isRobotRun: true,
  },
];

const StarField = () => {
  const stars = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 4,
      opacity: Math.random() * 0.7 + 0.3,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map(star => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [star.opacity, 0.1, star.opacity] }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

const ShootingStar = ({ delay, top }) => (
  <motion.div
    className="absolute h-px bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none"
    style={{ width: '120px', top: `${top}%`, left: '-10%' }}
    animate={{ x: ['0%', '120vw'], opacity: [0, 1, 0] }}
    transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 8 }}
  />
);

const Hub = () => {
  const navigate = useNavigate();
  const currentAccount = getCurrentTeacher();
  const [firebaseStatus, setFirebaseStatus] = useState("checking"); // checking | connected | failed
  const [leaderboardTab, setLeaderboardTab] = useState("allTime");
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    checkFirebaseConnection().then(setFirebaseStatus);
  }, []);

  useEffect(() => {
    setLeaderboardLoading(true);
    const unsubscribe = subscribeToGlobalLeaderboard(leaderboardTab, (data) => {
      setGlobalLeaderboard(data);
      setLeaderboardLoading(false);
    });
    return unsubscribe;
  }, [leaderboardTab]);

  const shootingStarConfigs = useMemo(() => [
    { delay: 2, top: 12 },
    { delay: 7, top: 38 },
    { delay: 13, top: 55 },
    { delay: 19, top: 25 },
  ], []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Slim Nav */}
      <nav
        className="bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0"
        style={{ height: '52px' }}
      >
        <img src="/logo_hires_white.png" alt="SpanishVIP" className="h-8 object-contain" />
        {currentAccount ? (
          <div className="flex items-center gap-3">
            {currentAccount.role === "teacher" && (
              <a
                href="/teacher"
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-4 py-2 rounded-lg text-sm transition-all"
              >
                Teacher Dashboard
              </a>
            )}
            <span className="text-slate-300 text-sm">👤 {currentAccount.name}</span>
            <button
              onClick={() => { logoutTeacher(); window.location.reload(); }}
              className="text-slate-500 hover:text-slate-300 text-xs border border-slate-700 rounded-lg px-3 py-1"
            >
              Sign out
            </button>
          </div>
        ) : (
          <a
            href="/teacher/login"
            className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-all"
          >
            Login
          </a>
        )}
      </nav>

      {/* Hero Banner */}
      <header
        className="relative overflow-hidden flex-shrink-0"
        style={{
          background: 'radial-gradient(ellipse at 60% 50%, #1a0533 0%, #0a0a1a 60%, #000510 100%)',
          height: 'clamp(220px, 30vw, 280px)',
        }}
      >
        {/* Nebula blobs */}
        <div
          className="absolute top-1/4 left-1/3 w-64 h-32 rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #7c3aed, transparent)', filter: 'blur(40px)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-48 h-24 rounded-full opacity-15"
          style={{ background: 'radial-gradient(ellipse, #1d4ed8, transparent)', filter: 'blur(35px)' }}
        />

        {/* Planet accent */}
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle at 35% 35%, #fbbf24, #92400e)', filter: 'blur(2px)' }}
        />

        {/* Animated stars */}
        <StarField />

        {/* Shooting stars */}
        {shootingStarConfigs.map((cfg, i) => (
          <ShootingStar key={i} delay={cfg.delay} top={cfg.top} />
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
          <img
            src="/logo_hires_white.png"
            alt="SpanishVIP"
            className="object-contain mb-4"
            style={{ maxHeight: '56px' }}
          />
          <h1
            className="text-4xl md:text-5xl font-black text-white tracking-tight"
            style={{ textShadow: '0 0 40px rgba(255,255,255,0.3)' }}
          >
            Interactive Game Hub
          </h1>
          <p className="text-slate-300 text-lg italic mt-2">
            Engage your students with real-time Spanish learning games
          </p>
          <div className="hidden md:flex gap-2 mt-4">
            {['7 Games', 'Real-time', 'Mobile Ready'].map(label => (
              <span
                key={label}
                className="bg-white/10 text-white border border-white/20 text-xs font-semibold px-3 py-1 rounded-full"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Firebase Status Banner */}
      {firebaseStatus === "checking" && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-sm w-fit mx-auto my-4">
          <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
          Connecting...
        </div>
      )}

      {firebaseStatus === "connected" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-950 border border-green-700 text-green-300 text-sm w-fit mx-auto my-4"
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          🟢 Multiplayer ready
        </motion.div>
      )}

      {firebaseStatus === "failed" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-950 border border-yellow-700 text-yellow-300 text-sm w-fit mx-auto my-4"
        >
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          🟡 Not connected — Local only
        </motion.div>
      )}

      {/* Join with PIN button */}
      <div className="flex justify-center my-8">
        <motion.a
          href="/join"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="relative inline-flex items-center gap-3 px-8 py-4 rounded-full text-white font-bold text-lg overflow-hidden shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #DC2626, #9333EA, #2563EB, #DC2626)",
            backgroundSize: "300% 300%",
            animation: "gradientShift 4s ease infinite",
          }}
        >
          {/* Shimmer overlay */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)",
              animation: "shimmer 3s ease infinite",
            }}
          />
          <span className="text-2xl">🎮</span>
          <span className="relative z-10">Join a Game with PIN</span>
          <span className="relative z-10 text-xl">→</span>
        </motion.a>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-10 flex-1 w-full">

        {/* Section title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Choose a Game</h2>
          <p className="text-slate-400 text-sm mt-1">
            Click any game to launch a demo instantly — no setup required
          </p>
          <div className="mt-4 border-b border-slate-800" />
        </div>

        {/* Game grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {GAMES.map((game, i) => (
            <motion.div
              key={game.id}
              className="relative bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden cursor-pointer group hover:border-slate-500 transition-colors duration-300"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
              whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
              onClick={() => navigate(game.route)}
            >
              {/* Robot Run sparkle accents */}
              {game.isRobotRun && (
                <>
                  <motion.span
                    className="absolute top-2 right-2 text-base pointer-events-none z-10"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >✨</motion.span>
                  <motion.span
                    className="absolute top-2 left-2 text-sm pointer-events-none z-10"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  >✨</motion.span>
                  <motion.span
                    className="absolute bottom-16 right-3 text-xs pointer-events-none z-10"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear', delay: 1 }}
                  >✨</motion.span>
                </>
              )}

              {/* Top accent bar */}
              <div className={`h-1 w-full ${game.accentBar}`} />

              {/* Card body */}
              <div className="p-5 text-center">
                <div
                  className="text-6xl mt-4"
                  style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}
                >
                  {game.emoji}
                </div>
                <h3 className="text-lg font-bold text-white mt-3">{game.title}</h3>
                <p className="text-sm text-slate-400 mt-1 mb-4 min-h-[40px]">{game.description}</p>
                <button
                  className={`w-full py-3 rounded-xl font-bold transition-colors ${game.buttonClass}`}
                >
                  <span className="inline-flex items-center gap-1 justify-center">
                    Play Demo
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Global Leaderboard Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">🏆 Global Leaderboard</h2>
            <p className="text-slate-400 text-sm mt-1">Top players across all SpanishVIP game sessions</p>
          </div>
          {/* Tab switcher */}
          <div className="flex bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => setLeaderboardTab("allTime")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                leaderboardTab === "allTime"
                  ? "bg-yellow-400 text-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setLeaderboardTab("weekly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                leaderboardTab === "weekly"
                  ? "bg-yellow-400 text-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              This Week
            </button>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
          {leaderboardLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : globalLeaderboard.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🎮</div>
              <p className="text-slate-400">No scores yet — be the first on the leaderboard!</p>
              <a href="/join" className="text-yellow-400 hover:text-yellow-300 text-sm mt-2 inline-block">
                Join a game →
              </a>
            </div>
          ) : (
            <div>
              {/* Top 3 podium */}
              {globalLeaderboard.length >= 3 && (
                <div className="flex items-end justify-center gap-4 p-8 bg-gradient-to-b from-slate-800 to-slate-900">
                  {/* 2nd place */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-center"
                  >
                    <div className="text-3xl mb-2">🥈</div>
                    <div className="bg-slate-700 rounded-t-xl px-6 py-4 h-24 flex flex-col items-center justify-end">
                      <div className="text-slate-300 font-bold text-sm">{globalLeaderboard[1]?.name}</div>
                      <div className="text-slate-400 text-xs">{leaderboardTab === "weekly" ? globalLeaderboard[1]?.weeklyPoints : globalLeaderboard[1]?.totalPoints} pts</div>
                    </div>
                  </motion.div>
                  {/* 1st place */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <div className="text-4xl mb-2">🥇</div>
                    <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-t-xl px-8 py-4 h-32 flex flex-col items-center justify-end">
                      <div className="text-yellow-300 font-bold">{globalLeaderboard[0]?.name}</div>
                      <div className="text-yellow-400/70 text-xs">{leaderboardTab === "weekly" ? globalLeaderboard[0]?.weeklyPoints : globalLeaderboard[0]?.totalPoints} pts</div>
                    </div>
                  </motion.div>
                  {/* 3rd place */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center"
                  >
                    <div className="text-3xl mb-2">🥉</div>
                    <div className="bg-slate-700 rounded-t-xl px-6 py-4 h-16 flex flex-col items-center justify-end">
                      <div className="text-slate-300 font-bold text-sm">{globalLeaderboard[2]?.name}</div>
                      <div className="text-slate-400 text-xs">{leaderboardTab === "weekly" ? globalLeaderboard[2]?.weeklyPoints : globalLeaderboard[2]?.totalPoints} pts</div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Full list (4th place onwards) */}
              <div className="divide-y divide-slate-800">
                {globalLeaderboard.slice(3).map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="text-slate-500 font-mono text-sm w-6 text-right">{player.rank}</span>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">{player.name}</div>
                      <div className="text-slate-500 text-xs">
                        {leaderboardTab === "weekly" ? player.weeklyGamesPlayed : player.gamesPlayed} games played
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400 font-bold text-sm">
                        {leaderboardTab === "weekly" ? player.weeklyPoints : player.totalPoints} pts
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Sign up CTA at bottom */}
              <div className="text-center py-6 border-t border-slate-800">
                <p className="text-slate-500 text-sm">
                  Want to appear here?{" "}
                  <a href="/teacher/login" className="text-yellow-400 hover:text-yellow-300 font-medium">
                    Create a free account →
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-6 px-6 flex items-center justify-between text-slate-500 text-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo_hires_white.png" alt="SpanishVIP" className="h-6 object-contain opacity-60" />
          <span>© 2025 SpanishVIP</span>
        </div>
        <span>Built with ❤️ for corporate Spanish training</span>
      </footer>
    </div>
  );
};

export default Hub;
