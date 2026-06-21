import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import useOffline from '../hooks/useOffline';
import { BreadcrumbProvider } from '../context/BreadcrumbContext';
import Breadcrumbs from './ui/Breadcrumbs';
import NotificationBell from './NotificationBell';
import { authAPI } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import useEventStream from '../hooks/useEventStream';
import { useToast } from '../context/ToastContext';
import {
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
  Clock,
  BarChart3,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Bell,
  Shield,
  ChevronDown,
  Menu,
  X,
  Church,
  Activity,
  ClipboardList,
  Eye,
  Layers,
  Moon,
  Sun,
  ShieldCheck,
  MessageSquare,
  Cake,
  Calendar,
  Home,
  Megaphone,
  ClipboardCheck,
  UserPlus,
  RefreshCw,
  Edit3,
  Award,
  Building2,
  Heart,
  Cross,
} from 'lucide-react';

const Layout = ({ children, showNav = true }) => {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOnline, pendingCount, syncing, syncPending, conflicts } = useOffline();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileImgKey, setProfileImgKey] = useState(0);
  const [refreshingApp, setRefreshingApp] = useState(false);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 1-hour client-side idle detector. Server enforces a matching
  // rolling timeout on the session cookie, but a tab left open without
  // network activity can sit idle for a long time. Any user input
  // (mousemove, keydown, click, scroll, touch) resets the timer.
  const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
  const IDLE_WARNING_MS = 55 * 60 * 1000; // warn 5 min before logout
  useEffect(() => {
    if (!user) return undefined;
    let warnTimer = null;
    let logoutTimer = null;
    let warned = false;
    const reset = () => {
      warned = false;
      if (warnTimer) clearTimeout(warnTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
      warnTimer = setTimeout(() => {
        warned = true;
        try { showToast({ type: 'warning', message: 'You will be logged out in 5 minutes due to inactivity.' }); } catch (_e) { /* ignore */ }
      }, IDLE_WARNING_MS);
      logoutTimer = setTimeout(() => {
        if (warned) {
          try { showToast({ type: 'info', message: 'Logged out due to inactivity.' }); } catch (_e) { /* ignore */ }
          logout();
        }
      }, IDLE_TIMEOUT_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (warnTimer) clearTimeout(warnTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
    };
  }, [user, logout, showToast]);

  // Server-side session expiry (401) -> show toast + logout.
  useEffect(() => {
    const handler = (event) => {
      const msg = event?.detail?.message || 'Your session has expired. Please log in again.';
      try { showToast({ type: 'warning', message: msg }); } catch (_e) { /* ignore */ }
      logout();
    };
    window.addEventListener('app:session-expired', handler);
    return () => window.removeEventListener('app:session-expired', handler);
  }, [logout, showToast]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!profileDropdown) return;
    const handler = () => setProfileDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [profileDropdown]);

  const handleProfileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await authAPI.uploadProfilePicture(file);
      updateUser({ profile_picture: res.data.profile_picture });
      setProfileImgKey(prev => prev + 1);
    } catch (err) {
      alert('Failed to upload: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleRefreshApp = async () => {
    if (refreshingApp) return;
    setRefreshingApp(true);
    const forceReload = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', Date.now().toString());
      window.location.replace(url.toString());
    };

    try {
      const refreshPrep = async () => {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(async (registration) => {
            await registration.update();
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }));
        }
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
      };
      await Promise.race([
        refreshPrep(),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
    } catch (error) {
      console.warn('App refresh preparation failed:', error);
    } finally {
      forceReload();
    }
  };

  // Navigation structure per role
  const navConfig = {
    admin: [
      { section: 'MAIN', items: [
        { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      ]},
      { section: 'MANAGEMENT', items: [
        { path: '/admin/sections', label: 'Sections', icon: Layers },
        { path: '/admin/members', label: 'Members', icon: Users },
        { path: '/admin/leaders', label: 'Leaders', icon: UserCog },
        { path: '/admin/home-cells', label: 'Home Cells', icon: Home },
        { path: '/admin/titles', label: 'Titles', icon: Award },
        { path: '/admin/leadership', label: 'Leadership', icon: Users },
        { path: '/admin/departments', label: 'Departments', icon: Building2 },
        { path: '/admin/new-members', label: 'New Members', icon: UserPlus },
      ]},
      { section: 'INSIGHTS', items: [
        { path: '/admin/calendar', label: 'Calendar', icon: Calendar },
        { path: '/admin/reports', label: 'Reports', icon: FileText },
        { path: '/admin/history', label: 'History', icon: Clock },
        { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/admin/birthdays', label: 'Birthdays', icon: Cake },
        { path: '/admin/announcements', label: 'Announcements', icon: Megaphone },
        { path: '/admin/follow-ups', label: 'Follow-ups', icon: ClipboardCheck },
        { path: '/admin/rewards', label: 'Hall of Fame', icon: Trophy },
      ]},
      { section: 'EVANGELISM', items: [
        { path: '/evangelist', label: 'Evangelist Dashboard', icon: Heart, exact: true },
        { path: '/evangelist/outreach', label: 'Outreach Events', icon: Calendar },
        { path: '/evangelist/souls', label: 'Souls Won', icon: Users },
        { path: '/evangelist/follow-ups', label: 'Follow-Ups', icon: MessageSquare },
        { path: '/evangelist/team', label: 'Evangelism Team', icon: Users },
        { path: '/evangelist/baptism', label: 'Baptism', icon: Cross },
        { path: '/evangelist/reports', label: 'Reports', icon: BarChart3 },
      ]},
      { section: 'SYSTEM', items: [
        { path: '/admin/audit', label: 'Audit Log', icon: ShieldCheck },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
      ]},
    ],
    leader: [
      { section: 'MAIN', items: [
        { path: '/leader', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { path: '/leader/calendar', label: 'Calendar', icon: Calendar },
        { path: '/leader/attendance', label: 'Take Attendance', icon: ClipboardList },
        { path: '/leader/members', label: 'My Members', icon: Users },
        { path: '/leader/home-cells', label: 'Home Cell Members', icon: Home },
        { path: '/leader/outreach', label: 'Outreach', icon: MessageSquare },
        { path: '/leader/history', label: 'History', icon: Clock },
        { path: '/leader/reports', label: 'Reports', icon: BarChart3 },
        ...(user?.is_head ? [{ path: '/leader/overview', label: 'Section Overview', icon: Eye }] : []),
        ...(user?.is_new_member_leader ? [{ path: '/leader/new-members', label: 'New Members', icon: UserPlus }] : []),
      ]},
    ],
    evangelist: [
      { section: 'EVANGELISM', items: [
        { path: '/admin/evangelism', label: 'Evangelism Dashboard', icon: Heart, exact: true },
        { path: '/admin/evangelism', label: 'Outreach Events', icon: Calendar, search: '?subtab=outreach' },
        { path: '/admin/evangelism', label: 'Souls Won', icon: Users, search: '?subtab=souls' },
        { path: '/admin/evangelism', label: 'Follow-Ups', icon: MessageSquare, search: '?subtab=follow-ups' },
        { path: '/admin/evangelism', label: 'Evangelism Team', icon: Users, search: '?subtab=team' },
        { path: '/admin/evangelism', label: 'Baptism', icon: Cross, search: '?subtab=baptism' },
        { path: '/admin/evangelism', label: 'Reports', icon: BarChart3, search: '?subtab=reports' },
      ]},
      { section: 'ACCOUNT', items: [
        { path: '/change-password', label: 'Change Password', icon: Shield },
        { path: '/evangelist/settings', label: 'Settings', icon: Settings },
      ]},
    ],
    pastor: [
      { section: 'MAIN', items: [
        { path: '/pastor', label: 'Overview', icon: LayoutDashboard, exact: true },
        { path: '/pastor/calendar', label: 'Calendar', icon: Calendar },
        { path: '/pastor/insights', label: 'Insights', icon: Activity },
        { path: '/pastor/engagement', label: 'Engagement', icon: MessageSquare },
        { path: '/pastor/weekly', label: 'Weekly Summary', icon: Calendar },
        { path: '/pastor/birthdays', label: 'Birthdays', icon: Cake },
      ]},
      { section: 'EVANGELISM', items: [
        { path: '/evangelist', label: 'Evangelist Dashboard', icon: Heart, exact: true },
        { path: '/evangelist/outreach', label: 'Outreach Events', icon: Calendar },
        { path: '/evangelist/souls', label: 'Souls Won', icon: Users },
        { path: '/evangelist/follow-ups', label: 'Follow-Ups', icon: MessageSquare },
        { path: '/evangelist/team', label: 'Evangelism Team', icon: Users },
        { path: '/evangelist/baptism', label: 'Baptism', icon: Cross },
        { path: '/evangelist/reports', label: 'Reports', icon: BarChart3 },
      ]},
    ],
  };

  const currentNav = (() => {
    if (user?.role === 'leader' && user?.is_new_member_leader) {
      return [
        {
          section: 'NEW MEMBERS',
          items: [
            { path: '/leader', label: 'Dashboard', icon: LayoutDashboard, exact: true },
            { path: '/leader/new-members', label: 'New Members', icon: UserPlus },
            { path: '/leader/attendance', label: 'Take Attendance', icon: ClipboardList },
            { path: '/leader/calendar', label: 'Calendar', icon: Calendar },
          ]
        },
        {
          section: 'ACCOUNT',
          items: [
            { path: '/leader/settings', label: 'Settings', icon: Settings },
          ]
        }
      ];
    }
    return navConfig[user?.role] || [];
  })();

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    const path = location.pathname;
    if (!path.startsWith(item.path)) return false;
    return path.length === item.path.length || path[item.path.length] === '/' || path[item.path.length] === '?';
  };

  const pageTitle = (() => {
    const path = location.pathname;
    // Find the matching nav item
    for (const group of currentNav) {
      for (const item of group.items) {
        if (item.exact ? path === item.path : path.startsWith(item.path)) {
          return item.label;
        }
      }
    }
    if (path.includes('change-password')) return 'Change Password';
    return 'Dashboard';
  })();

  const roleLabel = {
    admin: 'Administrator',
    leader: user?.is_new_member_leader ? 'New Member Leader' : user?.is_head ? 'Head Leader' : 'Section Leader',
    pastor: 'Pastor',
    evangelist: 'Evangelist Pastor',
  };

  const roleBadgeColor = {
    admin: 'bg-primary-500/20 text-primary-300',
    leader: 'bg-emerald-500/20 text-emerald-300',
    pastor: 'bg-accent-500/20 text-accent-300',
    evangelist: 'bg-amber-500/20 text-amber-300',
  };

  // --- Sidebar Content ---
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-16 shrink-0 border-b border-sidebar-border/30 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
          <Church className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Church</h1>
            <p className="text-[10px] text-sidebar-text/50 font-medium">Attendance System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-1">
        {currentNav.map((group, gi) => (
          <div key={gi}>
            {!collapsed && group.section !== 'MAIN' && (
              <div className="sidebar-section-label">{group.section}</div>
            )}
            {collapsed && gi > 0 && (
              <div className="h-px bg-sidebar-border/20 mx-2 my-3" />
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.path + (item.search || '')}
                  to={item.path + (item.search || '')}
                  title={collapsed ? item.label : undefined}
                  className={`sidebar-nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon className="nav-icon" />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {active && !collapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden md:block px-3 py-2 border-t border-sidebar-border/20">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-nav-item w-full justify-center"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="truncate text-xs">Collapse</span>}
        </button>
      </div>

      {/* User Profile */}
      <div className={`px-3 py-3 border-t border-sidebar-border/20 ${collapsed ? 'flex justify-center' : ''}`}>
        <div
          className={`flex items-center gap-3 ${collapsed ? '' : 'p-2 rounded-xl hover:bg-sidebar-hover transition-colors cursor-pointer'}`}
          onClick={(e) => { e.stopPropagation(); setProfileDropdown(!profileDropdown); }}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            {user?.profile_picture ? (
              <img
                src={`${user.profile_picture}?v=${profileImgKey}`}
                alt=""
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-sm font-bold text-white">
                {user?.full_name?.charAt(0)}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-sidebar" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleBadgeColor[user?.role] || ''}`}>
                {roleLabel[user?.role] || user?.role}
              </span>
            </div>
          )}

          {!collapsed && <ChevronDown className="w-4 h-4 text-sidebar-text/50 shrink-0" />}
        </div>

        {/* Profile Dropdown */}
        {profileDropdown && !collapsed && (
          <div className="absolute bottom-20 left-3 right-3 bg-white rounded-xl shadow-elevated border border-slate-200 py-1 animate-scale-in z-50" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { navigate(user?.role === 'admin' ? '/admin/settings' : '/change-password'); setProfileDropdown(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Settings
            </button>
            <button
              onClick={() => { navigate('/change-password'); setProfileDropdown(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Shield className="w-4 h-4 text-slate-400" />
              Change Password
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!showNav || !user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070b16]">
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <BreadcrumbProvider>
      <RealtimeBridge user={user}>
        <div className="min-h-screen bg-slate-50 dark:bg-[#070b16] overflow-hidden">
        {/* Hidden file input for profile uploads */}
        <input type="file" id="profile-upload" className="hidden" accept="image/*" onChange={handleProfileUpload} disabled={uploading} />

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className={`sidebar hidden md:flex ${collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'}`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={`sidebar md:hidden w-sidebar transform transition-transform duration-350 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-350 ${collapsed ? 'md:ml-sidebar-collapsed' : 'md:ml-sidebar'} h-screen overflow-hidden`}>
        {/* Header */}
        <header className="app-header">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden btn-ghost p-2 -ml-2"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page title replaced with Breadcrumbs */}
            <div>
              <Breadcrumbs userRole={user?.role} userName={user?.full_name} />
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {/* Live time */}
            <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500 mr-2">
              <span className="font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-slate-300">•</span>
              <span className="tabular-nums">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Online/Offline Status */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/60'
                : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200/60 dark:border-amber-700/60'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className={`text-xs font-semibold ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {!isOnline && pendingCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 rounded-full">
                  {pendingCount}
                </span>
              )}
            </div>

            {/* Sync button when back online with pending items */}
            {isOnline && pendingCount > 0 && (
              <button
                onClick={syncPending}
                disabled={syncing}
                className="btn-ghost p-2 relative"
                title={`Sync ${pendingCount} pending submission(s)`}
              >
                <svg className={`w-5 h-5 ${syncing ? 'animate-spin text-primary-500' : 'text-primary-600 dark:text-primary-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              </button>
            )}

            <button
              onClick={handleRefreshApp}
              disabled={refreshingApp}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-wait disabled:opacity-70 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300 dark:shadow-none dark:hover:border-primary-400/50 dark:hover:bg-primary-500/10 dark:hover:text-white"
              title="Refresh app"
              aria-label="Refresh app"
            >
              <RefreshCw className={`w-5 h-5 ${refreshingApp ? 'animate-spin' : ''}`} />
            </button>
            {refreshingApp && (
              <span className="hidden md:inline-flex items-center rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                Refreshing...
              </span>
            )}

            {/* Notification bell */}
            <NotificationBell user={user} />

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300 dark:shadow-none dark:hover:border-primary-400/50 dark:hover:bg-primary-500/10 dark:hover:text-white"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Settings link */}
            <button
              onClick={() => navigate(user?.role === 'admin' ? '/admin/settings' : '/change-password')}
              className="btn-ghost p-2"
            >
              <Settings className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8 h-[calc(100vh-4rem)] overflow-y-auto scroll-smooth">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
      </RealtimeBridge>
  </BreadcrumbProvider>
);
};

export default Layout;

// Pulls events from the SSE stream and:
//  - Invalidates TanStack Query caches so the notification bell refreshes
//  - Shows a transient toast for new notifications
//  - Invalidates attendance caches for admin/pastor dashboards
function RealtimeBridge({ user, children }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  useEventStream(user ? '/api/events' : '', {
    notification: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      showToast({
        type: 'info',
        title: data?.title || 'New notification',
        message: data?.message || '',
        duration: 6000,
        action: {
          label: 'View',
          onClick: () => window.dispatchEvent(new CustomEvent('app:navigate-notifications'))
        }
      });
    },
    'attendance-submitted': (data) => {
      // Admin/pastor dashboards watch these keys
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'submission-history'] });
      queryClient.invalidateQueries({ queryKey: ['pastor', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      if (user?.role === 'admin' || user?.role === 'pastor') {
        showToast({
          type: 'success',
          title: 'Attendance submitted',
          message: data?.leader_name
            ? `${data.leader_name} submitted for ${data.date || 'today'}`
            : 'A new submission was just received.',
          duration: 4000
        });
      }
    }
  });

  return children;
}
