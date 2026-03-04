import React, { useState } from 'react';

/**
 * PIN + nickname entry form.
 * @param {{ onSubmit: ({ pin, nickname }) => void, loading?: boolean, error?: string }} props
 */
const PinEntry = ({ onSubmit, loading = false, error = null }) => {
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setValidationError('Please enter a valid 6-digit PIN.');
      return;
    }
    if (!nickname.trim()) {
      setValidationError('Please enter a nickname.');
      return;
    }
    if (nickname.trim().length > 20) {
      setValidationError('Nickname must be 20 characters or less.');
      return;
    }

    onSubmit({ pin, nickname: nickname.trim() });
  };

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1" htmlFor="pin">
          Game PIN
        </label>
        <input
          id="pin"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="w-full bg-slate-700 border border-slate-600 text-white text-3xl font-black text-center tracking-[0.5em] rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-brand-yellow placeholder:text-slate-500 placeholder:text-lg placeholder:tracking-normal"
        />
      </div>

      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1" htmlFor="nickname">
          Your Nickname
        </label>
        <input
          id="nickname"
          type="text"
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. SuperLearner42"
          className="w-full bg-slate-700 border border-slate-600 text-white text-xl font-semibold text-center rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-yellow placeholder:text-slate-500 placeholder:font-normal placeholder:text-base"
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
        className="w-full bg-brand-yellow hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-xl py-4 rounded-xl transition-colors shadow-lg"
      >
        {loading ? 'Joining...' : 'Join Game →'}
      </button>
    </form>
  );
};

export default PinEntry;
