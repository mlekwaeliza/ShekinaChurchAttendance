import React, { useEffect, useMemo, useState } from 'react';
import { FileText, LayoutTemplate, ShieldAlert, Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import { formatDisplayDate } from '../../utils/date';

const REPORT_TEMPLATES = {
  executive: {
    label: 'Executive',
    description: 'High-level ministry health with section and leadership highlights.',
    icon: LayoutTemplate,
    defaults: {
      title: 'Executive Ministry Report',
      includeSectionBreakdown: true,
      includeLeaderPerformance: true,
      includeAtRiskMembers: true,
      includeActionItems: true,
    }
  },
  leadership: {
    label: 'Leadership',
    description: 'Focus on leader reporting, section performance, and coaching needs.',
    icon: Trophy,
    defaults: {
      title: 'Leadership Performance Report',
      includeSectionBreakdown: true,
      includeLeaderPerformance: true,
      includeAtRiskMembers: false,
      includeActionItems: true,
    }
  },
  pastoralCare: {
    label: 'Pastoral Care',
    description: 'Emphasize follow-up priorities and members needing attention.',
    icon: ShieldAlert,
    defaults: {
      title: 'Pastoral Care Follow-Up Report',
      includeSectionBreakdown: false,
      includeLeaderPerformance: false,
      includeAtRiskMembers: true,
      includeActionItems: true,
    }
  }
};

const CHECKBOXES = [
  {
    key: 'includeSectionBreakdown',
    label: 'Section breakdown',
    description: 'Include latest section attendance rates and ranking.'
  },
  {
    key: 'includeLeaderPerformance',
    label: 'Leader performance',
    description: 'Include the leader table with reporting and attendance rates.'
  },
  {
    key: 'includeAtRiskMembers',
    label: 'At-risk members',
    description: 'Include members with repeated recent absences.'
  },
  {
    key: 'includeActionItems',
    label: 'Action items',
    description: 'Add recommended next steps based on the current data.'
  }
];

function buildInitialState(templateKey) {
  const template = REPORT_TEMPLATES[templateKey];
  return {
    reportType: templateKey,
    title: template.defaults.title,
    preparedBy: '',
    includeSectionBreakdown: template.defaults.includeSectionBreakdown,
    includeLeaderPerformance: template.defaults.includeLeaderPerformance,
    includeAtRiskMembers: template.defaults.includeAtRiskMembers,
    includeActionItems: template.defaults.includeActionItems,
  };
}

const ReportBuilderModal = ({ isOpen, onClose, dateRange, onGenerate, loading = false }) => {
  const [form, setForm] = useState(() => buildInitialState('executive'));

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState('executive'));
    }
  }, [isOpen]);

  const selectedTemplate = useMemo(() => REPORT_TEMPLATES[form.reportType], [form.reportType]);

  const applyTemplate = (templateKey) => {
    setForm(prev => ({
      ...prev,
      ...buildInitialState(templateKey),
      preparedBy: prev.preparedBy
    }));
  };

  const footer = (
    <>
      <button onClick={onClose} className="btn-secondary">
        Cancel
      </button>
      <button
        onClick={() => onGenerate(form)}
        disabled={loading || !form.title.trim()}
        className="btn-primary"
      >
        <FileText className="w-4 h-4" />
        <span>{loading ? 'Generating...' : 'Generate PDF'}</span>
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report Builder"
      subtitle={`Reporting window: ${formatDisplayDate(dateRange.start)} to ${formatDisplayDate(dateRange.end)}`}
      footer={footer}
      size="lg"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(REPORT_TEMPLATES).map(([key, template]) => {
            const Icon = template.icon;
            const isActive = form.reportType === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => applyTemplate(key)}
                className={`text-left rounded-2xl border px-4 py-4 transition-all ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{template.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{template.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
          <div className="space-y-4">
            <div>
              <label className="input-label">Report title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="Monthly ministry health report"
              />
            </div>
            <div>
              <label className="input-label">Prepared by</label>
              <input
                type="text"
                value={form.preparedBy}
                onChange={(e) => setForm(prev => ({ ...prev, preparedBy: e.target.value }))}
                className="input"
                placeholder="Senior Pastor"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/40">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              {selectedTemplate.label} template
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {selectedTemplate.description}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CHECKBOXES.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={form[item.key]}
                onChange={(e) => setForm(prev => ({ ...prev, [item.key]: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default ReportBuilderModal;
