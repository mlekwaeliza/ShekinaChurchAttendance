import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Trophy, Star, Crown, Award, TrendingUp, TrendingDown, Users,
  Church, Heart, Flame, BookOpen, Target, Settings2, ChevronRight,
  Calendar, Zap, Medal, BarChart2, Shield, GitMerge, Globe, 
  CheckCircle2, AlertCircle, Info, Loader2, RefreshCw, X,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, Building2, Home, UserPlus, Trash2
} from 'lucide-react';
import { adminAPI } from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────────────
const getRankMedal = (rank) => {
  if (rank === 1) return { icon: '🥇', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
  if (rank === 2) return { icon: '🥈', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  if (rank === 3) return { icon: '🥉', color: '#CD7C2F', bg: 'rgba(205,124,47,0.12)' };
  return { icon: String(rank), color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
};

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
        {sub && (
          <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{sub}</span>
            {item.avgSubmissionTime && item.avgSubmissionTime !== '—' && (
              <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(249,115,22,0.1)', color: '#F97316', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                ⏰ Avg: {item.avgSubmissionTime}
              </span>
            )}
          </p>
        )}
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

// ─── Family Manager ───────────────────────────────────────────────────────
const FamilyManager = ({ families, allMembers, onRefresh }) => {
  const [newName, setNewName] = useState('');
  const [newHead, setNewHead] = useState('');
  const [addMemberFamily, setAddMemberFamily] = useState('');
  const [addMemberId, setAddMemberId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState(null);

  const toggleFamily = (familyId) => {
    setExpandedFamily(expandedFamily === familyId ? null : familyId);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await adminAPI.createFamily(newName.trim(), newHead || null);
      setNewName('');
      setNewHead('');
      onRefresh();
    } catch (e) { console.error('Create family error:', e); }
    setBusy(false);
  };

  const handleAddMember = async () => {
    if (!addMemberFamily || !addMemberId) return;
    setBusy(true);
    try {
      await adminAPI.addFamilyMember(addMemberFamily, addMemberId, addMemberRole);
      setAddMemberId('');
      setAddMemberRole('member');
      onRefresh();
    } catch (e) { console.error('Add family member error:', e); }
    setBusy(false);
  };

  const handleRemoveMember = async (familyId, memberId) => {
    setBusy(true);
    try {
      await adminAPI.removeFamilyMember(familyId, memberId);
      onRefresh();
    } catch (e) { console.error('Remove family member error:', e); }
    setBusy(false);
  };

  const handleDelete = async (familyId) => {
    if (!confirm('Delete this family? Members will be unlinked.')) return;
    setBusy(true);
    try {
      await adminAPI.deleteFamily(familyId);
      onRefresh();
    } catch (e) { console.error('Delete family error:', e); }
    setBusy(false);
  };

  const inputStyle = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(71,85,105,0.3)',
    background: 'rgba(15,23,42,0.6)', color: '#F1F5F9', fontSize: 13, outline: 'none',
  };
  const btnStyle = {
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: '#6366F1', color: '#FFF', fontSize: 13, fontWeight: 600,
  };

  return (
    <div style={s.section}>
      <div style={s.sectionTitle}><Home size={14} /> Family Management</div>

      {/* Create new family */}
      <div style={{ marginBottom: 16, padding: 16, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: '1px solid rgba(71,85,105,0.25)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#C7D2FE', marginBottom: 10 }}>Create New Family</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Family name (e.g. The Wael Family)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <select value={newHead} onChange={e => setNewHead(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
            <option value="">Head of family (optional)</option>
            {allMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          <button onClick={handleCreate} disabled={busy || !newName.trim()} style={{ ...btnStyle, opacity: busy || !newName.trim() ? 0.5 : 1 }}>
            <Home size={14} style={{ display: 'inline', marginRight: 4 }} /> Create
          </button>
        </div>
      </div>

      {/* Add member to family */}
      <div style={{ marginBottom: 16, padding: 16, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: '1px solid rgba(71,85,105,0.25)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#C7D2FE', marginBottom: 10 }}>Assign Member to Family</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={addMemberFamily} onChange={e => setAddMemberFamily(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
            <option value="">Select family</option>
            {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
            <option value="">Select member</option>
            {allMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          <select value={addMemberRole} onChange={e => setAddMemberRole(e.target.value)} style={{ ...inputStyle, minWidth: 120 }}>
            <option value="head">Head</option>
            <option value="spouse">Spouse</option>
            <option value="child">Child</option>
            <option value="member">Member</option>
          </select>
          <button onClick={handleAddMember} disabled={busy || !addMemberFamily || !addMemberId} style={{ ...btnStyle, opacity: busy || !addMemberFamily || !addMemberId ? 0.5 : 1 }}>
            <UserPlus size={14} style={{ display: 'inline', marginRight: 4 }} /> Assign
          </button>
        </div>
      </div>

      {/* Family list */}
      {families.length === 0 ? (
        <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No families created yet. Create one above to get started.</p>
      ) : (
        families.map(f => (
          <div key={f.id} style={{
            marginBottom: 8, padding: '14px 16px',
            background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.25)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Home size={16} color="#818CF8" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#F1F5F9', fontSize: 14 }}>{f.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{f.memberCount} member{f.memberCount !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                disabled={busy}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#F87171', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                <Trash2 size={12} style={{ display: 'inline', marginRight: 4 }} /> Delete
              </button>
            </div>
          </div>
        ))
      )}
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
  const [profileDetail, setProfileDetail] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [memberFilter, setMemberFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');

  const openProfile = (item, type) => setSelectedProfile({ type, item });

  useEffect(() => {
    if (!selectedProfile) { setProfileDetail(null); return; }
    setProfileLoading(true);
    adminAPI.getPerformanceProfile(selectedProfile.type, selectedProfile.item.id, filter)
      .then(res => setProfileDetail(res.data))
      .catch(() => setProfileDetail(null))
      .finally(() => setProfileLoading(false));
  }, [selectedProfile, filter]);

  // Close modals on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (selectedProfile) setSelectedProfile(null);
        else if (showSettings) setShowSettings(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedProfile, showSettings]);

  const tabs = [
    { id: 'members', label: 'Members', icon: <Users size={14} /> },
    { id: 'leaders', label: 'Leaders', icon: <Crown size={14} /> },
    { id: 'cells', label: 'Home Cells', icon: <Heart size={14} /> },
    { id: 'sections', label: 'Sections', icon: <Building2 size={14} /> },
    { id: 'departments', label: 'Ministries', icon: <Shield size={14} /> },
    { id: 'families', label: 'Families', icon: <Home size={14} /> },
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
      setError(e?.response?.data?.detail || 'Failed to load performance data. Please try again.');
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
    } catch (e) { setError('Failed to save weights: ' + (e?.response?.data?.error || e.message)); }
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
  const allMembers = data?.members || [];
  const families = data?.families || [];
  const members = (() => {
    if (memberFilter === 'all' && familyFilter === 'all') return allMembers;
    return allMembers.filter(m => {
      if (familyFilter !== 'all' && String(m.family_id) !== String(familyFilter)) return false;
      if (memberFilter === 'men') return (m.gender || '').toLowerCase().startsWith('m');
      if (memberFilter === 'women') return (m.gender || '').toLowerCase().startsWith('f');
      if (memberFilter === 'youth') return (m.age_group || '').toLowerCase().includes('youth');
      if (memberFilter === 'visitors') return (m.evCount || 0) > 0;
      return true;
    });
  })();
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
          <div style={{ marginBottom: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: 'All', key: 'all' },
              { label: '👨 Men', key: 'men' },
              { label: '👩 Women', key: 'women' },
              { label: '🧒 Youth', key: 'youth' },
              { label: '🙌 Evangelists', key: 'visitors' },
            ].map(({ label, key }) => (
              <button key={key}
                onClick={() => setMemberFilter(key)}
                style={{
                  padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid',
                  background: memberFilter === key ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.06)',
                  borderColor: memberFilter === key ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.15)',
                  color: memberFilter === key ? '#C7D2FE' : '#818CF8',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
            {families.length > 0 && (
              <select
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                style={{
                  padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid rgba(99,102,241,0.25)',
                  background: familyFilter !== 'all' ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.06)',
                  color: familyFilter !== 'all' ? '#C7D2FE' : '#818CF8',
                  outline: 'none',
                }}
              >
                <option value="all">👨‍👩‍👧 All Families</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>🏠 {f.name} ({f.memberCount})</option>
                ))}
              </select>
            )}
          </div>
          {members.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>No member data available for this period.</p>
          ) : (
            members.map((m, i) => {
              const item = m.family_name
                ? { ...m, section_name: `${m.section_name || ''} • 🏠 ${m.family_name}` }
                : m;
              return (
                <LeaderboardRow key={m.id} item={item} rank={m.rank || i + 1}
                  nameKey="full_name" subKey="section_name"
                  scoreKey="overallScore" subLabel="Score"
                  metricColor="#6366F1"
                  onClick={() => openProfile(m, 'member')}
                />
              );
            })
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
                onClick={(item) => openProfile(item, 'leader')}
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
              const enhanced = { ...c, badges: [] };
              return (
                <div key={c.id} onClick={() => openProfile(c, 'cell')} style={{
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
                  <RankDelta delta={enhanced.rankDelta || c.rankDelta || 0} />
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
              <div key={sec.id} onClick={() => openProfile(sec, 'section')} style={{
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
                <RankDelta delta={sec.rankDelta || 0} />
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
              <div key={d.id} onClick={() => openProfile(d, 'department')} style={{
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
                <RankDelta delta={d.rankDelta || 0} />
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

      {activeTab === 'families' && (
        <FamilyManager families={families} allMembers={allMembers} onRefresh={load} />
      )}

      {activeTab === 'awards' && (
        <div style={s.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={s.sectionTitle}><Trophy size={14} /> Awards History</div>
            <button onClick={async () => {
              setAwarding(true);
              try { await adminAPI.awardPerformanceSeason({ filter }); await load(); } catch (e) { setError('Failed to record awards: ' + (e?.response?.data?.error || e.message)); } finally { setAwarding(false); }
            }} disabled={awarding} style={{ padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', color: '#FFF', cursor: awarding ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: awarding ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {awarding ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
              {awarding ? 'Recording…' : 'Award Season Champions'}
            </button>
          </div>
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
        const item = selectedProfile.item;
        const entityType = selectedProfile.type;
        const d = profileDetail;
        const isLoading = profileLoading;
        const isGroup = entityType === 'section' || entityType === 'department' || entityType === 'cell';

        if (isLoading || !d) {
          return (
            <div style={s.modal} onClick={e => { if (e.target === e.currentTarget) setSelectedProfile(null); }}>
              <div style={s.modalBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>{item.full_name || item.name || 'Profile'}</h3>
                  <button onClick={() => setSelectedProfile(null)} style={{ background: 'rgba(71,85,105,0.3)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}><X size={16} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
                  <div style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ color: '#64748B', fontSize: 13 }}>Loading profile…</p>
                </div>
              </div>
            </div>
          );
        }

        const e = d.entity;
        const ai = d.attendanceIntelligence || {};
        const tl = d.timeline || [];
        const tlStats = d.timelineStats || {};
        const rel = d.reliability || {};
        const cmp = d.comparison || {};
        const ach = d.achievements || [];
        const pred = d.predictions || {};
        const bk = d.breakdown || [];
        const insight = d.aiInsight || '';

        const sectionTitle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 10 };
        const card = { background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 10, padding: '10px 12px' };
        const statLabel = { margin: 0, fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' };
        const statValue = { margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#F1F5F9' };
        const miniLabel = { margin: 0, fontSize: 9, fontWeight: 600, color: '#64748B' };
        const miniValue = { margin: '1px 0 0', fontSize: 13, fontWeight: 700, color: '#CBD5E1' };

        const MetricRow = ({ label, value, sub, color }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 12, color: '#CBD5E1' }}>{label}</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: color || '#F1F5F9' }}>{value}</span>
              {sub && <span style={{ fontSize: 10, color: '#64748B', marginLeft: 6 }}>{sub}</span>}
            </div>
          </div>
        );

        const ScoreBarSmall = ({ value, color = '#6366F1' }) => (
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', width: '100%', marginTop: 4 }}>
            <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 2 }} />
          </div>
        );

        return (
          <div style={s.modal} onClick={ev => { if (ev.target === ev.currentTarget) setSelectedProfile(null); }}>
            <div style={{ ...s.modalBox, maxWidth: 700 }}>

              {/* ── 1. Executive Profile ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', position: 'relative',
                      background: `linear-gradient(135deg, ${e.gradeColor || '#6366F1'}, ${e.level?.color || '#818CF8'})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 800, color: '#FFF',
                      boxShadow: `0 0 0 3px rgba(255,255,255,0.08), 0 0 20px ${e.gradeColor || '#6366F1'}40`,
                    }}>
                      {(e.full_name || '?')[0]}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#F1F5F9', lineHeight: 1.2 }}>{e.full_name || e.name || '—'}</h3>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: e.level?.color || '#818CF8', fontWeight: 700 }}>
                        {e.level?.name || 'Member'} {e.grade && `• Grade ${e.grade}`}
                      </p>
                      {isGroup && e.memberCount != null && (
                        <p style={{ margin: '1px 0 0', fontSize: 10, color: '#64748B' }}>{e.memberCount} member{e.memberCount !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, marginTop: 8 }}>
                    {e.section_name && <div style={miniLabel}><span style={{ color: '#64748B' }}>Section: </span><span style={{ color: '#CBD5E1', fontWeight: 600 }}>{e.section_name}</span></div>}
                    {e.leader_name && entityType === 'member' && <div style={miniLabel}><span style={{ color: '#64748B' }}>Leader: </span><span style={{ color: '#CBD5E1', fontWeight: 600 }}>{e.leader_name}</span></div>}
                    {e.membership_id && <div style={miniLabel}><span style={{ color: '#64748B' }}>ID: </span><span style={{ color: '#CBD5E1', fontWeight: 600 }}>{e.membership_id}</span></div>}
                    {e.gender && <div style={miniLabel}><span style={{ color: '#64748B' }}>Gender: </span><span style={{ color: '#CBD5E1', fontWeight: 600 }}>{e.gender}</span></div>}
                    {e.age_group && <div style={miniLabel}><span style={{ color: '#64748B' }}>Age: </span><span style={{ color: '#CBD5E1', fontWeight: 600 }}>{e.age_group}</span></div>}
                    {isGroup && e.members != null && <div style={miniLabel}><span style={{ color: '#64748B' }}>Members: </span><span style={{ color: '#CBD5E1', fontWeight: 600 }}>{e.members.length}</span></div>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: e.gradeColor || '#818CF8', lineHeight: 1 }}>{e.overallScore}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>out of 100</div>
                  {e.rank && <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>Rank #{e.rank}{e.totalEntities ? ` of ${e.totalEntities}` : ''}</div>}
                  {e.prevRank != null && <div style={{ fontSize: 11, color: e.rankDelta > 0 ? '#34D399' : e.rankDelta < 0 ? '#F87171' : '#64748B' }}>
                    {e.rankDelta > 0 ? `↑ +${e.rankDelta}` : e.rankDelta < 0 ? `↓ ${e.rankDelta}` : '—'}
                    <span style={{ color: '#64748B', marginLeft: 4 }}>from #{e.prevRank}</span>
                  </div>}
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>
                    {e.riskLevel === 'Low' ? '🟢 Low Risk' : e.riskLevel === 'Medium' ? '🟡 Medium Risk' : '🔴 High Risk'}
                  </div>
                </div>
              </div>

              {/* ── 2. Ministry Health Cards ── */}
              {!isGroup && (
                <>
                  <p style={sectionTitle}>Ministry Health</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 18 }}>
                    {[
                      { label: 'Attendance', value: `${ai.lifetimeAttendance || e.churchAttendance || 0}%`, sub: ai.currentStreak ? `${ai.currentStreak} streak` : '', color: '#6366F1' },
                      { label: 'Last Present', value: ai.lastPresent || '—', sub: '', color: '#34D399' },
                      { label: 'Consec. Absent', value: ai.total && ai.absent ? `${ai.absent}` : '0', sub: '', color: ai.absent > 2 ? '#F87171' : '#34D399' },
                      { label: 'Lifetime', value: `${ai.presentCount || 0}`, sub: `of ${ai.total || 0} services`, color: '#818CF8' },
                      { label: 'Ministries', value: `${e.ministryCount || 0}`, sub: (e.departments || []).join(', ') || 'None', color: '#A78BFA' },
                      { label: 'Evangelism', value: `${e.evCount || 0}`, sub: 'souls invited', color: '#F97316' },
                      { label: 'Giving', value: e.hasContribution ? 'Regular' : 'None', sub: '', color: '#FBBF24' },
                      { label: 'Leadership', value: e.leadershipPotential || 'Low', sub: '', color: e.leadershipPotential === 'High' ? '#22C55E' : '#94A3B8' },
                      { label: 'Follow-up', value: e.followUpNeeded ? 'YES' : 'NO', sub: '', color: e.followUpNeeded ? '#F87171' : '#34D399' },
                    ].map((c, i) => (
                      <div key={i} style={{ ...card, borderLeft: `3px solid ${c.color}` }}>
                        <p style={statLabel}>{c.label}</p>
                        <p style={{ ...statValue, color: c.color, fontSize: 14 }}>{c.value}</p>
                        {c.sub && <p style={{ margin: '1px 0 0', fontSize: 9, color: '#64748B' }}>{c.sub}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── 3. Performance Timeline ── */}
              {tl.filter(m => m.overallScore != null).length > 1 && (
                <>
                  <p style={sectionTitle}>Performance Timeline</p>
                  <div style={{ ...card, marginBottom: 18 }}>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60, marginBottom: 8 }}>
                      {tl.filter(m => m.overallScore != null).map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ width: '100%', height: `${Math.max(2, m.overallScore * 0.55)}px`, background: m.overallScore >= 80 ? '#34D399' : m.overallScore >= 50 ? '#FBBF24' : '#F87171', borderRadius: 3 }} />
                          <span style={{ fontSize: 8, color: '#64748B' }}>{m.month}</span>
                          <span style={{ fontSize: 8, color: '#94A3B8', fontWeight: 600 }}>{m.overallScore}%</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94A3B8' }}>
                      <span>Avg: <b style={{ color: '#F1F5F9' }}>{tlStats.avg}%</b></span>
                      <span>Best: <b style={{ color: '#34D399' }}>{tlStats.bestMonth || '—'}</b></span>
                      <span>Worst: <b style={{ color: '#F87171' }}>{tlStats.worstMonth || '—'}</b></span>
                      <span>Trend: <b style={{ color: tlStats.trend === 'Improving' ? '#34D399' : tlStats.trend === 'Declining' ? '#F87171' : '#FBBF24' }}>{tlStats.trend || '—'}</b></span>
                    </div>
                  </div>
                </>
              )}

              {/* ── 4. Reliability Analysis ── */}
              {rel.overall != null && (
                <>
                  <p style={sectionTitle}>Reliability Analysis</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                    <div style={{ ...card, gridColumn: 'span 1' }}>
                      {[
                        { label: 'Attendance', value: rel.attendance },
                        { label: 'Consistency', value: rel.consistency },
                        { label: 'Participation', value: rel.participation },
                        { label: 'Leadership', value: rel.leadership },
                        { label: 'Evangelism', value: rel.evangelism },
                        { label: 'Giving', value: rel.giving },
                        { label: 'Cell', value: rel.cell },
                      ].map((r, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: '#CBD5E1' }}>{r.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: r.value >= 80 ? '#34D399' : r.value >= 50 ? '#FBBF24' : '#F87171' }}>{r.value}/100</span>
                          </div>
                          <ScoreBarSmall value={r.value} color={r.value >= 80 ? '#34D399' : r.value >= 50 ? '#FBBF24' : '#F87171'} />
                        </div>
                      ))}
                    </div>
                    <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 36, fontWeight: 800, color: rel.gradeColor || '#818CF8', lineHeight: 1 }}>{rel.overall}</div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>Overall Reliability</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: rel.gradeColor || '#818CF8', marginTop: 4 }}>Grade {rel.grade}</div>
                    </div>
                  </div>
                </>
              )}

              {/* ── 5. Attendance Intelligence ── */}
              {!isGroup && ai.present != null && (
                <>
                  <p style={sectionTitle}>Attendance Intelligence</p>
                  <div style={{ ...card, marginBottom: 18 }}>
                    <MetricRow label="Church Services" value={`${ai.present} / ${ai.total || '?'}`} sub="present / total" />
                    <MetricRow label="Present" value={ai.present} color="#34D399" />
                    <MetricRow label="Absent" value={ai.absent} color={ai.absent > 2 ? '#F87171' : '#CBD5E1'} />
                    <MetricRow label="Excused" value={ai.excused || 0} color="#FBBF24" />
                    <MetricRow label="Current Streak" value={`${ai.currentStreak || 0} services`} color="#818CF8" />
                    <MetricRow label="Longest Streak" value={`${ai.longestStreak || 0} services`} />
                    <MetricRow label="Lifetime Attendance" value={`${ai.lifetimeAttendance || 0}%`} color="#6366F1" />
                    <MetricRow label="Last Absent" value={ai.lastAbsent || 'Never'} />
                    <MetricRow label="Trend" value={ai.trend || '—'} color={ai.trend === 'Improving' ? '#34D399' : ai.trend === 'Declining' ? '#F87171' : '#FBBF24'} />
                    <MetricRow label="Attendance Rank" value={e.rank ? `#${e.rank} of ${e.totalEntities || '?'}` : '—'} />
                  </div>
                </>
              )}

              {/* ── 6. Ministry Intelligence (leaders) ── */}
              {entityType === 'leader' && (
                <>
                  <p style={sectionTitle}>Ministry Intelligence</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 18 }}>
                    {[
                      { label: 'Submission Rate', value: `${e.submissionRate || 0}%` },
                      { label: 'Member Attendance', value: `${e.memberAttendance || 0}%` },
                      { label: 'Follow-ups', value: `${e.followups || 0}` },
                      { label: 'Evangelism', value: `${e.evangelism || 0}` },
                      { label: 'Retention', value: `${e.retention || 0}%` },
                      { label: 'Cell Growth', value: `${e.cellGrowth || 0}%` },
                    ].map((c, i) => (
                      <div key={i} style={card}>
                        <p style={statLabel}>{c.label}</p>
                        <p style={statValue}>{c.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── 7. Achievements ── */}
              {ach.length > 0 && (
                <>
                  <p style={sectionTitle}>Achievements</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                    {ach.map((a, i) => (
                      <div key={i} style={{ background: a.tier === 'gold' ? 'rgba(245,158,11,0.12)' : a.tier === 'silver' ? 'rgba(148,163,184,0.12)' : 'rgba(99,102,241,0.08)', border: `1px solid ${a.tier === 'gold' ? 'rgba(245,158,11,0.3)' : a.tier === 'silver' ? 'rgba(148,163,184,0.3)' : 'rgba(99,102,241,0.2)'}`, borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{a.icon || '🏅'}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#F1F5F9' }}>{a.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── 8. Performance Breakdown (replaces old Score Breakdown) ── */}
              {bk.length > 0 && (
                <>
                  <p style={sectionTitle}>Performance Breakdown</p>
                  <div style={{ ...card, marginBottom: 18 }}>
                    {bk.map((r, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: '#CBD5E1' }}>{r.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: r.score >= 80 ? '#34D399' : r.score >= 50 ? '#FBBF24' : '#F87171' }}>{r.score}/100</span>
                        </div>
                        <ScoreBarSmall value={r.score} color={r.score >= 80 ? '#34D399' : r.score >= 50 ? '#FBBF24' : '#F87171'} />
                      </div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(99,102,241,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>Total Score</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: e.gradeColor || '#818CF8' }}>{e.overallScore}/100 • Grade {e.grade}</span>
                    </div>
                    {cmp.churchAvg != null && (
                      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
                        <div style={{ textAlign: 'center' }}><span style={{ color: '#64748B' }}>Church Avg</span><br /><b style={{ color: '#F1F5F9' }}>{cmp.churchAvg}%</b></div>
                        <div style={{ textAlign: 'center' }}><span style={{ color: '#64748B' }}>Section Avg</span><br /><b style={{ color: '#F1F5F9' }}>{cmp.sectionAvg}%</b></div>
                        <div style={{ textAlign: 'center' }}><span style={{ color: '#64748B' }}>Difference</span><br /><b style={{ color: (e.overallScore - cmp.churchAvg) >= 0 ? '#34D399' : '#F87171' }}>{e.overallScore - cmp.churchAvg >= 0 ? '+' : ''}{e.overallScore - cmp.churchAvg}</b></div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── 9. AI Pastoral Insight ── */}
              {insight && (
                <>
                  <p style={sectionTitle}>Pastoral Insight</p>
                  <div style={{ ...card, borderLeft: '3px solid #818CF8', marginBottom: 18 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{insight}</p>
                  </div>
                </>
              )}

              {/* ── 10. Predictions ── */}
              {pred.attendanceNextMonth != null && (
                <>
                  <p style={sectionTitle}>Predictions</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                    {[
                      { label: 'Attendance Next Month', value: `${pred.attendanceNextMonth}%` },
                      !isGroup && pred.leadershipReadiness > 0 && { label: 'Leadership Readiness', value: `${pred.leadershipReadiness}%` },
                      { label: 'Inactive Risk', value: `${pred.riskOfBecomingInactive}%`, color: pred.riskOfBecomingInactive > 30 ? '#F87171' : '#34D399' },
                      pred.volunteerPotential && pred.volunteerPotential !== 'Low' && { label: 'Volunteer Potential', value: pred.volunteerPotential },
                      { label: 'Promotion', value: pred.promotionRecommendation ? 'YES' : 'NO', color: pred.promotionRecommendation ? '#34D399' : '#94A3B8' },
                      { label: 'Follow-up Priority', value: pred.followUpPriority || 'LOW', color: pred.followUpPriority === 'High' ? '#F87171' : '#34D399' },
                    ].filter(Boolean).map((p, i) => (
                      <div key={i} style={card}>
                        <p style={statLabel}>{p.label}</p>
                        <p style={{ ...statValue, color: p.color || '#F1F5F9', fontSize: 14 }}>{p.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Close button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setSelectedProfile(null)} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.3)', color: '#94A3B8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
};

export default RewardsView;
