import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { authAPI } from '../services/api';
import BrandMark from '../components/BrandMark';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!token) {
      setMessage({
        type: 'error',
        text: 'This password reset link is missing its security token.'
      });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Your new password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'The passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.resetPassword(token, newPassword);
      setMessage({ type: 'success', text: response.data.message });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error.response?.data?.error ||
          error.data?.error ||
          error.message ||
          'Unable to reset your password. Please request a new link.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-canvas flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-7 shadow-elevated dark:border-white/[0.08] sm:p-9">
        <BrandMark className="mb-10" />
        <div className="mb-7">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <p className="section-eyebrow">Secure password reset</p>
          <h1 className="mt-2 text-title-1 font-semibold text-label">Choose a new password</h1>
          <p className="mt-3 text-subheadline leading-relaxed text-secondary-label">
            Use a password with at least eight characters. This link can only be used once.
          </p>
        </div>

        {message.text && (
          <div
            className={`mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-footnote ${
              message.type === 'success'
                ? 'bg-system-green/10 text-emerald-700 dark:text-system-green'
                : 'bg-system-red/10 text-rose-700 dark:text-system-red'
            }`}
            role="status"
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {message.type === 'success' ? (
          <Link to="/login" className="btn-primary focus-ring h-12 w-full">
            Go to sign in
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="input-label" htmlFor="new-password">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input h-12 pr-12"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-tertiary-label hover:bg-system-fill hover:text-label"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="input-label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                className="input h-12"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="btn-primary focus-ring h-12 w-full"
            >
              {loading ? 'Saving password...' : 'Set new password'}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 block text-center text-footnote font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
