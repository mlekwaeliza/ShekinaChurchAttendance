import React, { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import api from '../services/api';

const TwoFactorVerify = ({ userId, onSuccess, onBack }) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBackup, setUseBackup] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Enter a code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/2fa/verify-login', { token: token.trim(), userId });
      onSuccess(res.data.user);
    } catch (e) {
      setError(e.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Two-Step Verification</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {useBackup
              ? 'Enter one of your backup recovery codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200/60 dark:border-rose-700/60 text-rose-700 dark:text-rose-300 text-sm mb-6">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={token}
            onChange={(e) => {
              const nextValue = useBackup
                ? e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
                : e.target.value.replace(/\D/g, '').slice(0, 6);
              setToken(nextValue);
            }}
            className="input text-center text-2xl tracking-widest font-mono mb-4"
            placeholder={useBackup ? 'A1B2C3D4' : '000000'}
            maxLength={useBackup ? 8 : 6}
            autoFocus
          />

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setUseBackup(!useBackup); setToken(''); setError(''); }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            {useBackup ? 'Use authenticator app instead' : 'Use a backup code'}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 text-center">
          <button
            onClick={onBack}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerify;
