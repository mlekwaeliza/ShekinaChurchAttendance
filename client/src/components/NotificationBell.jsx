import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Users,
  Info,
  Calendar,
  Gift,
  ClipboardCheck,
  UserX,
  TrendingDown,
  FileText,
  DollarSign
} from 'lucide-react';
import { adminAPI } from '../services/api';

const NotificationBell = ({ user }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const dropdownRef = useRef(null);

  const [followUps, setFollowUps] = useState([]);

  useEffect(() => {
    loadNotifications();
    loadFollowUps();
    const interval = setInterval(() => {
      loadNotifications();
      loadFollowUps();
    }, 60000);
    // SSE push — instant refresh when a notification is created server-side
    const onNotificationsChanged = () => {
      loadNotifications();
      loadFollowUps();
    };
    window.addEventListener('app:notifications-changed', onNotificationsChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener('app:notifications-changed', onNotificationsChanged);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const loadNotifications = async () => {
    try {
      const [allRes, countRes] = await Promise.all([
        adminAPI.getAllNotifications(),
        adminAPI.getUnreadNotificationCount()
      ]);
      setNotifications(allRes.data || []);
      setUnreadCount(countRes.data?.count || 0);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  };

  const loadFollowUps = async () => {
    try {
      const res = await adminAPI.getFollowUpTasks();
      const pending = (res.data || []).filter((t) => t.status !== 'completed').slice(0, 5);
      setFollowUps(pending);
    } catch (e) {
      console.error('Failed to load follow-ups:', e);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await adminAPI.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark notification read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await adminAPI.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const typeConfig = {
    missed_submission: {
      icon: Clock,
      color: 'text-amber-700 dark:text-system-orange',
      bg: 'bg-system-orange/15',
      label: 'Attendance'
    },
    absent_member: {
      icon: UserX,
      color: 'text-rose-700 dark:text-system-red',
      bg: 'bg-system-red/15',
      label: 'Absence'
    },
    attendance_drop: {
      icon: TrendingDown,
      color: 'text-amber-700 dark:text-system-orange',
      bg: 'bg-system-orange/15',
      label: 'Alert'
    },
    system: {
      icon: Info,
      color: 'text-primary-700 dark:text-primary-300',
      bg: 'bg-primary-500/15',
      label: 'System'
    },
    birthday: {
      icon: Gift,
      color: 'text-pink-700 dark:text-system-pink',
      bg: 'bg-system-pink/15',
      label: 'Birthday'
    },
    event: {
      icon: Calendar,
      color: 'text-blue-700 dark:text-system-blue',
      bg: 'bg-system-blue/15',
      label: 'Event'
    },
    follow_up: {
      icon: ClipboardCheck,
      color: 'text-emerald-700 dark:text-system-green',
      bg: 'bg-system-green/15',
      label: 'Follow-up'
    },
    finance: {
      icon: DollarSign,
      color: 'text-yellow-700 dark:text-system-yellow',
      bg: 'bg-system-yellow/15',
      label: 'Finance'
    },
    children: {
      icon: Users,
      color: 'text-primary-700 dark:text-primary-300',
      bg: 'bg-system-indigo/15',
      label: "Children's Ministry"
    },
    report: {
      icon: FileText,
      color: 'text-cyan-700 dark:text-system-cyan',
      bg: 'bg-system-cyan/15',
      label: 'Report'
    }
  };

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'action', label: 'Action Required' },
    { id: 'info', label: 'Information' }
  ];

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'action') return !n.is_read;
    if (activeTab === 'info') return n.is_read;
    return true;
  });

  const formatTime = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const handleNavigate = (path) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
        className="header-icon-button relative flex h-9 w-9 items-center justify-center"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-system-red px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-2xl border border-black/[0.08] bg-secondary-system-grouped-background shadow-popover dark:border-white/[0.1] animate-scale-in">
          {/* Header */}
          <div className="border-b border-separator/60 px-4 py-4 sm:px-5 dark:border-white/[0.08]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-headline font-semibold text-label">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-footnote font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>
            {/* Tabs */}
            <div className="tab-pills flex gap-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-pill flex-1 justify-center px-3 py-1.5 ${activeTab === tab.id ? 'active' : ''}`}
                >
                  {tab.label}
                  {tab.id === 'action' && unreadCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-system-red px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                <p className="mt-2 text-footnote text-secondary-label">Loading...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto mb-3 h-10 w-10 text-tertiary-label" />
                <p className="text-footnote font-semibold text-secondary-label">No notifications</p>
                <p className="mt-1 text-caption-1 text-tertiary-label">You're all caught up!</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const config = typeConfig[notif.type] || typeConfig.system;
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    className={`border-b border-separator/50 px-4 py-3.5 transition-colors hover:bg-system-grouped-background/70 dark:border-white/[0.06] dark:hover:bg-white/[0.03] ${
                      !notif.is_read ? 'bg-primary-500/[0.04]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                      >
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-footnote ${!notif.is_read ? 'font-semibold text-label' : 'text-secondary-label'}`}
                          >
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-caption-1 leading-relaxed text-secondary-label">
                          {notif.message}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-caption-2 text-tertiary-label">
                            {formatTime(notif.created_at)}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-caption-2 font-semibold ${config.bg} ${config.color}`}
                          >
                            {config.label}
                          </span>
                        </div>
                      </div>
                      {!notif.is_read && (
                        <button
                          onClick={() => handleMarkRead(notif.id)}
                          className="shrink-0 rounded-lg p-1.5 text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="border-t border-separator/60 bg-system-grouped-background/70 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
            {/* Follow-up Reminders */}
            {followUps.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                  Pending Follow-ups
                </p>
                <div className="space-y-1.5">
                  {followUps.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-separator/50 bg-secondary-system-grouped-background p-2 dark:border-white/[0.06]"
                    >
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-3 w-3 text-emerald-700 dark:text-system-green" />
                        <span className="max-w-[200px] truncate text-caption-1 font-medium text-secondary-label">
                          {task.title || task.description}
                        </span>
                      </div>
                      {task.due_date && (
                        <span className="text-caption-2 text-tertiary-label">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mb-2 text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
              Quick Actions
            </p>
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => handleNavigate('/admin/history')}
                    className="flex items-center gap-1.5 rounded-lg bg-system-fill px-2.5 py-1.5 text-caption-1 font-medium text-secondary-label transition-colors hover:text-label"
                  >
                    <ClipboardCheck className="w-3 h-3" />
                    Attendance
                  </button>
                  <button
                    onClick={() => handleNavigate('/admin/follow-ups')}
                    className="flex items-center gap-1.5 rounded-lg bg-system-fill px-2.5 py-1.5 text-caption-1 font-medium text-secondary-label transition-colors hover:text-label"
                  >
                    <Users className="w-3 h-3" />
                    Follow-ups
                  </button>
                  <button
                    onClick={() => handleNavigate('/admin/finance')}
                    className="flex items-center gap-1.5 rounded-lg bg-system-fill px-2.5 py-1.5 text-caption-1 font-medium text-secondary-label transition-colors hover:text-label"
                  >
                    <DollarSign className="w-3 h-3" />
                    Finance
                  </button>
                </>
              )}
              {user?.role === 'leader' && (
                <>
                  <button
                    onClick={() => handleNavigate('/leader/attendance')}
                    className="flex items-center gap-1.5 rounded-lg bg-system-fill px-2.5 py-1.5 text-caption-1 font-medium text-secondary-label transition-colors hover:text-label"
                  >
                    <ClipboardCheck className="w-3 h-3" />
                    Take Attendance
                  </button>
                  <button
                    onClick={() => handleNavigate('/leader/members')}
                    className="flex items-center gap-1.5 rounded-lg bg-system-fill px-2.5 py-1.5 text-caption-1 font-medium text-secondary-label transition-colors hover:text-label"
                  >
                    <Users className="w-3 h-3" />
                    My Members
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
