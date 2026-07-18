import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { newMemberLeaderAPI, evangelismAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fdate, fdatetime } from '../../utils/date';
import { capitalizeName } from '../../utils/phone';
import {
  Users, UserPlus, GraduationCap, BarChart3, Calendar, CheckCircle2, X, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, Search, Phone, Mail, MapPin, FileText, Clock,
  BookOpen, Target, TrendingUp, Award, Home, UserCheck, Heart, Zap, ArrowRight,
  Filter, Download, Plus, Sparkles, Flag, Activity, Layers
} from 'lucide-react';

const PIPELINE_STAGES = [
  { key: 'received', label: 'Newly Received', color: 'blue', icon: UserPlus },
  { key: 'orientation_scheduled', label: 'Orientation Scheduled', color: 'cyan', icon: Calendar },
  { key: 'orientation_in_progress', label: 'Orientation In Progress', color: 'amber', icon: BookOpen },
  { key: 'orientation_completed', label: 'Orientation Completed', color: 'teal', icon: CheckCircle2 },
  { key: 'home_cell_assigned', label: 'Home Cell Assigned', color: 'indigo', icon: Home },
  { key: 'section_assigned', label: 'Section Assigned', color: 'violet', icon: Users },
  { key: 'mentor_assigned', label: 'Mentor Assigned', color: 'purple', icon: UserCheck },
  { key: 'ministry_placement', label: 'Ministry Placement', color: 'pink', icon: Zap },
  { key: 'graduation_review', label: 'Graduation Review', color: 'orange', icon: GraduationCap },
  { key: 'permanent', label: 'Permanent Member', color: 'emerald', icon: Award },
];

const STAGE_COLORS = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  pink: { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
};

const TABS = [
  { key: 'pipeline', label: 'Pipeline', icon: Layers },
  { key: 'tasks', label: 'My Tasks', icon: CheckCircle2 },
  { key: 'orientation', label: 'Orientation', icon: BookOpen },
  { key: 'mentorship', label: 'Mentorship', icon: UserCheck },
  { key: 'graduation', label: 'Graduation', icon: GraduationCap },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const asArray = (v) => Array.isArray(v) ? v : [];
const R = (v) => Math.round(Number(v) || 0);

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

const NewMemberPipeline = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [pipelineData, setPipelineData] = useState({});
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [awaitingTransfer, setAwaitingTransfer] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', address: '',
    date_joined: new Date().toISOString().split('T')[0],
    decision_type: 'Salvation', marital_status: '',
    date_of_birth: '', occupation: '', invitation_source: '',
    notes: ''
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const [pipelineRes, statsRes, tasksRes] = await Promise.all([
        newMemberLeaderAPI.getPipeline(),
        newMemberLeaderAPI.getPipelineStats(),
        newMemberLeaderAPI.getPipelineTasks(),
      ]);
      const allMembers = asArray(pipelineRes.data);
      const grouped = {};
      PIPELINE_STAGES.forEach(s => { grouped[s.key] = []; });
      allMembers.forEach(m => {
        const stage = m.pipeline_stage || 'received';
        if (grouped[stage]) grouped[stage].push(m);
      });
      setPipelineData(grouped);
      setStats(statsRes.data);
      setTasks(asArray(tasksRes.data));
    } catch (e) {
      console.error('Failed to load pipeline:', e);
      showMessage('error', 'Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFunnel = useCallback(async () => {
    try {
      const res = await newMemberLeaderAPI.getAssimilationFunnel();
      setFunnel(res.data);
    } catch (e) { console.error('Funnel load failed:', e); }
  }, []);

  useEffect(() => { loadPipeline(); }, [loadPipeline]);
  useEffect(() => { if (activeTab === 'analytics') loadFunnel(); }, [activeTab, loadFunnel]);

  const handleMoveStage = async (memberId, newStage) => {
    try {
      await newMemberLeaderAPI.movePipelineStage(memberId, newStage);
      showMessage('success', `Member moved to ${PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage}`);
      loadPipeline();
      if (selectedMember?.id === memberId) {
        setSelectedMember({ ...selectedMember, pipeline_stage: newStage });
      }
    } catch (e) {
      console.error('Move failed:', e);
      showMessage('error', 'Failed to move member');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return showMessage('error', 'Full name is required');
    try {
      await newMemberLeaderAPI.createNewMember({ ...form, added_by: user?.id });
      showMessage('success', 'New member added to pipeline');
      setShowAddForm(false);
      setForm({ full_name: '', phone: '', email: '', address: '', date_joined: new Date().toISOString().split('T')[0], decision_type: 'Salvation', marital_status: '', date_of_birth: '', occupation: '', invitation_source: '', notes: '' });
      loadPipeline();
    } catch (e) { showMessage('error', 'Failed to add member'); }
  };

  const handleTransfer = async (soulWonId) => {
    try {
      await newMemberLeaderAPI.transferBaptized(soulWonId);
      showMessage('success', 'Baptized member transferred to New Members');
      loadPipeline();
      loadAwaitingTransfer();
    } catch (e) { showMessage('error', 'Transfer failed'); }
  };

  const handleTransferAll = async () => {
    try {
      const res = await newMemberLeaderAPI.transferAllBaptized();
      showMessage('success', `Transferred ${res.data?.transferred || 0} members`);
      loadPipeline();
      loadAwaitingTransfer();
    } catch (e) { showMessage('error', 'Bulk transfer failed'); }
  };

  const loadAwaitingTransfer = async () => {
    try {
      const res = await newMemberLeaderAPI.getAwaitingTransfer();
      setAwaitingTransfer(asArray(res.data));
    } catch (e) { console.error('Awaiting transfer load failed:', e); }
  };

  // ── Pipeline Kanban View ─────────────────────────────────────────────────
  const renderPipeline = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assimilation Pipeline</h2>
          <p className="text-xs text-slate-500">Track members from baptism to permanent membership</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowTransferModal(true); loadAwaitingTransfer(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="w-3.5 h-3.5" /> Receive from Evangelism
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Member
          </button>
        </div>
      </div>

      {showAddForm && (
        <AddMemberForm form={form} setForm={setForm} onSubmit={handleSubmit} onCancel={() => setShowAddForm(false)} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
          {PIPELINE_STAGES.map((stage, idx) => {
            const members = asArray(pipelineData[stage.key]);
            const sc = STAGE_COLORS[stage.color];
            return (
              <div key={stage.key} className="flex-shrink-0 w-72 flex flex-col">
                <div className={`rounded-t-xl px-3 py-2.5 border ${sc.border} ${sc.bg} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <stage.icon className={`w-4 h-4 ${sc.text}`} />
                    <span className={`text-xs font-bold ${sc.text}`}>{stage.label}</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>{members.length}</span>
                </div>
                <div className="flex-1 rounded-b-xl border-x border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '600px' }}>
                  {members.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-4">No members</p>
                  )}
                  {members.map(m => (
                    <MemberCard key={m.id} member={m} stage={stage} onClick={() => setSelectedMember(m)} onMove={handleMoveStage} />
                  ))}
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="flex items-center justify-center pt-1">
                    <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Tasks View ──────────────────────────────────────────────────────────
  const renderTasks = () => {
    const priorityColors = { high: 'rose', medium: 'amber', low: 'slate' };
    const priorityBg = { high: 'bg-rose-50 dark:bg-rose-950/20', medium: 'bg-amber-50 dark:bg-amber-950/20', low: 'bg-slate-50 dark:bg-slate-900/30' };
    const priorityText = { high: 'text-rose-700 dark:text-rose-300', medium: 'text-amber-700 dark:text-amber-300', low: 'text-slate-600 dark:text-slate-400' };
    const taskIcons = { missed_orientation: AlertTriangle, no_home_cell: Home, no_section: Users, no_mentor: UserCheck, inactive: Clock, ready_graduation: GraduationCap };

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Today's Ministry Tasks</h2>
          <p className="text-xs text-slate-500">Actionable items that need your attention</p>
        </div>
        {tasks.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">All caught up!</p>
            <p className="text-xs text-slate-400">No pending tasks for today.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map((task, i) => {
              const Icon = taskIcons[task.task_type] || Flag;
              const pColor = priorityColors[task.priority] || 'slate';
              return (
                <div key={i} className={`rounded-xl border border-slate-200 dark:border-slate-700 ${priorityBg[task.priority] || ''} p-4 hover:border-indigo-300 transition-colors cursor-pointer`}
                  onClick={() => { const m = { id: task.id, full_name: task.full_name, pipeline_stage: task.pipeline_stage }; setSelectedMember(m); }}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${priorityText[task.priority] || 'text-slate-500'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{task.full_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityText[task.priority] || ''} capitalize`}>{task.priority}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Orientation View ────────────────────────────────────────────────────
  const renderOrientation = () => {
    const orientationStages = ['orientation_scheduled', 'orientation_in_progress', 'orientation_completed'];
    const allMembers = orientationStages.flatMap(s => asArray(pipelineData[s]));

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Orientation Management</h2>
          <p className="text-xs text-slate-500">Track discipleship classes and orientation progress</p>
        </div>
        {allMembers.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400">No members currently in orientation.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allMembers.map(m => {
              const stage = PIPELINE_STAGES.find(s => s.key === m.pipeline_stage);
              const sc = stage ? STAGE_COLORS[stage.color] : STAGE_COLORS.blue;
              const daysInAssimilation = daysBetween(m.date_joined);
              return (
                <div key={m.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:border-indigo-300 transition-colors cursor-pointer"
                  onClick={() => setSelectedMember(m)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>{stage?.label || m.pipeline_stage}</span>
                    <span className="text-[10px] text-slate-400">{daysInAssimilation != null ? `${daysInAssimilation}d in assimilation` : ''}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{m.full_name}</p>
                  {m.phone && <p className="text-xs text-slate-500 mt-1">{m.phone}</p>}
                  <div className="mt-3 flex gap-2">
                    {m.pipeline_stage === 'orientation_scheduled' && (
                      <button onClick={(e) => { e.stopPropagation(); handleMoveStage(m.id, 'orientation_in_progress'); }}
                        className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 transition-colors">Start Classes</button>
                    )}
                    {m.pipeline_stage === 'orientation_in_progress' && (
                      <button onClick={(e) => { e.stopPropagation(); handleMoveStage(m.id, 'orientation_completed'); }}
                        className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-300 transition-colors">Mark Completed</button>
                    )}
                    {m.pipeline_stage === 'orientation_completed' && (
                      <button onClick={(e) => { e.stopPropagation(); handleMoveStage(m.id, 'home_cell_assigned'); }}
                        className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 transition-colors">Assign Home Cell</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Mentorship View ────────────────────────────────────────────────────
  const renderMentorship = () => {
    const mentorshipStages = ['section_assigned', 'mentor_assigned', 'ministry_placement'];
    const allMembers = mentorshipStages.flatMap(s => asArray(pipelineData[s]));

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mentorship & Placement</h2>
          <p className="text-xs text-slate-500">Manage mentor assignments and ministry placement</p>
        </div>
        {allMembers.length === 0 ? (
          <div className="text-center py-16">
            <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400">No members awaiting mentorship.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allMembers.map(m => {
              const stage = PIPELINE_STAGES.find(s => s.key === m.pipeline_stage);
              const sc = stage ? STAGE_COLORS[stage.color] : STAGE_COLORS.violet;
              return (
                <div key={m.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:border-indigo-300 transition-colors cursor-pointer"
                  onClick={() => setSelectedMember(m)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>{stage?.label || m.pipeline_stage}</span>
                    {m.mentor_name && <span className="text-[10px] text-slate-400">Mentor: {m.mentor_name}</span>}
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{m.full_name}</p>
                  {m.section_name && <p className="text-xs text-slate-500 mt-1">Section: {m.section_name}</p>}
                  {m.home_cell_name && <p className="text-xs text-slate-500">Home Cell: {m.home_cell_name}</p>}
                  <div className="mt-3 flex gap-2">
                    {m.pipeline_stage === 'section_assigned' && (
                      <button onClick={(e) => { e.stopPropagation(); handleMoveStage(m.id, 'mentor_assigned'); }}
                        className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 transition-colors">Assign Mentor</button>
                    )}
                    {m.pipeline_stage === 'mentor_assigned' && (
                      <button onClick={(e) => { e.stopPropagation(); handleMoveStage(m.id, 'ministry_placement'); }}
                        className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300 transition-colors">Place in Ministry</button>
                    )}
                    {m.pipeline_stage === 'ministry_placement' && (
                      <button onClick={(e) => { e.stopPropagation(); handleMoveStage(m.id, 'graduation_review'); }}
                        className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 transition-colors">Send to Graduation</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Graduation View ─────────────────────────────────────────────────────
  const renderGraduation = () => {
    const reviewMembers = asArray(pipelineData['graduation_review']);
    const permanentMembers = asArray(pipelineData['permanent']);

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Graduation & Permanent Membership</h2>
          <p className="text-xs text-slate-500">Review and approve members for permanent membership</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-orange-500" /> Awaiting Graduation Review ({reviewMembers.length})
            </h3>
            {reviewMembers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No members ready for graduation review.</p>
            ) : (
              <div className="space-y-2">
                {reviewMembers.map(m => (
                  <div key={m.id} className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{m.full_name}</p>
                        {m.section_name && <p className="text-xs text-slate-500">Section: {m.section_name}</p>}
                        {m.mentor_name && <p className="text-xs text-slate-500">Mentor: {m.mentor_name}</p>}
                      </div>
                      <button onClick={() => handleMoveStage(m.id, 'permanent')}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                        Approve & Graduate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" /> Permanent Members ({permanentMembers.length})
            </h3>
            {permanentMembers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No permanent members yet.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {permanentMembers.map(m => (
                  <div key={m.id} className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{m.full_name}</p>
                    {m.section_name && <p className="text-xs text-slate-500">Section: {m.section_name}</p>}
                    {m.graduation_date && <p className="text-xs text-emerald-600">Graduated: {fdate(m.graduation_date)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Analytics View ──────────────────────────────────────────────────────
  const renderAnalytics = () => {
    const funnelData = funnel ? [
      { label: 'Outreach Events', value: funnel.outreach_events || 0, color: 'bg-blue-500' },
      { label: 'Souls Won', value: funnel.souls_won || 0, color: 'bg-cyan-500' },
      { label: 'Baptized', value: funnel.baptized || 0, color: 'bg-teal-500' },
      { label: 'Received', value: funnel.received || 0, color: 'bg-indigo-500' },
      { label: 'Orientation Started', value: funnel.orientation_started || 0, color: 'bg-amber-500' },
      { label: 'Graduation Review', value: funnel.graduation_review || 0, color: 'bg-orange-500' },
      { label: 'Permanent', value: funnel.permanent || 0, color: 'bg-emerald-500' },
    ] : [];
    const maxVal = Math.max(...funnelData.map(d => d.value), 1);

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assimilation Analytics</h2>
          <p className="text-xs text-slate-500">Funnel from outreach to permanent membership</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" /> Assimilation Funnel
          </h3>
          {!funnel ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-3">
              {funnelData.map((d, i) => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-32 shrink-0">{d.label}</span>
                  <div className="flex-1 h-8 rounded-lg bg-slate-100 dark:bg-slate-900/40 overflow-hidden">
                    <div className={`h-full ${d.color} flex items-center justify-end pr-2 transition-all`} style={{ width: `${(d.value / maxVal) * 100}%` }}>
                      <span className="text-xs font-black text-white">{d.value}</span>
                    </div>
                  </div>
                  {i < funnelData.length - 1 && (
                    <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">
                      {funnelData[i].value > 0 ? `${Math.round((funnelData[i + 1].value / funnelData[i].value) * 100)}%` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Dashboard KPI Bar ──────────────────────────────────────────────────
  const renderDashboardBar = () => {
    if (!stats) return null;
    const kpis = [
      { label: 'Received This Month', value: stats.receivedThisMonth || 0, icon: UserPlus, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
      { label: 'Orientation Scheduled', value: stats.orientationScheduled || 0, icon: Calendar, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30' },
      { label: 'Completion Rate', value: `${stats.orientationCompletionRate || 0}%`, icon: BookOpen, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
      { label: 'Awaiting Cell', value: stats.awaitCellAssignment || 0, icon: Home, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
      { label: 'Awaiting Mentor', value: stats.awaitMentor || 0, icon: UserCheck, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
      { label: 'Ready for Graduation', value: stats.readyGraduation || 0, icon: GraduationCap, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
      { label: 'Graduation Rate', value: `${stats.graduationRate || 0}%`, icon: Award, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
      { label: 'Permanent Members', value: stats.permanentMembers || 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
      { label: 'In Pipeline', value: stats.totalInPipeline || 0, icon: Layers, color: 'text-slate-600 bg-slate-50 dark:bg-slate-900/30' },
    ];
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2 mb-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${k.color}`}>
              <k.icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-white">{k.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>
    );
  };

  // ── Transfer Modal ──────────────────────────────────────────────────────
  const renderTransferModal = () => {
    if (!showTransferModal) return null;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTransferModal(false)}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Receive Baptized Members from Evangelism</h3>
              <p className="text-xs text-slate-500 mt-0.5">These souls have completed baptism and are ready for assimilation.</p>
            </div>
            <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4">
            {awaitingTransfer.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm text-slate-500">No baptized souls awaiting transfer.</p>
                <p className="text-xs text-slate-400 mt-1">All baptized members have been received.</p>
              </div>
            ) : (
              <>
                <button onClick={handleTransferAll}
                  className="w-full mb-3 text-xs font-bold py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  Transfer All ({awaitingTransfer.length})
                </button>
                <div className="space-y-2">
                  {awaitingTransfer.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{s.full_name}</p>
                        <p className="text-xs text-slate-500">Baptized: {fdate(s.baptism_date)}</p>
                      </div>
                      <button onClick={() => handleTransfer(s.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 transition-colors">
                        Transfer
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800'}`}>
          {message.text}
        </div>
      )}

      {renderDashboardBar()}

      {/* Navigation */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${activeTab === t.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'pipeline' && renderPipeline()}
      {activeTab === 'tasks' && renderTasks()}
      {activeTab === 'orientation' && renderOrientation()}
      {activeTab === 'mentorship' && renderMentorship()}
      {activeTab === 'graduation' && renderGraduation()}
      {activeTab === 'analytics' && renderAnalytics()}

      {renderTransferModal()}

      {selectedMember && (
        <MemberProfileModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onMove={handleMoveStage}
          onUpdate={loadPipeline}
        />
      )}
    </div>
  );
};

// ── Member Card Component ─────────────────────────────────────────────────
const MemberCard = ({ member, stage, onClick, onMove }) => {
  const daysInAssimilation = daysBetween(member.date_joined);
  const daysSinceBaptism = daysBetween(member.baptism_date);
  const riskColors = { low: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', high: 'bg-rose-100 text-rose-700' };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-xs"
      onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white truncate">{member.full_name}</p>
          {member.phone && <p className="text-[10px] text-slate-400 truncate">{member.phone}</p>}
        </div>
        {member.risk_status && member.risk_status !== 'low' && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${riskColors[member.risk_status] || riskColors.low}`}>{member.risk_status}</span>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5">
        {daysSinceBaptism != null && <p className="text-[9px] text-slate-400">{daysSinceBaptism}d since baptism</p>}
        {daysInAssimilation != null && <p className="text-[9px] text-slate-400">{daysInAssimilation}d in assimilation</p>}
        {member.section_name && <p className="text-[9px] text-indigo-500">Section: {member.section_name}</p>}
        {member.home_cell_name && <p className="text-[9px] text-indigo-500">Cell: {member.home_cell_name}</p>}
        {member.mentor_name && <p className="text-[9px] text-purple-500">Mentor: {member.mentor_name}</p>}
      </div>
      {stage && onMove && (() => {
        const nextStageIdx = PIPELINE_STAGES.findIndex(s => s.key === stage.key) + 1;
        if (nextStageIdx < PIPELINE_STAGES.length) {
          const nextStage = PIPELINE_STAGES[nextStageIdx];
          return (
            <button onClick={(e) => { e.stopPropagation(); onMove(member.id, nextStage.key); }}
              className={`mt-2 w-full text-[9px] font-bold py-1 rounded-lg ${STAGE_COLORS[nextStage.color].bg} ${STAGE_COLORS[nextStage.color].text} hover:opacity-80 transition-colors border ${STAGE_COLORS[nextStage.color].border}`}>
              Move to {nextStage.label}
            </button>
          );
        }
        return null;
      })()}
    </div>
  );
};

// ── Add Member Form ───────────────────────────────────────────────────────
const AddMemberForm = ({ form, setForm, onSubmit, onCancel }) => {
  const inputClass = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30";
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add New Member</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className={inputClass} placeholder="Full Name *" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
        <input className={inputClass} placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className={inputClass} placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        <input className={inputClass} type="date" value={form.date_joined} onChange={e => setForm({ ...form, date_joined: e.target.value })} />
        <select className={inputClass} value={form.decision_type} onChange={e => setForm({ ...form, decision_type: e.target.value })}>
          <option>Salvation</option><option>Transfer</option><option>Restoration</option><option>Visitor</option><option>Other</option>
        </select>
        <input className={inputClass} type="date" placeholder="Date of Birth" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
        <input className={inputClass} placeholder="Occupation" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} />
        <select className={inputClass} value={form.marital_status} onChange={e => setForm({ ...form, marital_status: e.target.value })}>
          <option value="">Marital Status</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
        </select>
        <select className={inputClass} value={form.invitation_source} onChange={e => setForm({ ...form, invitation_source: e.target.value })}>
          <option value="">Invitation Source</option><option>Friend</option><option>Social Media</option><option>Church Outreach</option><option>Family Member</option><option>Walk-in</option><option>Other</option>
        </select>
      </div>
      <textarea className={inputClass} placeholder="Notes" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
        <button type="submit" className="text-xs font-bold px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Add Member</button>
      </div>
    </form>
  );
};

// ── Member Profile Modal ─────────────────────────────────────────────────
const MemberProfileModal = ({ member, onClose, onMove, onUpdate }) => {
  const [tab, setTab] = useState('overview');
  const [journey, setJourney] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFollowupForm, setShowFollowupForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [journeyRes, followupsRes, attendanceRes] = await Promise.all([
          newMemberLeaderAPI.getJourney(member.id).catch(() => ({ data: [] })),
          newMemberLeaderAPI.getFollowups(member.id).catch(() => ({ data: [] })),
          newMemberLeaderAPI.getAttendance(member.id).catch(() => ({ data: [] })),
        ]);
        setJourney(asArray(journeyRes.data));
        setFollowups(asArray(followupsRes.data));
        setAttendance(asArray(attendanceRes.data));
      } catch (e) { console.error('Profile load failed:', e); }
      finally { setLoading(false); }
    };
    if (member?.id) load();
  }, [member?.id]);

  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.key === member?.pipeline_stage);
  const progressPct = currentStageIdx >= 0 ? Math.round(((currentStageIdx + 1) / PIPELINE_STAGES.length) * 100) : 0;
  const daysInAssimilation = daysBetween(member?.date_joined);
  const daysSinceBaptism = daysBetween(member?.baptism_date);

  const journeySteps = [
    { label: 'Received', stage: 'received' },
    { label: 'Orientation Scheduled', stage: 'orientation_scheduled' },
    { label: 'Orientation In Progress', stage: 'orientation_in_progress' },
    { label: 'Orientation Completed', stage: 'orientation_completed' },
    { label: 'Home Cell Assigned', stage: 'home_cell_assigned' },
    { label: 'Section Assigned', stage: 'section_assigned' },
    { label: 'Mentor Assigned', stage: 'mentor_assigned' },
    { label: 'Ministry Placement', stage: 'ministry_placement' },
    { label: 'Graduation Review', stage: 'graduation_review' },
    { label: 'Permanent Member', stage: 'permanent' },
  ];

  const tabs = ['Overview', 'Journey', 'Discipleship', 'Follow-ups', 'Graduation'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{member?.full_name}</h2>
              {member?.phone && <p className="text-xs text-slate-500">{member.phone}</p>}
              <div className="flex items-center gap-2 mt-1">
                {member?.pipeline_stage && (() => {
                  const st = PIPELINE_STAGES.find(s => s.key === member.pipeline_stage);
                  return st ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[st.color].bg} ${STAGE_COLORS[st.color].text} border ${STAGE_COLORS[st.color].border}`}>{st.label}</span> : null;
                })()}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Assimilation Progress</span>
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900/40 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t.toLowerCase())}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${tab === t.toLowerCase() ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : (
            <>
              {tab === 'overview' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoCard label="Member ID" value={member?.id} />
                    <InfoCard label="Days Since Baptism" value={daysSinceBaptism ?? '—'} />
                    <InfoCard label="Days in Assimilation" value={daysInAssimilation ?? '—'} />
                    <InfoCard label="Section" value={member?.section_name || 'Not assigned'} />
                    <InfoCard label="Home Cell" value={member?.home_cell_name || 'Not assigned'} />
                    <InfoCard label="Mentor" value={member?.mentor_name || 'Not assigned'} />
                    <InfoCard label="Decision Type" value={member?.decision_type || '—'} />
                    <InfoCard label="Date Joined" value={fdate(member?.date_joined)} />
                    <InfoCard label="Risk Status" value={member?.risk_status || 'low'} />
                  </div>
                  {member?.next_action && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
                      <p className="text-[10px] font-bold uppercase text-amber-600">Next Required Action</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{member.next_action}</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'journey' && (
                <div className="space-y-2">
                  {journeySteps.map((step, i) => {
                    const reached = currentStageIdx >= i;
                    const journeyEntry = journey.find(j => j.stage === step.stage);
                    return (
                      <div key={i} className={`flex items-start gap-3 ${reached ? '' : 'opacity-40'}`}>
                        <div className="flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${reached ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                            {reached ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                          </div>
                          {i < journeySteps.length - 1 && <div className={`w-0.5 h-6 ${reached ? 'bg-emerald-300' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                        </div>
                        <div className="pt-1 pb-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{step.label}</p>
                          {journeyEntry && <p className="text-[10px] text-slate-400">{fdatetime(journeyEntry.stage_date)}{journeyEntry.recorded_by_name ? ` by ${journeyEntry.recorded_by_name}` : ''}</p>}
                          {journeyEntry?.notes && <p className="text-xs text-slate-500 mt-0.5">{journeyEntry.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'discipleship' && (
                <div className="space-y-3">
                  {(() => {
                    const presentCount = attendance.filter(a => Number(a.attended) === 1).length;
                    const totalWeeks = attendance.length;
                    const attendanceRate = totalWeeks > 0 ? Math.round((presentCount / totalWeeks) * 100) : 0;
                    const metrics = [
                      { label: 'Orientation Completion', value: member?.orientation_completion_date ? '100%' : '0%', icon: BookOpen },
                      { label: 'Sunday Attendance', value: `${attendanceRate}%`, icon: Calendar },
                      { label: 'Weeks Tracked', value: totalWeeks, icon: Clock },
                      { label: 'Weeks Present', value: presentCount, icon: CheckCircle2 },
                      { label: 'Assimilation Score', value: `${member?.assimilation_score || 0}/100`, icon: Award },
                    ];
                    return metrics.map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                        <div className="flex items-center gap-2">
                          <m.icon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{m.label}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{m.value}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {tab === 'follow-ups' && (
                <div className="space-y-3">
                  <button onClick={() => setShowFollowupForm(!showFollowupForm)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300">
                    + Add Follow-up
                  </button>
                  {showFollowupForm && <FollowupForm memberId={member.id} onSaved={() => { setShowFollowupForm(false); onUpdate(); }} />}
                  {followups.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No follow-up records yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {followups.map((f, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-600">{f.followup_type}</span>
                            <span className="text-[10px] text-slate-400">{fdatetime(f.followup_date)}</span>
                          </div>
                          {f.notes && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{f.notes}</p>}
                          {f.next_followup_date && <p className="text-[10px] text-amber-600 mt-1">Next: {fdate(f.next_followup_date)}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'graduation' && (
                <div className="space-y-3">
                  <GraduationChecklist member={member} attendance={attendance} />
                  {member?.pipeline_stage === 'graduation_review' && (
                    <button onClick={() => { onMove(member.id, 'permanent'); onClose(); }}
                      className="w-full text-sm font-bold py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                      Approve & Graduate to Permanent Membership
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Helper Components ────────────────────────────────────────────────────
const InfoCard = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-2.5">
    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
  </div>
);

const FollowupForm = ({ memberId, onSaved }) => {
  const [type, setType] = useState('phone_call');
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await newMemberLeaderAPI.addFollowup(memberId, { followup_type: type, notes, next_followup_date: nextDate || null });
      onSaved();
    } catch (e) { console.error('Followup save failed:', e); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <select value={type} onChange={e => setType(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs">
        <option value="phone_call">Phone Call</option>
        <option value="visit">Visit</option>
        <option value="mentor_session">Mentor Session</option>
        <option value="pastoral_meeting">Pastoral Meeting</option>
        <option value="prayer_request">Prayer Request</option>
      </select>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." rows={2} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs" />
      <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs" />
      <button type="submit" disabled={saving} className="w-full text-xs font-bold py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Follow-up'}
      </button>
    </form>
  );
};

const GraduationChecklist = ({ member, attendance }) => {
  const presentCount = attendance.filter(a => Number(a.attended) === 1).length;
  const items = [
    { label: 'Orientation Completed', done: !!member?.orientation_completion_date },
    { label: 'Home Cell Active', done: !!member?.home_cell_id },
    { label: 'Section Assigned', done: !!member?.section_name },
    { label: 'Mentor Assigned', done: !!member?.mentor_name },
    { label: 'Attends Church Consistently', done: presentCount >= 3 },
    { label: 'Serving in Ministry', done: !!member?.ministry_department_id },
    { label: 'In Graduation Review Stage', done: member?.pipeline_stage === 'graduation_review' },
  ];
  const completed = items.filter(i => i.done).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-900 dark:text-white">Graduation Checklist</span>
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${completed === items.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{completed}/{items.length}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          {item.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-slate-300" />}
          <span className={`text-xs ${item.done ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400'}`}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default NewMemberPipeline;
