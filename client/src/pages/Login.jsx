import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import TwoFactorVerify from '../components/TwoFactorVerify';
import api from '../services/api';
import { Church, ArrowRight, Sparkles, Clock } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const { login, user, setUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const expiredFlag = searchParams.get('expired') === '1';
  const navigate = useNavigate();

  if (user && !requires2FA) {
    const redirectPath = user.role === 'admin' ? '/admin' : user.role === 'accountant' ? '/accountant' : user.role === 'evangelist' ? '/evangelist' : user.role === 'pastor' ? '/pastor' : '/leader';
    return <Navigate to={redirectPath} />;
  }

  // Auto-clear the ?expired=1 query param after first render so a
  // refresh of /login doesn't keep showing the banner.
  useEffect(() => {
    if (expiredFlag) {
      const t = setTimeout(() => {
        const sp = new URLSearchParams(searchParams);
        sp.delete('expired');
        setSearchParams(sp, { replace: true });
      }, 8000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [expiredFlag, searchParams, setSearchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data.requires2FA) {
        setRequires2FA(true);
        setPendingUserId(res.data.userId);
      } else {
        // Use the user from the login response directly — no second API call needed
        setUser(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = (loggedInUser) => {
    setUser(loggedInUser);
    const redirectPath = loggedInUser.role === 'admin' ? '/admin' : loggedInUser.role === 'accountant' ? '/accountant' : loggedInUser.role === 'evangelist' ? '/evangelist' : loggedInUser.role === 'pastor' ? '/pastor' : '/leader';
    navigate(redirectPath);
  };

  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        <TwoFactorVerify
          userId={pendingUserId}
          onSuccess={handle2FASuccess}
          onBack={() => { setRequires2FA(false); setPendingUserId(null); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden p-4">
      {/* Animated background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-3xl overflow-hidden shadow-2xl relative z-10">
        {/* Left side - Branding */}
        <div className="hidden lg:flex flex-col justify-center items-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24"></div>
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 shadow-lg">
              <Church className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">Church Attendance</h1>
            <p className="text-white/80 text-lg mb-8">Track, manage, and grow your congregation</p>
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                <span className="text-sm">Real-time attendance tracking</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <Sparkles className="w-5 h-5 text-emerald-300 shrink-0" />
                <span className="text-sm">Section leader management</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <Sparkles className="w-5 h-5 text-sky-300 shrink-0" />
                <span className="text-sm">Analytics & insights dashboard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="bg-white dark:bg-slate-800 p-8 sm:p-10 lg:p-12">
          <div className="text-center mb-8">
            <div className="lg:hidden inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/20">
              <Church className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Sign in to your account</p>
          </div>

          {expiredFlag && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-xl mb-6 text-sm font-medium flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Your session has expired. Please log in again.</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-semibold mb-2" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 text-slate-900 dark:text-white placeholder-slate-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-semibold mb-2" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 text-slate-900 dark:text-white placeholder-slate-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center text-sm text-slate-400 dark:text-slate-500">
            <p>Contact your administrator for login credentials</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
