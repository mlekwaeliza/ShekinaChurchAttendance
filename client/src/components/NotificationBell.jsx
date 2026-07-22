import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, X, AlertTriangle, Clock, Users, Info,
  Calendar, Gift, ClipboardCheck, UserX, ChevronRight, TrendingDown,
  FileText, DollarSign
} from 'lucide-react';
import { adminAPI } from '../services/api';

const NotificationBell = ({ user }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
    return () => clearInterval(interval);
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
      const pending = (res.data || []).filter(t => t.status !== 'completed').slice(0, 5);
      setFollowUps(pending);
    } catch (e) {
      console.error('Failed to load follow-ups:', e);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await adminAPI.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark notification read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await adminAPI.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const typeConfig = {
    missed_submission: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'Attendance' },
    absent_member: { icon: UserX, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', label: 'Absence' },
    attendance_drop: { icon: TrendingDown, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', label: 'Alert' },
    system: { icon: Info, color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-500/10', label: 'System' },
    birthday: { icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10', label: 'Birthday' },
    event: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'Event' },
    follow_up: { icon: ClipboardCheck, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Follow-up' },
    finance: { icon: DollarSign, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10', label: 'Finance' },
    children: { icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10', label: "Children's Ministry" },
    report: { icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10', label: 'Report' },
  };

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'action', label: 'Action Required' },
    { id: 'info', label: 'Information' },
  ];

  const filteredNotifications = notifications.filter(n => {
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300 dark:shadow-none dark:hover:border-primary-400/50 dark:hover:bg-primary-500/10 dark:hover:text-white relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[20px] px-1 shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[420px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-scale-in">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'action' && unreadCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] rounded-full">
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
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-400 mt-2">Loading...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No notifications</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const config = typeConfig[notif.type] || typeConfig.system;
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    className={`px-5 py-3.5 border-b border-slate-50 dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                      !notif.is_read ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${!notif.is_read ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <div className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatTime(notif.created_at)}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                      {!notif.is_read && (
                        <button
                          onClick={() => handleMarkRead(notif.id)}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {/* Follow-up Reminders */}
            {followUps.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Pending Follow-ups</p>
                <div className="space-y-1.5">
                  {followUps.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{task.title || task.description}</span>
                      </div>
                      {task.due_date && (
                        <span className="text-[10px] text-slate-400">Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Quick Actions</p>
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => handleNavigate('/admin/history')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    <ClipboardCheck className="w-3 h-3" />
                    Attendance
                  </button>
                  <button
                    onClick={() => handleNavigate('/admin/follow-ups')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Users className="w-3 h-3" />
                    Follow-ups
                  </button>
                  <button
                    onClick={() => handleNavigate('/admin/finance')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
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
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    <ClipboardCheck className="w-3 h-3" />
                    Take Attendance
                  </button>
                  <button
                    onClick={() => handleNavigate('/leader/members')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
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