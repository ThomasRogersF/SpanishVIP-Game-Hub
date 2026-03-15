import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerTeacher, loginTeacher, saveTeacherSession } from '../firebase/teachers';

const TeacherLogin = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin'); // signin | register-teacher | register-student
  const [nameInput, setNameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const { teacherId, name, role } = await loginTeacher(nameInput, pinInput);
      saveTeacherSession(teacherId, name, role);
      if (role === "teacher") {
        navigate('/teacher');
      } else {
        navigate('/join');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (pinInput !== confirmPin) {
      setError("PINs don't match");
      return;
    }
    try {
      setLoading(true);
      const { teacherId, name, role } = await registerTeacher(nameInput, pinInput, "teacher");
      saveTeacherSession(teacherId, name, role);
      navigate('/teacher');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (pinInput !== confirmPin) {
      setError("PINs don't match");
      return;
    }
    try {
      setLoading(true);
      const { teacherId, name, role } = await registerTeacher(nameInput, pinInput, "student");
      saveTeacherSession(teacherId, name, role);
      navigate('/join');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setError('');
    setNameInput('');
    setPinInput('');
    setConfirmPin('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative">
      <div className="absolute top-6 left-6">
        <a
          href="/"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Back to Home
        </a>
      </div>
      <div className="bg-slate-900 rounded-2xl p-8 max-w-md w-full border border-slate-700 shadow-xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo_hires_white.png" alt="SpanishVIP" className="max-h-12 object-contain" />
        </div>

        {/* Title */}
        <h1 className="text-white text-2xl font-bold text-center mb-1">
          {tab === 'register-student' ? 'Create Student Account' : 'Teacher Portal'}
        </h1>
        <p className="text-slate-400 text-sm text-center mb-6">
          {tab === 'register-student'
            ? 'Track your scores and appear on the leaderboard'
            : 'Sign in to access your private templates'}
        </p>

        {/* Tab Switcher */}
        <div className="flex mb-6 bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => { setTab('signin'); clearForm(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'signin' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('register-teacher'); clearForm(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'register-teacher' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Teacher Register
          </button>
          <button
            onClick={() => { setTab('register-student'); clearForm(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'register-student' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Student Register
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-700 text-red-300 rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Sign In Form */}
        {tab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-yellow-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter your PIN"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-yellow-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors font-mono tracking-widest"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Teacher Register Form */}
        {tab === 'register-teacher' && (
          <form onSubmit={handleTeacherRegister} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">Full Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-yellow-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">Choose PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4–8 digits"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-yellow-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors font-mono tracking-widest"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Re-enter PIN"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-yellow-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors font-mono tracking-widest"
              />
            </div>
            <p className="text-slate-500 text-xs">4–8 digits. Remember this — it cannot be recovered.</p>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Teacher Account'}
            </button>
          </form>
        )}

        {/* Student Register Form */}
        {tab === 'register-student' && (
          <form onSubmit={handleStudentRegister} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">Full Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-blue-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">Choose PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4–8 digits"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-blue-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors font-mono tracking-widest"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Re-enter PIN"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-blue-400 text-white rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors font-mono tracking-widest"
              />
            </div>
            <p className="text-slate-500 text-xs">4–8 digits. Remember this — it cannot be recovered.</p>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Student Account'}
            </button>
          </form>
        )}

        {/* Bottom note */}
        <p className="text-slate-500 text-xs text-center mt-4">
          Student accounts are optional — you can always join games as a guest without an account.
        </p>
        <p className="text-slate-600 text-xs text-center mt-2">
          Student? Go to <Link to="/join" className="text-yellow-400 hover:text-yellow-300">/join</Link> to enter a game PIN
        </p>
      </div>
    </div>
  );
};

export default TeacherLogin;
