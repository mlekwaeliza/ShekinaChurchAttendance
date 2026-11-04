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
      <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-8 shadow-modal dark:border-white/[0.08]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/[0.12]">
            <Shield className="h-8 w-8 text-primary-700 dark:text-primary-300" />
          </div>
          <h2 className="text-title-2 font-semibold text-label">Two-Step Verification</h2>
          <p className="mt-2 text-subheadline leading-relaxed text-secondary-label">
            {useBackup
              ? 'Enter one of your backup recovery codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-system-red/10 px-4 py-3 text-footnote text-rose-700 dark:text-system-red">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={token}
            onChange={(e) => {
              const nextValue = useBackup
                ? e.target.value
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .toUpperCase()
                    .slice(0, 8)
                : e.target.value.replace(/\D/g, '').slice(0, 6);
              setToken(nextValue);
            }}
            className="input mb-4 text-center font-mono text-2xl tracking-widest"
            placeholder={useBackup ? 'A1B2C3D4' : '000000'}
            maxLength={useBackup ? 8 : 6}
            autoFocus
            aria-label="Verification code"
          />

          <button type="submit" disabled={loading} className="btn-primary h-11 w-full">
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setUseBackup(!useBackup);
              setToken('');
              setError('');
            }}
            className="text-footnote font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300"
          >
            {useBackup ? 'Use authenticator app instead' : 'Use a backup code'}
          </button>
        </div>

        <div className="mt-6 border-t border-separator/60 pt-4 text-center dark:border-white/[0.08]">
          <button
            onClick={onBack}
            className="text-footnote text-secondary-label transition-colors hover:text-label"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerify;
