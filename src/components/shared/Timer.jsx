import React from 'react';

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Display-only circular countdown timer.
 * @param {{ timeRemaining: number, duration: number }} props
 */
const Timer = ({ timeRemaining, duration }) => {
  const progress = duration > 0 ? timeRemaining / duration : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const color = progress > 0.5 ? '#22c55e' : progress > 0.25 ? '#fbbf24' : '#ef4444';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
        {/* Track */}
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#1e293b" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span className="absolute text-xl font-black text-white">{timeRemaining}</span>
    </div>
  );
};

export default Timer;
