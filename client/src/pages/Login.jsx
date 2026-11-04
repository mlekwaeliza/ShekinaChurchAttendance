import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  HeartHandshake,
  ShieldCheck,
  UsersRound
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
    description: 'One dependable record for every member and household.'
  },
  {
    icon: BarChart3,
    label: 'Insight',
    description: 'See attendance, growth, and care needs as they happen.'
  },
  {
    icon: HeartHandshake,
    label: 'Care',
    description: 'Help leaders turn follow-ups into meaningful connection.'
  }
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
        <div className="relative z-10 w-full max-w-md">
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
    <main className="app-canvas min-h-screen p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[88rem] overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-secondary-system-grouped-background shadow-[0_24px_70px_rgba(10,22,40,0.12)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.05fr_0.95fr] dark:border-white/[0.08]">
        <section className="relative hidden overflow-hidden bg-[#0a1628] px-12 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
          <div className="pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-primary-500/[0.14] blur-3xl" />

          <BrandMark inverse className="relative z-10" />

          <div className="relative z-10 my-auto max-w-lg py-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-300">
              Church operations
            </p>
            <h1 className="mt-4 font-display text-[2.75rem] font-semibold leading-[1.06] tracking-[-0.03em]">
              Care for people.
              <span className="mt-1 block text-primary-300">See the whole church.</span>
            </h1>
            <p className="mt-5 max-w-md text-subheadline leading-6 text-white/55">
              Attendance, people, leaders, finance, and pastoral care in one workspace built for
              clarity.
            </p>

            <ul className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {featureCards.map(({ icon: Icon, label, description }) => (
                <li key={label} className="flex gap-4 py-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-primary-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-subheadline font-semibold text-white">{label}</h2>
                    <p className="mt-1 text-footnote leading-5 text-white/45">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-footnote text-white/40">
            <ShieldCheck className="h-4 w-4 text-primary-400" />
            Built for ministry teams, from Sunday service to weekday care.
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
          <div className="w-full max-w-[24rem]">
            <BrandMark className="mb-10 lg:hidden" />

            <div className="mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary-label">
                Secure staff portal
              </p>
              <h1 className="mt-2 text-large-title font-semibold text-label">
                {t('auth.welcomeBack')}
              </h1>
              <p className="mt-2 text-subheadline leading-6 text-secondary-label">
                {t('auth.enterCredentials')}
              </p>
              <button
                type="button"
                onClick={() => i18n.changeLanguage(i18n.language?.startsWith('sw') ? 'en' : 'sw')}
                className="mt-3 inline-flex items-center gap-1 text-footnote font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
              >
                {i18n.language?.startsWith('sw') ? 'English' : 'Kiswahili'}
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {expiredFlag && (
              <div className="mb-5 flex items-start gap-3 rounded-xl bg-system-orange/10 px-4 py-3 text-footnote text-amber-800 dark:text-system-orange">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Your session expired for your security. Please sign in again.</span>
              </div>
            )}

            {error && (
              <div
                aria-live="polite"
                className="mb-5 flex items-start gap-3 rounded-xl bg-system-red/10 px-4 py-3 text-footnote text-rose-700 dark:text-system-red"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label" htmlFor="username">
                  {t('auth.username')}
                </label>
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
                <div className="mb-2 flex items-center justify-between">
                  <label
                    className="text-footnote font-semibold text-secondary-label"
                    htmlFor="password"
                  >
                    {t('auth.password')}
                  </label>
                  <span className="text-[11px] text-secondary-label">Case sensitive</span>
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
                    className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-secondary-label hover:bg-system-fill hover:text-label"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary focus-ring mt-2 h-12 w-full text-[15px]"
              >
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

            <div className="mt-8 flex items-start gap-2.5 border-t border-separator/60 pt-6 text-[12px] leading-5 text-secondary-label dark:border-white/[0.08]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
              Access is restricted to authorized church staff and ministry leaders.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
