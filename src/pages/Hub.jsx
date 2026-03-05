import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const GAMES = [
  {
    id: 'multiple-choice',
    title: 'Multiple Choice Quiz',
    emoji: '🎯',
    description: '4 options, speed + accuracy scoring',
    route: '/game/multiple-choice/demo',
    gradient: 'from-red-500 to-red-700',
    available: true,
  },
  {
    id: 'true-or-false',
    title: 'True or False',
    emoji: '✅',
    description: 'Rapid-fire, streak combos',
    route: '/game/true-or-false/demo',
    gradient: 'from-blue-500 to-blue-700',
    available: false,
  },
  {
    id: 'word-cloud',
    title: 'Word Cloud',
    emoji: '☁️',
    description: 'Free-form answers visualized',
    route: '/game/word-cloud/demo',
    gradient: 'from-purple-500 to-purple-700',
    available: false,
  },
  {
    id: 'puzzle',
    title: 'Puzzle Sequencing',
    emoji: '🧩',
    description: 'Drag and drop ordering',
    route: '/game/puzzle/demo',
    gradient: 'from-orange-500 to-orange-700',
    available: false,
  },
  {
    id: 'type-answer',
    title: 'Type Answer',
    emoji: '⌨️',
    description: 'Type the exact answer',
    route: '/game/type-answer/demo',
    gradient: 'from-teal-500 to-teal-700',
    available: false,
  },
  {
    id: 'opinion-poll',
    title: 'Opinion Poll',
    emoji: '📊',
    description: 'Live results with charts',
    route: '/game/opinion-poll/demo',
    gradient: 'from-pink-500 to-pink-700',
    available: false,
  },
  {
    id: 'robot-run',
    title: 'Robot Run',
    emoji: '🤖',
    description: 'Escape the robot narrative game',
    route: '/game/robot-run/demo',
    gradient: 'from-indigo-500 to-indigo-700',
    available: false,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' },
  }),
};

const Hub = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Hero header */}
      <header className="bg-gradient-to-br from-brand-red via-purple-900 to-purple-800 py-12 px-6 text-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full" />

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
            SpanishVIP Game Hub
          </h1>
          <p className="text-red-200 text-lg mb-8">
            Interactive Learning for Corporate Spanish Classes
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/teacher"
              className="bg-white text-brand-red font-bold py-3 px-7 rounded-xl hover:bg-red-50 transition-colors shadow-lg"
            >
              Teacher Dashboard
            </Link>
            <Link
              to="/join"
              className="bg-brand-yellow text-black font-bold py-3 px-7 rounded-xl hover:bg-yellow-300 transition-colors shadow-lg"
            >
              Join a Game →
            </Link>
          </div>
        </motion.div>
      </header>

      {/* Game grid */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-6">
          Choose a Game
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {GAMES.map((game, i) => (
            <motion.div
              key={game.id}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-slate-500 transition-colors group cursor-pointer shadow-lg hover:shadow-xl"
              onClick={() => navigate(game.route)}
            >
              {/* Card gradient header */}
              <div className={`bg-gradient-to-br ${game.gradient} p-6 flex items-center justify-between`}>
                <span className="text-5xl">{game.emoji}</span>
                {!game.available && (
                  <span className="bg-black/30 text-white/80 text-xs font-bold px-2 py-1 rounded-lg">
                    Soon
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="p-5">
                <h3 className="text-white font-bold text-lg leading-tight mb-1 group-hover:text-brand-yellow transition-colors">
                  {game.title}
                </h3>
                <p className="text-slate-400 text-sm mb-4">{game.description}</p>

                <button
                  className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${
                    game.available
                      ? 'bg-brand-red hover:bg-red-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {game.available ? 'Launch →' : 'Coming Soon'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-600 text-sm border-t border-slate-800">
        SpanishVIP Game Hub · Built for corporate Spanish classes
      </footer>
    </div>
  );
};

export default Hub;
