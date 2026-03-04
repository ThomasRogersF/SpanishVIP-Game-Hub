import React from 'react';
import { Link } from 'react-router-dom';
import Leaderboard from './Leaderboard';

/**
 * Dark-themed layout shell for game screens.
 * Shows an optional live leaderboard sidebar on desktop.
 * @param {{ sessionId: string, children: React.ReactNode, showLeaderboard?: boolean, title?: string }} props
 */
const GameWrapper = ({ sessionId, children, showLeaderboard = true, title = '' }) => {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* Top nav */}
      <nav className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
        <Link to="/" className="text-brand-red font-black text-lg tracking-tight hover:text-red-400 transition-colors">
          🇪🇸 SpanishVIP
        </Link>
        {title && <span className="text-slate-400 text-sm font-medium">{title}</span>}
        {sessionId && sessionId !== 'demo' && (
          <span className="text-slate-500 text-xs font-mono">PIN: {sessionId}</span>
        )}
        {(!sessionId || sessionId === 'demo') && (
          <span className="bg-slate-700 text-slate-400 text-xs px-2 py-1 rounded">Demo Mode</span>
        )}
      </nav>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Game content */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Leaderboard sidebar — desktop only */}
        {showLeaderboard && (
          <aside className="hidden lg:block w-64 xl:w-72 p-4 bg-slate-950 border-l border-slate-800 overflow-y-auto">
            <Leaderboard sessionId={sessionId} />
          </aside>
        )}
      </div>
    </div>
  );
};

export default GameWrapper;
