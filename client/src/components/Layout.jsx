import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useTranslation } from 'react-i18next';
import useOffline from '../hooks/useOffline';
import { BreadcrumbProvider } from '../context/BreadcrumbContext';
import Breadcrumbs from './ui/Breadcrumbs';
import NotificationBell from './NotificationBell';
import SearchModal from './admin/SearchModal';
import BrandMark from './BrandMark';
import { authAPI } from '../services/api';
import useEventStream from '../hooks/useEventStream';
import { useToast } from '../context/ToastContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  BarChart3,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Shield,
  ChevronDown,
  Menu,
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
  Trash2,
  CheckSquare,
  Tag,
  UserPlus,
  RefreshCw,
  Award,
  Building2,
  Heart,
  Cross,
  DollarSign,
  Globe,
  Banknote,
  MapPin,
  Send,
  Droplets,
  TrendingUp,
  Crown,
  Baby
} from 'lucide-react';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const IDLE_WARNING_MS = 55 * 60 * 1000;

const Layout = ({ children, showNav = true }) => {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const toggleLanguage = () => {
    const next = i18n.language?.startsWith('sw') ? 'en' : 'sw';
    i18n.changeLanguage(next);
  };
  const { isOnline, pendingCount, syncing, syncPending } = useOffline();
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

  // Global search keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 1-hour client-side idle detector. Server enforces a matching
  // rolling timeout on the session cookie, but a tab left open without
  // network activity can sit idle for a long time. Any user input
  // (mousemove, keydown, click, scroll, touch) resets the timer.
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
        try {
          showToast({
            type: 'warning',
            message: 'You will be logged out in 5 minutes due to inactivity.'
          });
        } catch (_e) {
          /* ignore */
        }
      }, IDLE_WARNING_MS);
      logoutTimer = setTimeout(() => {
        if (warned) {
          try {
            showToast({ type: 'info', message: 'Logged out due to inactivity.' });
          } catch (_e) {
            /* ignore */
          }
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
      try {
        showToast({ type: 'warning', message: msg });
      } catch (_e) {
        /* ignore */
      }
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
      setProfileImgKey((prev) => prev + 1);
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
          await Promise.all(
            registrations.map(async (registration) => {
              await registration.update();
              if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
            })
          );
        }
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
      };
      await Promise.race([refreshPrep(), new Promise((resolve) => setTimeout(resolve, 1200))]);
    } catch (error) {
      console.warn('App refresh preparation failed:', error);
    } finally {
      forceReload();
    }
  };

  // Navigation structure per role — labels resolved via i18n so EN/SW toggle updates instantly
  const navConfig = {
    admin: [
      {
        section: t('nav.sections.overview', 'OVERVIEW'),
        items: [
          { path: '/admin', label: t('nav.items.dashboard'), icon: LayoutDashboard, exact: true }
        ]
      },
      {
        section: t('nav.sections.ministries'),
        items: [
          { path: '/admin/sections', label: t('nav.items.sections'), icon: Layers },
          { path: '/admin/home-cells', label: t('nav.items.homeCells'), icon: Home },
          { path: '/admin/departments', label: t('nav.items.departments'), icon: Building2 },
          { path: '/admin/leadership', label: t('nav.items.leadership'), icon: Award },
          { path: '/admin/titles', label: t('nav.items.titles'), icon: Tag }
        ]
      },
      {
        section: t('nav.sections.peopleCare'),
        items: [
          { path: '/admin/members', label: t('nav.items.memberDirectory'), icon: Users },
          {
            path: '/admin/trash',
            label: t('nav.items.deletedMembers', 'Deleted Members'),
            icon: Trash2
          },
          { path: '/admin/new-members', label: t('nav.items.newMembers'), icon: UserPlus },
          { path: '/admin/leaders', label: t('nav.items.leaders'), icon: Crown },
          { path: '/admin/children-leaders', label: t('nav.items.childrenLeaders'), icon: Baby },
          { path: '/admin/birthdays', label: t('nav.items.birthdays'), icon: Cake },
          { path: '/admin/rewards', label: t('nav.items.recognition'), icon: Trophy }
        ]
      },
      {
        section: t('nav.sections.servicesAttendance'),
        items: [
          {
            path: '/admin/attendance-dashboard',
            label: t('nav.items.attendanceOverview'),
            icon: BarChart3
          },
          {
            path: '/admin/attendance-corrections',
            label: t('nav.items.reviewAttendance'),
            icon: CheckSquare
          },
          { path: '/admin/history', label: t('nav.items.serviceHistory'), icon: Clock },
          {
            path: '/admin/attendance-analytics',
            label: t('nav.items.attendanceInsights'),
            icon: TrendingUp
          }
        ]
      },
      {
        section: t('nav.sections.outreach'),
        items: [
          {
            path: '/admin/evangelism',
            label: t('nav.items.outreachOverview'),
            icon: Heart,
            exact: true
          },
          {
            path: '/admin/evangelism',
            label: t('nav.items.outreachEvents'),
            icon: Send,
            search: '?subtab=outreach'
          },
          {
            path: '/admin/evangelism',
            label: t('nav.items.soulWinning'),
            icon: Users,
            search: '?subtab=souls'
          },
          { path: '/admin/follow-ups', label: t('nav.items.followUps'), icon: ClipboardCheck },
          {
            path: '/admin/evangelism',
            label: 'Baptism',
            icon: Droplets,
            search: '?subtab=baptism'
          },
          {
            path: '/admin/evangelism',
            label: 'Outreach Reports',
            icon: FileText,
            search: '?subtab=reports'
          }
        ]
      },
      {
        section: t('nav.sections.finance', 'OPERATIONS'),
        items: [
          { path: '/admin/finance', label: t('nav.items.financeOverview'), icon: Banknote },
          { path: '/admin/calendar', label: t('nav.items.calendar'), icon: Calendar },
          { path: '/admin/announcements', label: t('nav.items.announcements'), icon: Megaphone }
        ]
      },
      {
        section: t('nav.sections.system', 'INSIGHTS'),
        items: [{ path: '/admin/reporting', label: t('nav.items.reports'), icon: FileText }]
      },
      {
        section: t('nav.sections.system', 'ADMINISTRATION'),
        items: [
          { path: '/admin/audit', label: t('nav.items.auditLog'), icon: ShieldCheck },
          { path: '/admin/settings', label: t('nav.items.settings'), icon: Settings }
        ]
      }
    ],
    leader: [
      {
        section: t('leader.dashboard'),
        items: [
          { path: '/leader', label: t('nav.items.dashboard'), icon: LayoutDashboard, exact: true }
        ]
      },
      {
        section: t('leader.myWork'),
        items: [
          { path: '/leader/members', label: t('leader.myMembers'), icon: Users },
          { path: '/leader/attendance', label: t('leader.takeAttendance'), icon: ClipboardList },
          { path: '/leader/home-cells', label: t('leader.homeCells'), icon: Home }
        ]
      },
      {
        section: t('nav.sections.outreach'),
        items: [{ path: '/leader/outreach', label: t('leader.outreach'), icon: MessageSquare }]
      },
      {
        section: t('nav.items.reports'),
        items: [
          { path: '/leader/history', label: t('leader.history'), icon: Clock },
          { path: '/leader/contributions', label: t('leader.contributions'), icon: DollarSign },
          { path: '/leader/reports', label: t('leader.reports'), icon: BarChart3 }
        ]
      },
      ...(user?.is_head
        ? [
            {
              section: t('leader.sectionOverview'),
              items: [{ path: '/leader/overview', label: t('leader.sectionOverview'), icon: Eye }]
            }
          ]
        : []),
      ...(user?.is_new_member_leader
        ? [
            {
              section: t('nav.items.newMembers'),
              items: [
                { path: '/leader/new-members', label: t('nav.items.newMembers'), icon: UserPlus }
              ]
            }
          ]
        : []),
      {
        section: t('nav.items.calendar'),
        items: [{ path: '/leader/calendar', label: t('nav.items.calendar'), icon: Calendar }]
      }
    ],
    evangelist: [
      {
        section: 'DASHBOARD',
        items: [{ path: '/evangelist', label: 'Dashboard', icon: LayoutDashboard, exact: true }]
      },
      {
        section: 'EVANGELISM',
        items: [
          { path: '/evangelist/outreach', label: 'Outreach Events', icon: Calendar },
          { path: '/evangelist/souls', label: 'New Believers', icon: Users },
          { path: '/evangelist/follow-ups', label: 'Care Follow-Ups', icon: MessageSquare },
          { path: '/evangelist/baptism', label: 'Baptism', icon: Cross }
        ]
      },
      {
        section: 'TEAM',
        items: [{ path: '/evangelist/team', label: 'Evangelism Team', icon: Users }]
      },
      {
        section: 'REPORTS',
        items: [{ path: '/evangelist/reports', label: 'Reports', icon: BarChart3 }]
      },
      {
        section: 'ACCOUNT',
        items: [{ path: '/change-password', label: 'Change Password', icon: Shield }]
      }
    ],
    pastor: [
      {
        section: 'DASHBOARD',
        items: [{ path: '/pastor', label: 'Overview', icon: LayoutDashboard, exact: true }]
      },
      {
        section: 'PASTORAL CARE',
        items: [
          { path: '/pastor/insights', label: 'Insights', icon: Activity },
          { path: '/pastor/engagement', label: 'Engagement', icon: MessageSquare },
          { path: '/pastor/weekly', label: 'Weekly Summary', icon: Calendar },
          { path: '/pastor/birthdays', label: 'Birthdays', icon: Cake }
        ]
      },
      {
        section: 'EVANGELISM',
        items: [
          { path: '/evangelist', label: 'Evangelism Dashboard', icon: Heart, exact: true },
          { path: '/evangelist/outreach', label: 'Outreach Events', icon: Calendar },
          { path: '/evangelist/souls', label: 'New Believers', icon: Users },
          { path: '/evangelist/baptism', label: 'Baptism', icon: Cross }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [{ path: '/pastor/calendar', label: 'Calendar', icon: Calendar }]
      }
    ],
    children_leader: [
      {
        section: 'DASHBOARD',
        items: [
          { path: '/children-leader', label: 'Dashboard', icon: LayoutDashboard, exact: true }
        ]
      },
      {
        section: 'MY WORK',
        items: [
          { path: '/children-leader/children', label: 'My Children', icon: Users },
          { path: '/children-leader/attendance', label: 'Take Attendance', icon: ClipboardList }
        ]
      },
      {
        section: 'REPORTS',
        items: [
          { path: '/children-leader/history', label: 'History', icon: Clock },
          { path: '/children-leader/trends', label: 'Trends', icon: BarChart3 }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [{ path: '/children-leader/calendar', label: 'Calendar', icon: Calendar }]
      }
    ],
    accountant: [
      {
        section: 'DASHBOARD',
        items: [{ path: '/accountant', label: 'Dashboard', icon: LayoutDashboard, exact: true }]
      },
      {
        section: 'FINANCE',
        items: [
          { path: '/accountant/finance', label: 'Finance Module', icon: Banknote },
          { path: '/accountant/analytics', label: 'Analytics', icon: BarChart3 }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [{ path: '/change-password', label: 'Change Password', icon: Shield }]
      }
    ]
  };

  const currentNav = (() => {
    if (user?.role === 'leader' && user?.is_new_member_leader) {
      return [
        {
          section: 'DASHBOARD',
          items: [{ path: '/leader', label: 'Dashboard', icon: LayoutDashboard, exact: true }]
        },
        {
          section: 'NEW MEMBERS',
          items: [
            { path: '/leader/new-members', label: 'New Members', icon: UserPlus },
            { path: '/leader/attendance', label: 'Take Attendance', icon: ClipboardList }
          ]
        },
        {
          section: 'ACCOUNT',
          items: [{ path: '/leader/calendar', label: 'Calendar', icon: Calendar }]
        }
      ];
    }
    return navConfig[user?.role] || [];
  })();

  const isActive = (item) => {
    if (item.exact) {
      if (location.pathname !== item.path) return false;
      if (item.search) {
        const urlParams = new URLSearchParams(location.search);
        const itemParams = new URLSearchParams(item.search);
        for (const [key, value] of itemParams) {
          if (urlParams.get(key) !== value) return false;
        }
        return true;
      }
      // Exact match with no search param: only active if URL has no subtab param
      return !location.search.includes('subtab=');
    }
    const path = location.pathname;
    if (!path.startsWith(item.path)) return false;
    const rest = path.slice(item.path.length);
    if (rest && rest[0] !== '/' && rest[0] !== '?') return false;
    if (item.search) {
      const urlParams = new URLSearchParams(location.search);
      const itemParams = new URLSearchParams(item.search);
      for (const [key, value] of itemParams) {
        if (urlParams.get(key) !== value) return false;
      }
    }
    return true;
  };

  const roleLabel = {
    admin: 'Administrator',
    leader: user?.is_new_member_leader
      ? 'New Member Leader'
      : user?.is_head
        ? 'Head Leader'
        : 'Section Leader',
    pastor: 'Pastor',
    evangelist: 'Evangelist Pastor',
    accountant: 'Accountant',
    children_leader: "Children's Ministry Leader"
  };

  const roleBadgeColor = {
    admin: 'bg-primary-500/20 text-primary-300',
    leader: 'bg-emerald-500/20 text-emerald-300',
    pastor: 'bg-accent-500/20 text-accent-300',
    evangelist: 'bg-amber-500/20 text-amber-300',
    accountant: 'bg-cyan-500/20 text-cyan-300',
    children_leader: 'bg-pink-500/20 text-pink-300'
  };

  // Keep the mobile drawer expanded even when the desktop sidebar is collapsed.
  const navCollapsed = collapsed && !mobileOpen;

  // --- Sidebar Content ---
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={`flex h-[4.5rem] shrink-0 items-center border-b border-white/[0.06] px-4 ${navCollapsed ? 'justify-center' : ''}`}
      >
        <BrandMark compact={navCollapsed} inverse />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3 space-y-0.5">
        {currentNav.map((group, gi) => (
          <div key={gi}>
            {!navCollapsed && <div className="sidebar-section-label">{group.section}</div>}
            {navCollapsed && gi > 0 && <div className="h-px bg-white/[0.07] mx-2 my-2.5" />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.path + (item.search || '')}
                  to={item.path + (item.search || '')}
                  onClick={() => setMobileOpen(false)}
                  title={navCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`sidebar-nav-item ${active ? 'active' : ''} ${navCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon className="nav-icon" />
                  {!navCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden md:block px-3 py-1.5 border-t border-white/[0.06]">
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
      <div
        className={`px-3 py-2.5 border-t border-white/[0.06] ${navCollapsed ? 'flex justify-center' : ''}`}
      >
        <div
          className={`flex items-center gap-3 ${navCollapsed ? '' : 'p-2 rounded-xl hover:bg-sidebar-hover transition-colors cursor-pointer'}`}
          onClick={(e) => {
            e.stopPropagation();
            setProfileDropdown(!profileDropdown);
          }}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            {user?.profile_picture ? (
              <img
                src={`${user.profile_picture}?v=${profileImgKey}`}
                alt=""
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-sm font-semibold text-white">
                {user?.full_name?.charAt(0)}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0b1a2c]" />
          </div>

          {!navCollapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleBadgeColor[user?.role] || ''}`}
                >
                  {roleLabel[user?.role] || user?.role}
                </span>
                {user?.section_name && (
                  <span className="text-[10px] font-medium text-white/50 truncate flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {user.section_name}
                  </span>
                )}
              </div>
            </div>
          )}

          {!navCollapsed && <ChevronDown className="w-4 h-4 text-sidebar-text/50 shrink-0" />}
        </div>

        {/* Profile Dropdown */}
        {profileDropdown && !navCollapsed && (
          <div
            className="absolute bottom-20 left-3 right-3 z-50 animate-scale-in rounded-xl border border-white/[0.08] bg-[#101f31] py-1 shadow-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                navigate(user?.role === 'admin' ? '/admin/settings' : '/change-password');
                setProfileDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-footnote text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4 text-white/40" />
              Settings
            </button>
            <button
              onClick={() => {
                navigate('/change-password');
                setProfileDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-footnote text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Shield className="w-4 h-4 text-white/40" />
              Change Password
            </button>
            <div className="my-1 h-px bg-white/[0.08]" />
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-footnote text-rose-300 hover:bg-rose-500/10 transition-colors"
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
      <div className="app-canvas min-h-screen">
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      </div>
    );
  }

  return (
    <BreadcrumbProvider>
      <RealtimeBridge user={user}>
        <div className="app-canvas min-h-screen overflow-hidden">
          {/* Hidden file input for profile uploads */}
          <input
            type="file"
            id="profile-upload"
            className="hidden"
            accept="image/*"
            onChange={handleProfileUpload}
            disabled={uploading}
          />

          {/* Mobile Overlay */}
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}

          {/* Sidebar - Desktop */}
          <aside
            className={`sidebar hidden md:flex ${collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'}`}
          >
            {sidebarContent}
          </aside>

          {/* Sidebar - Mobile */}
          <aside
            className={`sidebar md:hidden w-sidebar max-w-[85vw] transform transition-transform duration-350 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            {sidebarContent}
          </aside>

          {/* Main Content */}
          <div
            className={`transition-all duration-350 ${collapsed ? 'md:ml-sidebar-collapsed' : 'md:ml-sidebar'} app-shell overflow-hidden`}
          >
            {/* Header */}
            <header className="app-header">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="header-icon-button focus-ring -ml-1 sm:-ml-2 md:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Breadcrumb title */}
                <div className="min-w-0 flex-1 overflow-hidden">
                  <Breadcrumbs userRole={user?.role} userName={user?.full_name} />
                </div>
              </div>

              {/* Right side controls */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Global search */}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="header-icon-button focus-ring sm:hidden"
                  title="Search"
                  aria-label="Search members, reports, and pages"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="focus-ring hidden h-9 min-w-[12.5rem] items-center gap-2 rounded-lg bg-system-fill/70 px-3 text-secondary-label transition-colors hover:bg-system-fill hover:text-label sm:inline-flex dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                  title="Search (Ctrl+K)"
                >
                  <Search className="w-4 h-4" />
                  <span className="text-footnote font-medium">Search anything</span>
                  <kbd className="ml-auto hidden items-center rounded border border-separator/70 bg-system-background px-1.5 py-0.5 text-[10px] font-medium text-secondary-label md:inline-flex dark:border-white/10 dark:bg-white/[0.06]">
                    ⌘K
                  </kbd>
                </button>
                {/* Live time */}
                <div className="mr-1 hidden items-center gap-2 text-footnote text-secondary-label xl:flex">
                  <span className="font-medium">
                    {currentTime.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <span className="text-tertiary-label">·</span>
                  <span className="tabular-nums">
                    {currentTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Online/Offline Status */}
                <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-system-fill/70 px-2.5 py-1 dark:bg-white/[0.06]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-system-green' : 'bg-system-orange animate-pulse'}`}
                  />
                  <span className="text-[11px] font-medium text-secondary-label">
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  {!isOnline && pendingCount > 0 && (
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-system-orange">
                      {pendingCount}
                    </span>
                  )}
                </div>

                {/* Sync button when back online with pending items */}
                {isOnline && pendingCount > 0 && (
                  <button
                    onClick={syncPending}
                    disabled={syncing}
                    className="header-icon-button relative"
                    title={`Sync ${pendingCount} pending submission(s)`}
                  >
                    <svg
                      className={`w-5 h-5 ${syncing ? 'animate-spin text-primary-500' : 'text-primary-600 dark:text-primary-400'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount}
                    </span>
                  </button>
                )}

                <button
                  onClick={handleRefreshApp}
                  disabled={refreshingApp}
                  className="header-icon-button focus-ring hidden disabled:cursor-wait disabled:opacity-70 md:inline-flex"
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

                {/* Language toggle */}
                <button
                  onClick={toggleLanguage}
                  className="header-icon-button w-auto gap-1 px-2"
                  title={t('common.language')}
                  aria-label={t('common.language')}
                >
                  <Globe className="w-5 h-5" />
                  <span className="hidden sm:inline text-[11px] font-semibold">
                    {i18n.language?.startsWith('sw') ? 'SW' : 'EN'}
                  </span>
                </button>

                {/* Dark mode toggle */}
                <button
                  onClick={toggleTheme}
                  className="header-icon-button focus-ring"
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-amber-300" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>

                {/* Settings link */}
                <button
                  onClick={() =>
                    navigate(user?.role === 'admin' ? '/admin/settings' : '/change-password')
                  }
                  className="header-icon-button focus-ring hidden sm:inline-flex"
                  aria-label="Open settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Page Content */}
            <main className="app-shell-scroll overflow-y-auto scroll-smooth px-3 py-4 sm:px-6 lg:px-8 lg:py-7">
              <div className="animate-fade-in">{children}</div>
            </main>
          </div>
          {/* Search Modal */}
          <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
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
//  - Fires window events so hand-rolled data hooks (useAdminData/useLeaderData,
//    NotificationBell) can refetch instantly instead of waiting for their poll timers.
function RealtimeBridge({ user, children }) {
  const { showToast } = useToast();
  useEventStream(user ? '/api/events' : '', {
    notification: (data) => {
      window.dispatchEvent(new CustomEvent('app:notifications-changed'));
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
      // Admin/pastor dashboards refetch on this; leaders refetch their own submission
      window.dispatchEvent(
        new CustomEvent('app:data-changed', {
          detail: { scope: 'attendance', leader_id: data?.leader_id }
        })
      );
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
