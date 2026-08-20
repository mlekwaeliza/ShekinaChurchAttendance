import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Clock,
  Eye,
  EyeOff,
  HeartHandshake,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import TwoFactorVerify from '../components/TwoFactorVerify';
import BrandMark from '../components/BrandMark';
import api from '../services/api';

const roleHome = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'accountant') return '/accountant';
  if (role === 'evangelist') return '/evangelist';
  if (role === 'pastor') return '/pastor';
  return '/leader';
};

const featureCards = [
  {
    icon: UsersRound,
    label: 'People',
    description: 'One dependable record for every member and household.',
  },
  {
    icon: BarChart3,
    label: 'Insight',
    description: 'See attendance, growth, and care needs as they happen.',
  },
  {
    icon: HeartHandshake,
    label: 'Care',
    description: 'Help leaders turn follow-ups into meaningful connection.',
  },
];

const Login = () => {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const { user, setUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const expiredFlag = searchParams.get('expired') === '1';
  const navigate = useNavigate();

  useEffect(() => {
    if (!expiredFlag) return undefined;
    const timer = setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('expired');
      setSearchParams(nextParams, { replace: true });
    }, 8000);
    return () => clearTimeout(timer);
  }, [expiredFlag, searchParams, setSearchParams]);

  if (user && !requires2FA) {
    return <Navigate to={roleHome(user.role)} />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      // A production instance may need a little longer to wake its database
      // before the first authenticated request. Keep the normal API timeout
      // for dashboard requests, but allow this one login attempt to finish.
      const response = await api.post('/auth/login', { username, password }, { timeout: 120000 });
      if (response.data.requires2FA) {
        setRequires2FA(true);
        setPendingUserId(response.data.userId);
      } else {
        setUser(response.data.user);
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
        requestError.data?.error ||
        requestError.original?.response?.data?.error ||
        requestError.message ||
        'We could not sign you in. Check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = (loggedInUser) => {
    setUser(loggedInUser);
    navigate(roleHome(loggedInUser.role));
  };

  if (requires2FA) {
    return (
      <div className="app-canvas flex min-h-screen items-center justify-center overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(20,168,150,0.12),transparent_28rem)]" />
        <div className="relative z-10">
          <TwoFactorVerify
            userId={pendingUserId}
            onSuccess={handle2FASuccess}
            onBack={() => {
              setRequires2FA(false);
              setPendingUserId(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <main className="app-canvas min-h-screen p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[92rem] overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-[0_30px_90px_rgba(10,22,40,0.14)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_0.92fr] dark:border-white/10 dark:bg-slate-950">
        <section className="relative hidden overflow-hidden bg-[#0a1628] px-12 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(20,168,150,0.25),transparent_22rem),radial-gradient(circle_at_10%_90%,rgba(242,184,75,0.12),transparent_26rem)]" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />

          <BrandMark inverse className="relative z-10" />

          <div className="relative z-10 my-auto max-w-2xl py-12">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-200">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              One connected church workspace
            </div>
            <h1 className="max-w-xl font-display text-5xl font-semibold leading-[1.04] tracking-[-0.045em] xl:text-6xl">
              Care for people.
              <span className="mt-2 block text-primary-300">See the whole church.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 xl:text-lg">
              Attendance, people, leaders, finance, and pastoral care—designed to help every ministry act with clarity.
            </p>

            <div className="mt-10 grid gap-3 xl:grid-cols-3">
              {featureCards.map(({ icon: Icon, label, description }) => (
                <article key={label} className="rounded-2xl border border-white/[0.09] bg-white/[0.055] p-4 backdrop-blur-sm">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-400/15 text-primary-200">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h2 className="text-sm font-bold">{label}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">{description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-slate-500">
            <Check className="h-4 w-4 text-primary-400" />
            Built for ministry teams, from Sunday service to weekday care.
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <BrandMark className="mb-12 lg:hidden" />

            <div className="mb-8">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="section-eyebrow">Secure staff portal</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white sm:text-4xl">
                {t('auth.welcomeBack')}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t('auth.enterCredentials')}
              </p>
              <button
                type="button"
                onClick={() => i18n.changeLanguage(i18n.language?.startsWith('sw') ? 'en' : 'sw')}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                {i18n.language?.startsWith('sw') ? 'English' : 'Kiswahili'} →
              </button>
            </div>

            {expiredFlag && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Your session expired for your security. Please sign in again.</span>
              </div>
            )}

            {error && (
              <div aria-live="polite" className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="input-label" htmlFor="username">{t('auth.username')}</label>
                <input
                  id="username"
                  type="text"
                  className="input h-12"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                  placeholder={t('auth.username')}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">{t('auth.password')}</label>
                  <span className="text-[11px] font-medium text-slate-400">Case sensitive</span>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input h-12 pr-12"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder={t('auth.password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary focus-ring h-12 w-full">
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('auth.signingIn')}
                  </>
                ) : (
                  <>
                    {t('auth.signIn')}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6 text-xs leading-5 text-slate-400 dark:border-white/10 dark:text-slate-500">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
              Access is restricted to authorized church staff and ministry leaders.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
