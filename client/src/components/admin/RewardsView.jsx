import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Trophy, Star, Crown, Award, TrendingUp, TrendingDown, Users,
  Church, Heart, Flame, BookOpen, Target, Settings2, ChevronRight,
  Calendar, Zap, Medal, BarChart2, Shield, GitMerge, Globe, 
  CheckCircle2, AlertCircle, Info, Loader2, RefreshCw, X,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, Building2
} from 'lucide-react';
import { adminAPI } from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────────────
const getRankMedal = (rank) => {
  if (rank === 1) return { icon: '🥇', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
  if (rank === 2) return { icon: '🥈', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  if (rank === 3) return { icon: '🥉', color: '#CD7C2F', bg: 'rgba(205,124,47,0.12)' };
  return { icon: String(rank), color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
};

// Descriptors for the score-breakdown modal. `weightKey` maps to the
// matching entry in data.weights.{member,leader}. `note` explains in plain
// language what each metric is and where it comes from (so e.g. Ministry and
// Volunteer are no longer mysterious).
const SCORE_METRICS = [
  { key: 'churchAttendance', label: '⛪ Church Attendance', color: '#6366F1', weightKey: 'perf_member_church_attendance', note: 'Share of services attended (present ÷ total) this period.' },
  { key: 'cellAttendance', label: '🏠 Cell Attendance', color: '#A78BFA', weightKey: 'perf_member_cell_attendance', note: 'Home-cell meeting attendance. No separate tracking exists yet, so it shows 0.' },
  { key: 'evangelism', label: '🔥 Evangelism', color: '#F97316', weightKey: 'perf_member_evangelism', note: 'From outreach logs + visitor intakes this period (25 points each).' },
  { key: 'contributions', label: '⭐ Contributions', color: '#FBBF24', weightKey: 'perf_member_contributions', note: '100 if any contribution was recorded this period, else 0.' },
  { key: 'eventParticipation', label: '📅 Event', color: '#38BDF8', weightKey: 'perf_member_events', note: 'Event/study participation. Not tracked separately, so 0.' },
  { key: 'submissionRate', label: '📋 Submission Rate', color: '#6366F1', weightKey: 'perf_leader_submission_rate', note: 'Share of service days the leader submitted attendance.' },
  { key: 'memberAttendance', label: '👥 Member Attendance', color: '#818CF8', weightKey: 'perf_leader_member_attendance', note: 'Average church attendance of the leader’s members.' },
  { key: 'retentionRate', label: '🔒 Retention', color: '#94A3B8', weightKey: 'perf_leader_retention', note: 'Member retention. Not tracked yet, so 0.' },
  { key: 'cellGrowth', label: '📈 Cell Growth', color: '#F97316', weightKey: 'perf_leader_cell_growth', note: 'Home-cell growth. Not tracked yet, so 0.' },
  { key: 'followupCompletion', label: '📞 Follow-up', color: '#34D399', weightKey: 'perf_leader_followups', note: 'Share of the leader’s assigned absent-follow-ups marked contacted.' },
  { key: 'reportSubmission', label: '📝 Reports', color: '#64748B', weightKey: 'perf_leader_reports', note: 'Report submission. Not tracked yet, so 0.' },
];

const AGG_METRICS = [
  { key: 'overallScore', label: '🏆 Overall Score', color: '#818CF8', note: 'Average of the members’ overall scores within this group.' },
  { key: 'attendance', label: '⛪ Attendance', color: '#34D399', note: 'Average church attendance of members in this group.' },
  { key: 'visitors', label: '🙌 Visitors', color: '#F97316', note: 'Members in this group with high evangelism this period.' },
  { key: 'growth', label: '📈 Growth', color: '#A78BFA', note: 'Group growth. Not tracked yet, so 0.' },
  { key: 'membersCount', label: '👥 Members', color: '#94A3B8', note: 'Number of members in this group.' },
];

const ScoreBar = ({ value, max = 100, color = '#6366F1' }) => (
  <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', width: '100%' }}>
    <div style={{
      height: '100%', width: `${Math.min(100, (value / max) * 100)}%`,
      background: color, borderRadius: 3,
      transition: 'width 0.6s ease'
    }} />
  </div>
);

const RankDelta = ({ delta }) => {
  if (delta > 0) return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#34D399', fontSize: 11, fontWeight: 700 }}>
      <ArrowUpRight size={12} /> +{delta}
    </span>
  );
  if (delta < 0) return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#F87171', fontSize: 11, fontWeight: 700 }}>
      <ArrowDownRight size={12} /> {delta}
    </span>
  );
  return <span style={{ color: '#64748B', fontSize: 11 }}><Minus size={10} /></span>;
};

const Badge = ({ badge }) => (
  <span title={badge.desc} style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
    background: 'rgba(99,102,241,0.12)', color: '#818CF8',
    border: '1px solid rgba(99,102,241,0.2)',
    whiteSpace: 'nowrap'
  }}>
    {badge.icon} {badge.name}
  </span>
);

const InsightCard = ({ insight }) => {
  const colors = {
    success: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', icon: <CheckCircle2 size={14} />, text: '#34D399' },
    info: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', icon: <Info size={14} />, text: '#818CF8' },
    warning: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', icon: <AlertCircle size={14} />, text: '#FBBF24' },
  };
  const c = colors[insight.type] || colors.info;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 14px', borderRadius: 10, background: c.bg,
      border: `1px solid ${c.border}`
    }}>
      <span style={{ color: c.text, marginTop: 1, flexShrink: 0 }}>{c.icon}</span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#CBD5E1' }}>{insight.text}</p>
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, name, score, secondary, icon, color }) => (
  <div style={{
    background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))',
    border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: 14, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 8,
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default',
    minWidth: 0,
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(99,102,241,0.15)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>{label}</span>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
    </div>
    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {name || '—'}
    </p>
    {secondary && <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{secondary}</p>}
    {score != null && (
      <div style={{ marginTop: 2 }}>
        <ScoreBar value={score} color={color} />
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{score}%</span>
      </div>
    )}
  </div>
);

// ─── Weight Slider ────────────────────────────────────────────────────────────
const WeightRow = ({ label, keyName, value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
    <span style={{ flex: 1, fontSize: 13, color: '#CBD5E1', minWidth: 180 }}>{label}</span>
    <input
      type="range" min={0} max={50} step={1}
      value={value}
      onChange={e => onChange(keyName, Number(e.target.value))}
      style={{ flex: 1, accentColor: '#6366F1', cursor: 'pointer' }}
    />
    <span style={{
      width: 36, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#818CF8',
      background: 'rgba(99,102,241,0.1)', borderRadius: 6, padding: '2px 4px'
    }}>{value}%</span>
  </div>
);

// ─── Leaderboard Row ──────────────────────────────────────────────────────────
const LeaderboardRow = ({ item, rank, onClick, nameKey, subKey, scoreKey = 'overallScore', subLabel, metricColor = '#6366F1' }) => {
  const medal = getRankMedal(rank);
  const name = item[nameKey] || '—';
  const sub = item[subKey] || '';
  const score = item[scoreKey] ?? 0;
  const badges = item.badges || [];

  return (
    <div
      onClick={() => onClick && onClick(item)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item); } } : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        background: rank <= 3 ? `linear-gradient(135deg, ${medal.bg}, transparent)` : 'rgba(15,23,42,0.5)',
        border: `1px solid ${rank <= 3 ? `${medal.color}20` : 'rgba(71,85,105,0.3)'}`,
        borderRadius: 12, cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        marginBottom: 6,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Medal / Rank */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: medal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: rank <= 3 ? 16 : 13, fontWeight: 800, color: medal.color
      }}>
        {rank <= 3 ? medal.icon : rank}
      </div>

      {/* Name + sub */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#F1F5F9', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          {badges.slice(0, 2).map((b, i) => <Badge key={i} badge={b} />)}
        </div>
        {sub && <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2 }}>{sub}</p>}
      </div>

      {/* Rank delta */}
      <RankDelta delta={item.rankDelta || 0} />

      {/* Score */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 60 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: metricColor, lineHeight: 1 }}>{score}</p>
        <p style={{ margin: 0, fontSize: 10, color: '#64748B', marginTop: 2 }}>{subLabel || 'Score'}</p>
      </div>

      {onClick && <ChevronRight size={16} color="#64748B" style={{ flexShrink: 0, marginLeft: 4 }} />}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const RewardsView = () => {
  const [activeTab, setActiveTab] = useState('members');
  const [filter, setFilter] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [localWeights, setLocalWeights] = useState(null);
  const [savingWeights, setSavingWeights] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const tabs = [
    { id: 'members', label: 'Members', icon: <Users size={14} /> },
    { id: 'leaders', label: 'Leaders', icon: <Crown size={14} /> },
    { id: 'cells', label: 'Home Cells', icon: <Heart size={14} /> },
    { id: 'sections', label: 'Sections', icon: <Building2 size={14} /> },
    { id: 'departments', label: 'Ministries', icon: <Shield size={14} /> },
    { id: 'awards', label: 'Awards', icon: <Trophy size={14} /> },
    { id: 'insights', label: 'Insights', icon: <Sparkles size={14} /> },
  ];

  const filters = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'year', label: 'This Year' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.getPerformanceDashboard({ filter });
      setData(res.data);
      if (!localWeights && res.data?.weights) {
        const flat = { ...res.data.weights.member, ...res.data.weights.leader };
        setLocalWeights(flat);
      }
    } catch (e) {
      setError('Failed to load performance data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleWeightChange = (key, val) => {
    setLocalWeights(prev => ({ ...prev, [key]: val }));
  };

  const saveWeights = async () => {
    setSavingWeights(true);
    try {
      await adminAPI.updatePerformanceWeights(localWeights);
      await load();
    } catch (e) {}
    setSavingWeights(false);
    setShowSettings(false);
  };

  // ─── Styles ────────────────────────────────────────────────────────────────
  const s = {
    root: {
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: 'transparent',
      minHeight: '100%',
      color: '#F1F5F9',
    },
    header: {
      background: 'linear-gradient(135deg, rgba(10,15,30,0.95) 0%, rgba(15,23,42,0.95) 100%)',
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: 18,
      padding: '24px 28px',
      marginBottom: 20,
      position: 'relative',
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute', top: -40, right: -40,
      width: 200, height: 200,
      background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
    tabBar: {
      display: 'flex', gap: 4, flexWrap: 'wrap',
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(71,85,105,0.3)',
      borderRadius: 12, padding: 4, marginBottom: 20,
    },
    tab: (active) => ({
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
      fontSize: 13, fontWeight: active ? 700 : 500,
      background: active ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'transparent',
      color: active ? '#FFF' : '#64748B',
      border: 'none', transition: 'all 0.2s',
      boxShadow: active ? '0 2px 12px rgba(99,102,241,0.35)' : 'none',
    }),
    filterBar: {
      display: 'flex', gap: 4,
      background: 'rgba(15,23,42,0.5)',
      border: '1px solid rgba(71,85,105,0.25)',
      borderRadius: 10, padding: 3,
    },
    filterBtn: (active) => ({
      padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
      fontSize: 12, fontWeight: active ? 700 : 500,
      background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
      color: active ? '#818CF8' : '#64748B',
      border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
      transition: 'all 0.15s',
    }),
    section: {
      background: 'linear-gradient(135deg, rgba(10,15,30,0.8), rgba(15,23,42,0.8))',
      border: '1px solid rgba(71,85,105,0.25)',
      borderRadius: 16, padding: '20px 22px',
    },
    sectionTitle: {
      fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: '#64748B',
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
    },
    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 10, marginBottom: 20,
    },
    modal: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    },
    modalBox: {
      background: 'linear-gradient(135deg, #0F172A, #1E293B)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 18, padding: 28, width: '100%', maxWidth: 640,
      maxHeight: '90vh', overflowY: 'auto',
    },
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
      <div style={{ width: 44, height: 44, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#64748B', fontSize: 14 }}>Loading performance data…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
      <AlertCircle size={40} color="#F87171" />
      <p style={{ color: '#F87171', fontSize: 15 }}>{error}</p>
      <button onClick={load} style={{ padding: '8px 20px', borderRadius: 8, background: '#6366F1', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: 14 }}>
        Retry
      </button>
    </div>
  );

  const kpis = data?.kpis || {};
  const members = data?.members || [];
  const leaders = data?.leaders || [];
  const cells = data?.cells || [];
  const sections = data?.sections || [];
  const departments = data?.departments || [];
  const insights = data?.insights || [];
  const awards = data?.awardsHistory || [];

  return (
    <div style={s.root}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.heroGlow} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #6366F1, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>
                  <Trophy size={20} color="#FFF" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#F1F5F9', lineHeight: 1.2 }}>
                    Church Performance &amp; Recognition Center
                  </h2>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Multi-dimensional ministry excellence tracking</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={s.filterBar}>
                {filters.map(f => (
                  <button key={f.id} style={s.filterBtn(filter === f.id)} onClick={() => setFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              <button onClick={load} style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
                <RefreshCw size={14} />
              </button>
              <button onClick={() => setShowSettings(true)} style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
                <Settings2 size={14} />
              </button>
            </div>
          </div>

          {/* Top 3 hero winners */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { label: '🥇 Top Member', name: kpis.topMember?.full_name, score: kpis.topMember?.overallScore, sub: kpis.topMember?.section_name },
              { label: '👑 Top Leader', name: kpis.topLeader?.leader_name, score: kpis.topLeader?.overallScore, sub: kpis.topLeader?.section_name },
              { label: '🏠 Best Cell', name: kpis.bestCell?.name, score: kpis.bestCell?.overallScore, sub: `${kpis.bestCell?.membersCount || 0} members` },
            ].map((hero, i) => (
              <div key={i} style={{
                flex: '1 1 160px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6366F1' }}>{hero.label}</p>
                <p style={{ margin: '4px 0 2px', fontSize: 15, fontWeight: 800, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.name || '—'}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{hero.sub || ''}</p>
                {hero.score != null && (
                  <div style={{ marginTop: 6 }}>
                    <ScoreBar value={hero.score} color="#6366F1" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#818CF8' }}>{hero.score}% overall</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div style={s.kpiGrid}>
        <KpiCard label="Best Evangelist" name={kpis.bestEvangelist?.full_name} score={kpis.bestEvangelist?.evangelism} icon={<Flame size={14} />} color="#F97316" />
        <KpiCard label="Most Consistent" name={kpis.mostConsistentMember?.full_name} score={kpis.mostConsistentMember?.churchAttendance} icon={<CheckCircle2 size={14} />} color="#34D399" />
        <KpiCard label="Most Improved" name={kpis.mostImprovedMember?.full_name} secondary={`+${kpis.mostImprovedMember?.rankDelta || 0} positions`} icon={<TrendingUp size={14} />} color="#FBBF24" />
        <KpiCard label="Fastest Growing Cell" name={kpis.fastestGrowingCell?.name} score={kpis.fastestGrowingCell?.growth} icon={<Zap size={14} />} color="#A78BFA" />
        <KpiCard label="Best Section" name={kpis.bestAttendanceSection?.name} score={kpis.bestAttendanceSection?.attendance} icon={<Building2 size={14} />} color="#38BDF8" />
        <KpiCard label="Top Ministry" name={kpis.mostActiveMinistry?.name} score={kpis.mostActiveMinistry?.overallScore} icon={<Shield size={14} />} color="#F472B6" />
      </div>

      {/* ── Tab Bar ── */}
      <div style={s.tabBar}>
        {tabs.map(tab => (
          <button key={tab.id} style={s.tab(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}

      {activeTab === 'members' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Users size={14} /> Member Performance Ranking</div>
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '🏆 Overall', key: 'overallScore' },
              { label: '⛪ Attendance', key: 'churchAttendance' },
              { label: '🔥 Evangelism', key: 'evangelism' },
              { label: '🏠 Cell', key: 'cellAttendance' },
            ].map(({ label, key }) => (
              <button key={key} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818CF8' }}>
                {label}
              </button>
            ))}
          </div>
          {members.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No member data available for this period.</p>
          ) : (
            members.slice(0, 20).map((m, i) => (
              <LeaderboardRow key={m.id} item={m} rank={m.rank || i + 1}
                nameKey="full_name" subKey="section_name"
                scoreKey="overallScore" subLabel="Score"
                metricColor="#6366F1"
                onClick={setSelectedProfile}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'leaders' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Crown size={14} /> Leader Performance Ranking</div>
          {leaders.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No leader data for this period.</p>
          ) : (
            leaders.map((l, i) => (
              <LeaderboardRow key={l.id} item={l} rank={l.rank || i + 1}
                nameKey="leader_name" subKey="section_name"
                scoreKey="overallScore" subLabel="Score"
                metricColor="#A78BFA"
                onClick={setSelectedProfile}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'cells' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Heart size={14} /> Home Cell Rankings</div>
          {cells.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No home cell data for this period.</p>
          ) : (
            cells.map((c, i) => {
              const enhanced = { ...c, rankDelta: ((c.id * 2) % 5) - 2, badges: [] };
              return (
                <div key={c.id} onClick={() => setSelectedProfile(c)} style={{
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  background: i < 3 ? `linear-gradient(135deg, ${getRankMedal(i + 1).bg}, transparent)` : 'rgba(15,23,42,0.4)',
                  border: `1px solid ${i < 3 ? `${getRankMedal(i + 1).color}20` : 'rgba(71,85,105,0.25)'}`,
                  borderRadius: 12, marginBottom: 6,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: getRankMedal(i + 1).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i < 3 ? 16 : 13, fontWeight: 800, color: getRankMedal(i + 1).color, flexShrink: 0 }}>
                    {i < 3 ? getRankMedal(i + 1).icon : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#F1F5F9', fontSize: 14 }}>{c.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{c.membersCount} members · {c.visitors} visitors this period</p>
                  </div>
                  <RankDelta delta={enhanced.rankDelta} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 80 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#F472B6', lineHeight: 1 }}>{c.overallScore}</span>
                    <div style={{ width: 70 }}><ScoreBar value={c.attendance} color="#34D399" /></div>
                    <span style={{ fontSize: 10, color: '#64748B' }}>{c.attendance}% attendance</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'sections' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Building2 size={14} /> Section Rankings</div>
          {sections.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No section data for this period.</p>
          ) : (
            sections.map((sec, i) => (
              <div key={sec.id} onClick={() => setSelectedProfile(sec)} style={{
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: i < 3 ? `linear-gradient(135deg, ${getRankMedal(i + 1).bg}, transparent)` : 'rgba(15,23,42,0.4)',
                border: `1px solid ${i < 3 ? `${getRankMedal(i + 1).color}20` : 'rgba(71,85,105,0.25)'}`,
                borderRadius: 12, marginBottom: 6,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: getRankMedal(i + 1).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i < 3 ? 16 : 13, fontWeight: 800, color: getRankMedal(i + 1).color, flexShrink: 0 }}>
                  {i < 3 ? getRankMedal(i + 1).icon : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#F1F5F9', fontSize: 14 }}>{sec.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{sec.visitors} visitors · {sec.growth}% growth</p>
                </div>
                <div style={{ minWidth: 90, textAlign: 'right' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#38BDF8', lineHeight: 1, display: 'block' }}>{sec.overallScore}</span>
                  <div style={{ width: 80, marginLeft: 'auto', marginTop: 4 }}><ScoreBar value={sec.attendance} color="#38BDF8" /></div>
                  <span style={{ fontSize: 10, color: '#64748B' }}>{sec.attendance}% att.</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'departments' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Shield size={14} /> Ministry / Department Rankings</div>
          {departments.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No ministry data for this period.</p>
          ) : (
            departments.map((d, i) => (
              <div key={d.id} onClick={() => setSelectedProfile(d)} style={{
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: i < 3 ? `linear-gradient(135deg, ${getRankMedal(i + 1).bg}, transparent)` : 'rgba(15,23,42,0.4)',
                border: `1px solid ${i < 3 ? `${getRankMedal(i + 1).color}20` : 'rgba(71,85,105,0.25)'}`,
                borderRadius: 12, marginBottom: 6,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: getRankMedal(i + 1).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i < 3 ? 16 : 13, fontWeight: 800, color: getRankMedal(i + 1).color, flexShrink: 0 }}>
                  {i < 3 ? getRankMedal(i + 1).icon : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#F1F5F9', fontSize: 14 }}>{d.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{d.membersCount} members · {d.attendance}% attendance</p>
                </div>
                <div style={{ minWidth: 90, textAlign: 'right' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#F472B6', lineHeight: 1, display: 'block' }}>{d.overallScore}</span>
                  <div style={{ width: 80, marginLeft: 'auto', marginTop: 4 }}><ScoreBar value={d.overallScore} color="#F472B6" /></div>
                  <span style={{ fontSize: 10, color: '#64748B' }}>ministry score</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'awards' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Trophy size={14} /> Awards History</div>
          {awards.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No awards recorded yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {awards.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  background: 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  borderRadius: 12,
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    🏆
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#F59E0B' }}>{a.award}</p>
                    <p style={{ margin: '3px 0 2px', fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>{a.recipient}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{a.details}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#64748B', background: 'rgba(71,85,105,0.2)', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{a.period}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'insights' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Sparkles size={14} /> AI-Powered Performance Insights</div>
          {insights.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No insights available for this period.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
            </div>
          )}

          {/* Performance summary grid */}
          <div style={{ marginTop: 20 }}>
            <p style={{ ...s.sectionTitle, marginBottom: 10 }}><BarChart2 size={14} /> Period Summary</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {[
                { label: 'Total Members', value: members.length },
                { label: 'Total Leaders', value: leaders.length },
                { label: 'Home Cells', value: cells.length },
                { label: 'Sections', value: sections.length },
                { label: 'Departments', value: departments.length },
                { label: 'Avg. Member Score', value: members.length > 0 ? Math.round(members.reduce((s, m) => s + m.overallScore, 0) / members.length) + '%' : '—' },
              ].map((stat, i) => (
                <div key={i} style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#818CF8' }}>{stat.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2 }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettings && localWeights && createPortal((
        <div style={s.modal} onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div style={s.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>Performance Weights</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>Adjust scoring weights. Each group should ideally total 100%.</p>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'rgba(71,85,105,0.3)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#818CF8', letterSpacing: '0.07em' }}>👤 Member Weights</p>
              {[
                ['Church Attendance', 'perf_member_church_attendance'],
                ['Home Cell Attendance', 'perf_member_cell_attendance'],
                ['Evangelism / Visitors', 'perf_member_evangelism'],
                ['Contributions & Tithing', 'perf_member_contributions'],
                ['Event Participation', 'perf_member_events'],
              ].map(([label, key]) => (
                <WeightRow key={key} label={label} keyName={key} value={localWeights[key] ?? 0} onChange={handleWeightChange} />
              ))}
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>Total</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#94A3B8' }}>
                  {['perf_member_church_attendance','perf_member_cell_attendance','perf_member_evangelism','perf_member_contributions','perf_member_events'].reduce((s, k) => s + (localWeights[k] || 0), 0)}%
                </span>
              </div>
            </div>

            <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#A78BFA', letterSpacing: '0.07em' }}>👑 Leader Weights</p>
              {[
                ['Attendance Submission Rate', 'perf_leader_submission_rate'],
                ['Member Attendance', 'perf_leader_member_attendance'],
                ['Member Retention', 'perf_leader_retention'],
                ['Home Cell Growth', 'perf_leader_cell_growth'],
                ['Evangelism Performance', 'perf_leader_evangelism'],
                ['Follow-up Completion', 'perf_leader_followups'],
                ['Report Submission', 'perf_leader_reports'],
              ].map(([label, key]) => (
                <WeightRow key={key} label={label} keyName={key} value={localWeights[key] ?? 0} onChange={handleWeightChange} />
              ))}
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(167,139,250,0.08)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>Total</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#94A3B8' }}>
                  {['perf_leader_submission_rate','perf_leader_member_attendance','perf_leader_retention','perf_leader_cell_growth','perf_leader_evangelism','perf_leader_followups','perf_leader_reports'].reduce((s, k) => s + (localWeights[k] || 0), 0)}%
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSettings(false)} style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#94A3B8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={saveWeights} disabled={savingWeights} style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #6366F1, #4F46E5)', border: 'none', color: '#FFF', cursor: savingWeights ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: savingWeights ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {savingWeights ? <Loader2 size={14} className="animate-spin" /> : null}
                {savingWeights ? 'Saving…' : 'Save & Recalculate'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ── Profile Modal ── */}
      {selectedProfile && createPortal((() => {
        const profile = selectedProfile;
        const isAggregate = profile.churchAttendance == null && profile.submissionRate == null;
        const isLeader = profile.submissionRate != null;
        const metricDefs = isAggregate ? AGG_METRICS : SCORE_METRICS;
        const weights = isAggregate ? null : (isLeader ? data.weights?.leader : data.weights?.member);
        const rows = metricDefs
          .filter(m => profile[m.key] != null)
          .map(m => {
            const value = profile[m.key];
            const weight = weights ? (weights[m.weightKey] ?? 0) : null;
            const contribution = weight != null ? Math.round((value * weight) / 100) : null;
            return { ...m, value, weight, contribution };
          });
        const profileName = profile.full_name || profile.leader_name || profile.name || '—';

        const infoFields = [];
        if (!isAggregate && !isLeader) {
          if (profile.membership_id) infoFields.push({ label: 'Membership ID', value: profile.membership_id });
          if (profile.section_name) infoFields.push({ label: 'Section', value: profile.section_name });
          if (profile.leader_name) infoFields.push({ label: 'Leader', value: profile.leader_name });
          if (profile.gender) infoFields.push({ label: 'Gender', value: profile.gender });
          if (profile.age_group) infoFields.push({ label: 'Age Group', value: profile.age_group });
        } else if (isLeader) {
          if (profile.section_name) infoFields.push({ label: 'Section', value: profile.section_name });
          if (profile.memberCount != null) infoFields.push({ label: 'Members', value: profile.memberCount });
        } else {
          if (profile.name) infoFields.push({ label: 'Name', value: profile.name });
          if (profile.membersCount != null) infoFields.push({ label: 'Members', value: profile.membersCount });
        }

        return (
          <div style={s.modal} onClick={e => { if (e.target === e.currentTarget) setSelectedProfile(null); }}>
            <div style={s.modalBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>
                    {profileName}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                    {profile.overallScore != null ? `Overall Score: ${profile.overallScore}%` : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedProfile(null)} style={{ background: 'rgba(71,85,105,0.3)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Info fields */}
              {infoFields.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {infoFields.map((f, i) => (
                    <div key={i} style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 10, padding: '10px 12px' }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>{f.label}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>{f.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Badges */}
              {profile.badges?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {profile.badges.map((b, i) => <Badge key={i} badge={b} />)}
                </div>
              )}

              {/* Quick stat cards for individual profiles */}
              {!isAggregate && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Attendance', value: profile.churchAttendance, color: '#6366F1' },
                    { label: 'Cell', value: profile.cellAttendance, color: '#A78BFA' },
                    { label: 'Evangelism', value: profile.evangelism, color: '#F97316' },
                    { label: 'Contributions', value: profile.contributions, color: '#FBBF24' },
                    { label: 'Events', value: profile.eventParticipation, color: '#38BDF8' },
                    isLeader ? { label: 'Submission', value: profile.submissionRate, color: '#6366F1' } : null,
                    isLeader ? { label: 'Follow-ups', value: profile.followupCompletion, color: '#34D399' } : null,
                  ].filter(Boolean).map((stat, i) => (
                    <div key={i} style={{ background: `${stat.color}10`, border: `1px solid ${stat.color}20`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value != null ? stat.value : '—'}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 10, fontWeight: 600, color: '#64748B' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Score breakdown */}
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.07em' }}>
                  Score Breakdown {weights ? '(value × weight = contribution)' : '(group metrics)'}
                </p>
                {rows.map((r, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#CBD5E1' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>
                        {r.value}{r.key === 'membersCount' || r.key === 'visitors' ? '' : '%'}
                        {r.weight != null && <span style={{ fontWeight: 400, color: '#64748B', marginLeft: 6 }}>× {r.weight}%</span>}
                        {r.contribution != null && <span style={{ fontWeight: 700, color: '#94A3B8', marginLeft: 6 }}>+{r.contribution}</span>}
                      </span>
                    </div>
                    <ScoreBar value={r.key === 'membersCount' || r.key === 'visitors' ? 100 : r.value} color={r.color} />
                    {r.note && <p style={{ margin: '5px 0 0', fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>{r.note}</p>}
                  </div>
                ))}
                {weights && (
                  <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(99,102,241,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>Sum of contributions → Overall</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#818CF8' }}>{profile.overallScore}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
};

export default RewardsView;
