import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, Award, Clock, Activity, Calendar, Shield, Users, Heart, MapPin, User, ChevronRight, DollarSign } from 'lucide-react';
import { adminAPI, leaderAPI, analyticsAPI, contributionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fdate, fdatetime } from '../utils/date';
import Badge from './ui/Badge';

const avatarColors = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-600',
  'from-cyan-500 to-teal-600',
  'from-fuchsia-500 to-pink-600',
];

const MemberDetailsDrawer = ({ member, isOpen, onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [error, setError] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'pastor';
  const apiGroup = isAdmin ? adminAPI : leaderAPI;
  const canViewFinancials = user?.role === 'admin' || user?.role === 'pastor' || user?.role === 'leader' || user?.role === 'accountant';
  // Tithe info is sensitive — only admin & accountant may see it
  const canViewTithes = user?.role === 'admin' || user?.role === 'accountant';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !member?.id) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const promises = [
          apiGroup.getMemberTitles(member.id).then(res => setTitles(res.data || [])).catch(e => console.error("Error fetching titles", e)),
          apiGroup.getMemberDepartments(member.id).then(res => setDepartments(res.data || [])).catch(e => console.error("Error fetching depts", e)),
          (isAdmin ? analyticsAPI : leaderAPI).getMemberAttendanceDetails(member.id).then(res => setAttendance(res.data || null)).catch(e => console.error("Error fetching attendance", e))
        ];

        if (isAdmin) {
          promises.push(
            adminAPI.getMemberAuditHistory(member.id).then(res => setAuditLog(res.data || [])).catch(e => console.error("Error fetching audit logs", e))
          );
        }

        if (canViewFinancials) {
          promises.push(
            contributionAPI.getContributions({ member_id: member.id }).then(res => setContributions(res.data || [])).catch(e => console.error("Error fetching contributions", e))
          );
        }

        await Promise.all(promises);
      } catch (err) {
        console.error('Failed to load member details:', err);
        setError('Some information failed to load. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, member?.id, user?.role, canViewFinancials]);

  if (!isOpen || !member) return null;

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name) => {
    if (!name) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const avatarColor = getAvatarColor(member.full_name);
  const initials = getInitials(member.full_name);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'attendance', label: 'Attendance', icon: Activity },
    { id: 'departments', label: 'Depts & Titles', icon: Award },
    ...(canViewFinancials ? [{ id: 'financials', label: 'Financials', icon: DollarSign }] : []),
    ...(isAdmin ? [{ id: 'audit', label: 'Audit Trail', icon: Shield }] : [])
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 ease-out" 
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative h-full w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-slate-50 dark:bg-[#070b16] shadow-2xl transition-all duration-300 ease-out flex flex-col border-l border-slate-200 dark:border-slate-800 z-10">
        
        {/* Header Banner */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${avatarColor} px-6 py-6 text-white shrink-0`}>
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/5 -translate-y-20 translate-x-20" />
          <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-white/5 translate-y-12 -translate-x-6" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold leading-tight truncate">{member.full_name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-white/80">
                  <span className="font-semibold">ID: {member.membership_id || '—'}</span>
                  <span>•</span>
                  <span>Registered: {fdate(member.created_at || member.registered_date)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {member.section_name && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10">
                      {member.section_name}
                    </span>
                  )}
                  {member.gender && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10">
                      {member.gender}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white transition-all active:scale-95 border border-white/10 focus:outline-none shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-6 py-2 flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap focus:outline-none ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10' 
                    : 'text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-xs text-rose-700 dark:text-rose-450 font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-900 dark:text-rose-200 hover:opacity-80 font-bold">Dismiss</button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin dark:text-slate-100 bg-slate-50 dark:bg-[#070b16]">
          {loading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-1/2" />
                </div>
              </div>
              <div className="space-y-3 pt-4">
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Main Details Column */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Contact & Personal Card */}
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Contact & Bio</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ProfileItem icon={User} label="Full Name" value={member.full_name} />
                        <ProfileItem icon={Shield} label="Membership ID" value={member.membership_id || '—'} />
                        <ProfileItem icon={Phone} label="Phone Number" value={member.phone || '—'} isPhone />
                        <ProfileItem icon={Mail} label="Email Address" value={member.email || '—'} isEmail />
                      </div>
                    </div>

                    {/* Church Assignment Card */}
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Church Assignment</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ProfileItem icon={LayersIcon} label="Section" value={member.section_name || '—'} />
                        <ProfileItem icon={User} label="Leader" value={member.leader_name || '—'} />
                        <ProfileItem icon={Heart} label="Home Cell" value={member.home_cell_name || '—'} />
                        <ProfileItem icon={Calendar} label="Registered Date" value={fdate(member.created_at || member.registered_date)} />
                      </div>
                    </div>

                    {/* Residential Card */}
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Residential Address</h3>
                      <div className="flex gap-3 items-start">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700/80 text-slate-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Address</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-350 mt-1 leading-relaxed">
                            {member.address || 'No address provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Highlights Column */}
                  <div className="space-y-6">
                    {/* CRM Quick Summary Card */}
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Summary</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-medium text-slate-550 dark:text-slate-400">Gender</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{member.gender || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-medium text-slate-550 dark:text-slate-400">Age Group</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{member.age_group || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-medium text-slate-550 dark:text-slate-400">Attendance Rate</span>
                          <span className={`text-xs font-bold ${
                            attendance?.stats?.attendance_rate >= 80 ? 'text-emerald-500' : attendance?.stats?.attendance_rate >= 50 ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                            {attendance ? `${attendance.stats.attendance_rate}%` : '—'}
                          </span>
                        </div>
                        {canViewFinancials && (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-xs font-medium text-slate-550 dark:text-slate-400">Total Contributions</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              TZS {contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Department Roles checklist */}
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Roles</h3>
                      {departments.length > 0 ? (
                        <div className="space-y-2.5">
                          {departments.map((dept) => (
                            <div key={dept.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                              <span className="font-semibold text-slate-700 dark:text-slate-350">{dept.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400">{dept.role}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No department assignments.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Tab */}
              {activeTab === 'attendance' && (
                <div className="space-y-6">
                  {attendance ? (
                    <>
                      {/* Attendance Stats Dashboard */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                        {/* Rate circle */}
                        <div className="flex flex-col items-center justify-center p-2 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800/80">
                          <div className="relative flex items-center justify-center w-28 h-28">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle 
                                className="text-slate-100 dark:text-slate-800" 
                                strokeWidth="8" 
                                stroke="currentColor" 
                                fill="transparent" 
                                r="44" 
                                cx="56" 
                                cy="56" 
                              />
                              <circle 
                                className={`${
                                  attendance.stats.attendance_rate >= 80 
                                    ? 'text-emerald-500' 
                                    : attendance.stats.attendance_rate >= 50 
                                      ? 'text-amber-500' 
                                      : 'text-rose-500'
                                } transition-all duration-500`} 
                                strokeWidth="8" 
                                strokeDasharray={2 * Math.PI * 44}
                                strokeDashoffset={2 * Math.PI * 44 * (1 - attendance.stats.attendance_rate / 100)}
                                strokeLinecap="round"
                                stroke="currentColor" 
                                fill="transparent" 
                                r="44" 
                                cx="56" 
                                cy="56" 
                              />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                              <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-white">
                                {attendance.stats.attendance_rate}%
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                Rate
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-3 font-medium text-center">
                            Past 180 days tracking
                          </span>
                        </div>

                        {/* Stats details */}
                        <div className="md:col-span-2 grid grid-cols-2 gap-4 w-full">
                          <StatCard label="Present" value={attendance.stats.present} color="text-emerald-600 dark:text-emerald-450 bg-emerald-50/50 dark:bg-emerald-950/20" />
                          <StatCard label="Absent" value={attendance.stats.absent} color="text-rose-600 dark:text-rose-450 bg-rose-50/50 dark:bg-rose-950/20" />
                          <StatCard label="Excused" value={attendance.stats.excused} color="text-slate-650 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40" />
                          <StatCard label="Total Services" value={attendance.stats.total} color="text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20" />
                        </div>
                      </div>

                      {/* Recent History */}
                      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Attendance History</h3>
                        {attendance.records.length > 0 ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {attendance.records.map((record) => (
                              <div key={record.id} className="py-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <div className="space-y-1">
                                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                                    {record.service_name}
                                  </p>
                                  <p className="text-[10px] text-slate-450 dark:text-slate-500">
                                    {fdate(record.date)} • Submitted by {record.submitted_by_name || 'System'}
                                  </p>
                                </div>
                                <Badge 
                                  variant={
                                    record.status === 'present' 
                                      ? 'success' 
                                      : record.status === 'absent' 
                                        ? 'danger' 
                                        : 'neutral'
                                  }
                                  className="uppercase tracking-wider px-2.5 py-0.5 text-[9px]"
                                >
                                  {record.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center py-8 text-slate-405 italic">No attendance records logged.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 italic">
                      Attendance data unavailable.
                    </div>
                  )}
                </div>
              )}

              {/* Departments & Titles Tab */}
              {activeTab === 'departments' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Department Memberships */}
                  <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Departments</h3>
                    {departments.length > 0 ? (
                      <div className="grid gap-3">
                        {departments.map((dept) => (
                          <div key={dept.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/25 flex items-center justify-between">
                            <div className="space-y-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{dept.name}</p>
                              {dept.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{dept.description}</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1.5">Joined: {fdate(dept.joined_at)}</p>
                            </div>
                            <Badge variant={dept.role === 'Leader' ? 'success' : dept.role === 'Assistant Leader' ? 'info' : 'neutral'} className="text-[10px] px-2 py-0.5 uppercase tracking-wide shrink-0 ml-2">
                              {dept.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-slate-400 text-xs italic">No department memberships.</p>
                    )}
                  </div>

                  {/* Titles */}
                  <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Assigned Titles</h3>
                    {titles.length > 0 ? (
                      <div className="grid gap-3">
                        {titles.map((title) => (
                          <div key={title.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/25">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title.name}</p>
                              <Badge variant={title.status === 'active' ? 'info' : 'neutral'} className="text-[9px] uppercase tracking-wide px-2 py-0.5">
                                {title.status}
                              </Badge>
                            </div>
                            {title.notes && (
                              <p className="text-xs text-slate-550 dark:text-slate-400 italic mb-2">
                                "{title.notes}"
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Appointed: {fdate(title.appointment_date || title.assigned_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-slate-400 text-xs italic">No titles assigned.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Financials Tab */}
              {activeTab === 'financials' && canViewFinancials && (
                <div className="space-y-6">
                  {/* Financial Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                    <StatCard 
                      label="Total Given" 
                      value={`TZS ${contributions
                        .filter(c => canViewTithes || (c.contribution_type_name || '').toLowerCase() !== 'tithes')
                        .reduce((sum, c) => sum + Number(c.amount || 0), 0)
                        .toLocaleString()}`} 
                      color="text-emerald-600 dark:text-emerald-450 bg-emerald-50/50 dark:bg-emerald-950/20" 
                    />
                    <StatCard 
                      label="Gifts Count" 
                      value={contributions.filter(c => canViewTithes || (c.contribution_type_name || '').toLowerCase() !== 'tithes').length} 
                      color="text-blue-600 dark:text-blue-450 bg-blue-50/50 dark:bg-blue-950/20" 
                    />
                    <StatCard 
                      label="Last Date" 
                      value={contributions.length > 0 ? fdate(contributions[0].payment_date) : '—'} 
                      color="text-indigo-650 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20" 
                    />
                  </div>

                  {/* Contribution History */}
                  <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Giving History</h3>
                    {contributions.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {contributions
                          .filter(c => canViewTithes || (c.contribution_type_name || '').toLowerCase() !== 'tithes')
                          .map((item) => (
                          <div key={item.id} className="py-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                {item.contribution_type_name}
                              </p>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-1.5">
                                <span>{fdate(item.payment_date)}</span>
                                <span>•</span>
                                <span>{item.payment_method}</span>
                                {item.reference_number && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-[9px] bg-slate-100 dark:bg-slate-850 px-1 py-0.2 rounded">{item.reference_number}</span>
                                  </>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-[10px] text-slate-550 dark:text-slate-400 italic mt-1">
                                  "{item.notes}"
                                </p>
                              )}
                            </div>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-450 whitespace-nowrap ml-2">
                              TZS {Number(item.amount || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-slate-400 text-xs italic">No contributions recorded.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Audit Trail Tab */}
              {activeTab === 'audit' && isAdmin && (
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-5">Modification History</h3>
                  {auditLog.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-850">
                      {auditLog.map((log) => (
                        <div key={log.id} className="flex gap-4 relative">
                          <div className="w-6.5 h-6.5 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center shrink-0 z-10 text-slate-400 shadow-sm">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 rounded-xl bg-slate-50/50 dark:bg-slate-850/30 border border-slate-150/60 dark:border-slate-800 p-4 -mt-1.5 hover:shadow-sm transition-all duration-200">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                              <Badge 
                                variant={
                                  log.action === 'CREATE' 
                                    ? 'success' 
                                    : log.action === 'DELETE' 
                                      ? 'danger' 
                                      : 'info'
                                } 
                                className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider"
                              >
                                {log.action}
                              </Badge>
                              <span className="text-[10px] text-slate-405 dark:text-slate-500 font-medium">
                                {fdatetime(log.created_at)}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                              {log.details || `Member profile was ${log.action.toLowerCase()}d.`}
                            </p>
                            {log.changed_by_name && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                                Performed by: {log.changed_by_name}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-slate-400 text-xs italic">No audit logs recorded for this member.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/* Mini Helper Components */
const ProfileItem = ({ icon: Icon, label, value, isPhone, isEmail }) => {
  return (
    <div className="flex gap-3 items-center min-w-0">
      <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-850 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 text-slate-400 shadow-sm">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-505 uppercase tracking-wide truncate">{label}</p>
        {isPhone && value !== '—' ? (
          <a href={`tel:${value}`} className="text-sm font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline truncate block">
            {value}
          </a>
        ) : isEmail && value !== '—' ? (
          <a href={`mailto:${value}`} className="text-sm font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate block">
            {value}
          </p>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className={`p-3 rounded-xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-between shadow-sm ${color}`}>
    <span className="text-[10px] font-bold uppercase tracking-wider opacity-85 block truncate">
      {label}
    </span>
    <span className="text-xl font-bold leading-none mt-2 block tabular-nums">
      {value}
    </span>
  </div>
);

const LayersIcon = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

export default MemberDetailsDrawer;
