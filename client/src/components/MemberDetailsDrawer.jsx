import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Phone,
  Mail,
  Award,
  Clock,
  Activity,
  Calendar,
  Shield,
  Heart,
  MapPin,
  User,
  DollarSign
} from 'lucide-react';
import { adminAPI, leaderAPI, analyticsAPI, contributionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fdate, fdatetime } from '../utils/date';
import Badge from './ui/Badge';
import WeeklyAttendanceMatrix from './admin/WeeklyAttendanceMatrix';
import PhotoViewer from './PhotoViewer';

// One flat tint per member, the way Contacts tints an avatar monogram.
const avatarColors = [
  'bg-system-purple',
  'bg-system-blue',
  'bg-system-green',
  'bg-system-orange',
  'bg-system-red',
  'bg-system-indigo',
  'bg-system-teal',
  'bg-system-pink'
];

const statTones = {
  green: 'text-emerald-700 dark:text-system-green',
  red: 'text-rose-700 dark:text-system-red',
  neutral: 'text-secondary-label',
  blue: 'text-blue-700 dark:text-system-blue',
  indigo: 'text-primary-700 dark:text-primary-300'
};

/* Mini Helper Components */
function ProfileItem({ icon: Icon, label, value, isPhone, isEmail }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-system-fill text-secondary-label">
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
          {label}
        </p>
        {isPhone && value !== '—' ? (
          <a
            href={`tel:${value}`}
            className="block truncate text-footnote font-medium tabular-nums text-primary-700 hover:underline dark:text-primary-300"
          >
            {value}
          </a>
        ) : isEmail && value !== '—' ? (
          <a
            href={`mailto:${value}`}
            className="block truncate text-footnote font-medium text-primary-700 hover:underline dark:text-primary-300"
          >
            {value}
          </a>
        ) : (
          <p className="block truncate text-footnote font-medium text-label">{value}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <div className="rounded-xl bg-system-grouped-background/70 p-3.5 dark:bg-white/[0.03]">
      <span className="block truncate text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
        {label}
      </span>
      <span
        className={`mt-1.5 block text-title-2 font-semibold leading-none tabular-nums ${statTones[tone] || statTones.neutral}`}
      >
        {value}
      </span>
    </div>
  );
}

function LayersIcon(props) {
  return (
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
}

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
  const [viewingPhoto, setViewingPhoto] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'pastor';
  const apiGroup = isAdmin ? adminAPI : leaderAPI;
  const canViewFinancials =
    user?.role === 'admin' ||
    user?.role === 'pastor' ||
    user?.role === 'leader' ||
    user?.role === 'accountant';
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
          apiGroup
            .getMemberTitles(member.id)
            .then((res) => setTitles(res.data || []))
            .catch((e) => console.error('Error fetching titles', e)),
          apiGroup
            .getMemberDepartments(member.id)
            .then((res) => setDepartments(res.data || []))
            .catch((e) => console.error('Error fetching depts', e)),
          (isAdmin ? analyticsAPI : leaderAPI)
            .getMemberAttendanceDetails(member.id)
            .then((res) => setAttendance(res.data || null))
            .catch((e) => console.error('Error fetching attendance', e))
        ];

        if (isAdmin) {
          promises.push(
            adminAPI
              .getMemberAuditHistory(member.id)
              .then((res) => setAuditLog(res.data || []))
              .catch((e) => console.error('Error fetching audit logs', e))
          );
        }

        if (canViewFinancials) {
          promises.push(
            contributionAPI
              .getContributions({ member_id: member.id })
              .then((res) => setContributions(res.data || []))
              .catch((e) => console.error('Error fetching contributions', e))
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
  }, [isOpen, member?.id, user?.role, canViewFinancials]); // eslint-disable-line react-hooks/exhaustive-deps

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
    { id: 'matrix', label: 'Weekly Matrix', icon: Calendar },
    { id: 'departments', label: 'Depts & Titles', icon: Award },
    ...(canViewFinancials ? [{ id: 'financials', label: 'Financials', icon: DollarSign }] : []),
    ...(isAdmin ? [{ id: 'audit', label: 'Audit Trail', icon: Shield }] : [])
  ];

  return (
    <>
      {viewingPhoto && member.profile_picture && (
        <PhotoViewer
          src={member.profile_picture}
          alt={member.full_name}
          onClose={() => setViewingPhoto(false)}
        />
      )}
      {createPortal(
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-apple"
            onClick={onClose}
          />

          {/* Drawer Container */}
          <div className="relative z-10 flex h-full w-full flex-col border-l border-black/[0.06] bg-system-grouped-background shadow-modal transition-all duration-300 ease-apple dark:border-white/[0.1] md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
            {/* Header */}
            <div className="shrink-0 border-b border-separator/60 bg-secondary-system-grouped-background px-4 py-5 dark:border-white/[0.08] sm:px-6 sm:py-6">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-title-2 font-semibold text-white ${avatarColor} ${
                      member.profile_picture
                        ? 'cursor-pointer transition-opacity hover:opacity-90'
                        : ''
                    }`}
                    onClick={() => member.profile_picture && setViewingPhoto(true)}
                    title={member.profile_picture ? 'Click to view full photo' : undefined}
                  >
                    {member.profile_picture ? (
                      <img
                        src={member.profile_picture}
                        alt={member.full_name}
                        className="h-full w-full object-cover object-[center_20%]"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="break-words text-title-2 font-semibold leading-tight text-label">
                      {member.full_name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-footnote text-secondary-label">
                      <span className="font-medium tabular-nums">
                        ID: {member.membership_id || '—'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Registered: {fdate(member.created_at || member.registered_date)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {member.section_name && (
                        <span className="rounded-full bg-system-fill px-2 py-0.5 text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                          {member.section_name}
                        </span>
                      )}
                      {member.gender && (
                        <span className="rounded-full bg-system-fill px-2 py-0.5 text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                          {member.gender}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 shrink-0 rounded-lg p-2 text-secondary-label transition-colors hover:bg-system-fill hover:text-label focus:outline-none sm:static"
                  aria-label="Close member details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="shrink-0 overflow-x-auto border-b border-separator/60 bg-secondary-system-grouped-background px-4 py-2 dark:border-white/[0.08] sm:px-6">
              <div className="tab-pills w-max">
                {tabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      aria-pressed={isActive}
                      className={`tab-pill whitespace-nowrap ${isActive ? 'active' : ''}`}
                    >
                      <TabIcon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl bg-system-red/10 px-4 py-3 text-footnote font-medium text-rose-700 dark:text-system-red sm:mx-6">
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="shrink-0 font-semibold hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto bg-system-grouped-background p-4 scrollbar-thin sm:p-6">
              {loading ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="skeleton h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-3/4 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                    </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    <div className="skeleton h-10 rounded-xl" />
                    <div className="skeleton h-10 rounded-xl" />
                    <div className="skeleton h-10 rounded-xl" />
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
                        <div className="card p-5 space-y-4">
                          <h3 className="section-eyebrow mb-2">Contact & Bio</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ProfileItem icon={User} label="Full Name" value={member.full_name} />
                            <ProfileItem
                              icon={Shield}
                              label="Membership ID"
                              value={member.membership_id || '—'}
                            />
                            <ProfileItem
                              icon={Phone}
                              label="Primary Phone"
                              value={member.phone || '—'}
                              isPhone
                            />
                            <ProfileItem
                              icon={Phone}
                              label="Secondary Phone"
                              value={member.secondary_phone || '—'}
                              isPhone
                            />
                            <ProfileItem
                              icon={Mail}
                              label="Email Address"
                              value={member.email || '—'}
                              isEmail
                            />
                            <ProfileItem
                              icon={Calendar}
                              label="Date of Birth"
                              value={member.date_of_birth ? fdate(member.date_of_birth) : '—'}
                            />
                            <ProfileItem
                              icon={Heart}
                              label="Marital Status"
                              value={member.marital_status || '—'}
                            />
                            <ProfileItem
                              icon={User}
                              label="Occupation"
                              value={member.occupation || '—'}
                            />
                          </div>
                        </div>

                        {/* Church Assignment Card */}
                        <div className="card p-5 space-y-4">
                          <h3 className="section-eyebrow mb-2">Church Assignment</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ProfileItem
                              icon={LayersIcon}
                              label="Section"
                              value={member.section_name || '—'}
                            />
                            <ProfileItem
                              icon={User}
                              label="Leader"
                              value={member.leader_name || '—'}
                            />
                            <ProfileItem
                              icon={Heart}
                              label="Home Cell"
                              value={member.home_cell_name || '—'}
                            />
                            <ProfileItem
                              icon={Calendar}
                              label="Registered Date"
                              value={fdate(member.created_at || member.registered_date)}
                            />
                          </div>
                        </div>

                        {/* Residential Card */}
                        <div className="card p-5">
                          <h3 className="section-eyebrow mb-3">Residential Address</h3>
                          <div className="flex gap-3 items-start">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-system-fill text-tertiary-label">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                                Address
                              </p>
                              <p className="mt-1 text-footnote leading-relaxed text-label">
                                {member.address || 'No address provided'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Highlights Column */}
                      <div className="space-y-6">
                        {/* CRM Quick Summary Card */}
                        <div className="card p-5">
                          <h3 className="section-eyebrow mb-4">Summary</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-separator/50 py-2 dark:border-white/[0.06]">
                              <span className="text-footnote font-medium text-secondary-label">
                                Gender
                              </span>
                              <span className="text-footnote font-semibold text-label">
                                {member.gender || '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-separator/50 py-2 dark:border-white/[0.06]">
                              <span className="text-footnote font-medium text-secondary-label">
                                Age Group
                              </span>
                              <span className="text-footnote font-semibold text-label">
                                {member.age_group || '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-separator/50 py-2 dark:border-white/[0.06]">
                              <span className="text-footnote font-medium text-secondary-label">
                                Education Level
                              </span>
                              <span className="text-footnote font-semibold text-label">
                                {member.education_level || '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-separator/50 py-2 dark:border-white/[0.06]">
                              <span className="text-footnote font-medium text-secondary-label">
                                Attendance Rate
                              </span>
                              <span
                                className={`text-footnote font-semibold ${
                                  attendance?.stats?.attendance_rate >= 80
                                    ? 'text-emerald-600 dark:text-system-green'
                                    : attendance?.stats?.attendance_rate >= 50
                                      ? 'text-amber-600 dark:text-system-orange'
                                      : 'text-rose-600 dark:text-system-red'
                                }`}
                              >
                                {attendance ? `${attendance.stats.attendance_rate}%` : '—'}
                              </span>
                            </div>
                            {canViewFinancials && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-footnote font-medium text-secondary-label">
                                  Total Contributions
                                </span>
                                <span className="text-footnote font-semibold text-emerald-700 dark:text-system-green">
                                  TZS{' '}
                                  {contributions
                                    .reduce((sum, c) => sum + Number(c.amount || 0), 0)
                                    .toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Department Roles checklist */}
                        <div className="card p-5 space-y-3">
                          <h3 className="section-eyebrow">Active Roles</h3>
                          {departments.length > 0 ? (
                            <div className="space-y-2.5">
                              {departments.map((dept) => (
                                <div
                                  key={dept.id}
                                  className="flex items-center justify-between border-b border-separator/50 py-1.5 text-footnote last:border-0 dark:border-white/[0.06]"
                                >
                                  <span className="font-semibold text-label">{dept.name}</span>
                                  <span className="rounded-md bg-system-indigo/15 px-2 py-0.5 text-caption-2 font-semibold text-primary-700 dark:text-primary-300">
                                    {dept.role}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-footnote text-tertiary-label italic">
                              No department assignments.
                            </p>
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
                          <div className="card grid grid-cols-1 items-center gap-6 p-6 md:grid-cols-3">
                            {/* Rate circle */}
                            <div className="flex flex-col items-center justify-center border-b border-separator/50 p-2 dark:border-white/[0.06] md:border-b-0 md:border-r">
                              <div className="relative flex items-center justify-center w-28 h-28">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle
                                    className="text-system-fill"
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
                                        ? 'text-emerald-600 dark:text-system-green'
                                        : attendance.stats.attendance_rate >= 50
                                          ? 'text-amber-600 dark:text-system-orange'
                                          : 'text-rose-600 dark:text-system-red'
                                    } transition-all duration-500`}
                                    strokeWidth="8"
                                    strokeDasharray={2 * Math.PI * 44}
                                    strokeDashoffset={
                                      2 *
                                      Math.PI *
                                      44 *
                                      (1 - attendance.stats.attendance_rate / 100)
                                    }
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="44"
                                    cx="56"
                                    cy="56"
                                  />
                                </svg>
                                <div className="absolute flex flex-col items-center">
                                  <span className="text-title-2 font-semibold tabular-nums text-label">
                                    {attendance.stats.attendance_rate}%
                                  </span>
                                  <span className="mt-0.5 text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                                    Rate
                                  </span>
                                </div>
                              </div>
                              <span className="mt-3 text-center text-caption-1 font-medium text-tertiary-label">
                                Past 180 days tracking
                              </span>
                            </div>

                            {/* Stats details */}
                            <div className="md:col-span-2 grid grid-cols-2 gap-4 w-full">
                              <StatCard
                                label="Present"
                                value={attendance.stats.present}
                                tone="green"
                              />
                              <StatCard label="Absent" value={attendance.stats.absent} tone="red" />
                              <StatCard
                                label="Excused"
                                value={attendance.stats.excused}
                                tone="neutral"
                              />
                              <StatCard
                                label="Total Services"
                                value={attendance.stats.total}
                                tone="indigo"
                              />
                            </div>
                          </div>

                          {/* Recent History */}
                          <div className="card p-5">
                            <h3 className="section-eyebrow mb-4">Attendance History</h3>
                            {attendance.records.length > 0 ? (
                              <div className="divide-y divide-separator/50 dark:divide-white/[0.06]">
                                {attendance.records.map((record) => (
                                  <div
                                    key={record.id}
                                    className="flex items-center justify-between py-3 text-footnote transition-colors hover:bg-system-grouped-background/60 dark:hover:bg-white/[0.03]"
                                  >
                                    <div className="space-y-1">
                                      <p className="font-semibold text-label">
                                        {record.service_name}
                                      </p>
                                      <p className="text-caption-2 text-tertiary-label">
                                        {fdate(record.date)} • Submitted by{' '}
                                        {record.submitted_by_name || 'System'}
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
                                      className="px-2.5 py-0.5 text-caption-2 uppercase tracking-[0.06em]"
                                    >
                                      {record.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="py-8 text-center text-footnote italic text-tertiary-label">
                                No attendance records logged.
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-separator/70 py-12 text-center text-footnote italic text-tertiary-label dark:border-white/[0.12]">
                          Attendance data unavailable.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Weekly Matrix Tab */}
                  {activeTab === 'matrix' && (
                    <div className="card p-5">
                      <WeeklyAttendanceMatrix
                        memberId={member.id}
                        title={`Weekly Attendance Matrix - ${member.full_name}`}
                      />
                    </div>
                  )}

                  {/* Departments & Titles Tab */}
                  {activeTab === 'departments' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      {/* Department Memberships */}
                      <div className="card space-y-4 p-5">
                        <h3 className="section-eyebrow mb-2">Departments</h3>
                        {departments.length > 0 ? (
                          <div className="grid gap-3">
                            {departments.map((dept) => (
                              <div
                                key={dept.id}
                                className="flex items-center justify-between rounded-xl bg-system-grouped-background/70 p-3.5 dark:bg-white/[0.03]"
                              >
                                <div className="space-y-1 min-w-0">
                                  <p className="truncate text-subheadline font-semibold text-label">
                                    {dept.name}
                                  </p>
                                  {dept.description && (
                                    <p className="text-footnote text-secondary-label line-clamp-1">
                                      {dept.description}
                                    </p>
                                  )}
                                  <p className="text-caption-2 text-tertiary-label mt-1.5">
                                    Joined: {fdate(dept.joined_at)}
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    dept.role === 'Leader'
                                      ? 'success'
                                      : dept.role === 'Assistant Leader'
                                        ? 'info'
                                        : 'neutral'
                                  }
                                  className="ml-2 shrink-0 px-2 py-0.5 text-caption-2 uppercase tracking-[0.06em]"
                                >
                                  {dept.role}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="py-8 text-center text-footnote italic text-tertiary-label">
                            No department memberships.
                          </p>
                        )}
                      </div>

                      {/* Titles */}
                      <div className="card space-y-4 p-5">
                        <h3 className="section-eyebrow mb-2">Assigned Titles</h3>
                        {titles.length > 0 ? (
                          <div className="grid gap-3">
                            {titles.map((title) => (
                              <div
                                key={title.id}
                                className="rounded-xl bg-system-grouped-background/70 p-3.5 dark:bg-white/[0.03]"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-subheadline font-semibold text-label">
                                    {title.name}
                                  </p>
                                  <Badge
                                    variant={title.status === 'active' ? 'info' : 'neutral'}
                                    className="px-2 py-0.5 text-caption-2 uppercase tracking-[0.06em]"
                                  >
                                    {title.status}
                                  </Badge>
                                </div>
                                {title.notes && (
                                  <p className="text-footnote text-secondary-label italic mb-2">
                                    "{title.notes}"
                                  </p>
                                )}
                                <p className="text-caption-2 text-tertiary-label flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Appointed: {fdate(title.appointment_date || title.assigned_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="py-8 text-center text-footnote italic text-tertiary-label">
                            No titles assigned.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Financials Tab */}
                  {activeTab === 'financials' && canViewFinancials && (
                    <div className="space-y-6">
                      {/* Financial Summary */}
                      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
                        <StatCard
                          label="Total Given"
                          value={`TZS ${contributions
                            .filter(
                              (c) =>
                                canViewTithes ||
                                (c.contribution_type_name || '').toLowerCase() !== 'tithes'
                            )
                            .reduce((sum, c) => sum + Number(c.amount || 0), 0)
                            .toLocaleString()}`}
                          tone="green"
                        />
                        <StatCard
                          label="Gifts Count"
                          value={
                            contributions.filter(
                              (c) =>
                                canViewTithes ||
                                (c.contribution_type_name || '').toLowerCase() !== 'tithes'
                            ).length
                          }
                          tone="blue"
                        />
                        <StatCard
                          label="Last Date"
                          value={
                            contributions.length > 0 ? fdate(contributions[0].payment_date) : '—'
                          }
                          tone="indigo"
                        />
                      </div>

                      {/* Contribution History */}
                      <div className="card p-5">
                        <h3 className="section-eyebrow mb-4">Giving History</h3>
                        {contributions.length > 0 ? (
                          <div className="divide-y divide-separator/50 dark:divide-white/[0.06]">
                            {contributions
                              .filter(
                                (c) =>
                                  canViewTithes ||
                                  (c.contribution_type_name || '').toLowerCase() !== 'tithes'
                              )
                              .map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between py-3 text-footnote transition-colors hover:bg-system-grouped-background/60 dark:hover:bg-white/[0.03]"
                                >
                                  <div className="space-y-1">
                                    <p className="font-semibold text-label">
                                      {item.contribution_type_name}
                                    </p>
                                    <div className="text-caption-2 text-tertiary-label flex flex-wrap items-center gap-1.5">
                                      <span>{fdate(item.payment_date)}</span>
                                      <span>•</span>
                                      <span>{item.payment_method}</span>
                                      {item.reference_number && (
                                        <>
                                          <span>•</span>
                                          <span className="rounded bg-system-fill px-1 py-0.5 font-mono text-caption-2 text-secondary-label">
                                            {item.reference_number}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {item.notes && (
                                      <p className="text-caption-2 text-secondary-label italic mt-1">
                                        "{item.notes}"
                                      </p>
                                    )}
                                  </div>
                                  <span className="ml-2 whitespace-nowrap text-subheadline font-semibold tabular-nums text-emerald-700 dark:text-system-green">
                                    TZS {Number(item.amount || 0).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="py-8 text-center text-footnote italic text-tertiary-label">
                            No contributions recorded.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Audit Trail Tab */}
                  {activeTab === 'audit' && isAdmin && (
                    <div className="card p-5">
                      <h3 className="section-eyebrow mb-5">Modification History</h3>
                      {auditLog.length > 0 ? (
                        <div className="relative space-y-6 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-separator/70 dark:before:bg-white/[0.08]">
                          {auditLog.map((log) => (
                            <div key={log.id} className="flex gap-4 relative">
                              <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary-system-grouped-background bg-system-fill text-tertiary-label">
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 rounded-xl bg-system-grouped-background/70 p-4 dark:bg-white/[0.03]">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                  <Badge
                                    variant={
                                      log.action === 'CREATE'
                                        ? 'success'
                                        : log.action === 'DELETE'
                                          ? 'danger'
                                          : 'info'
                                    }
                                    className="px-2 py-0.5 text-caption-2 font-semibold uppercase tracking-[0.06em]"
                                  >
                                    {log.action}
                                  </Badge>
                                  <span className="text-caption-2 text-tertiary-label font-medium">
                                    {fdatetime(log.created_at)}
                                  </span>
                                </div>
                                <p className="text-footnote font-medium text-secondary-label leading-relaxed">
                                  {log.details ||
                                    `Member profile was ${log.action.toLowerCase()}d.`}
                                </p>
                                {log.changed_by_name && (
                                  <p className="text-caption-2 text-tertiary-label mt-2 font-medium">
                                    Performed by: {log.changed_by_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-8 text-center text-footnote italic text-tertiary-label">
                          No audit logs recorded for this member.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default MemberDetailsDrawer;
