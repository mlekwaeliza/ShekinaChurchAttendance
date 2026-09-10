import React from 'react';
import { Activity, Brain, Calendar, Shield, TrendingUp, Zap } from 'lucide-react';
import { InsightCard, MetricCard } from './reportShared';

const InsightsTab = ({ insights = [], prediction }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
      <Zap className="w-5 h-5 text-indigo-600" />
      AI Executive Insights
    </h3>
    {insights.length === 0 ? (
      <div className="text-center py-12 text-slate-400 text-sm">
        <Brain className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        No insights available for current data
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} index={i} />
        ))}
      </div>
    )}

    {prediction?.weeks_analyzed > 0 && (
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Predictive Analytics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Predicted Rate"
            value={prediction.predicted_rate || 0}
            suffix="%"
            icon={TrendingUp}
            color="indigo"
            showDiff={false}
          />
          <MetricCard
            label="Trend"
            value={prediction.trend || 'Stable'}
            icon={Activity}
            color={prediction.trend === 'increasing' ? 'emerald' : 'amber'}
            showDiff={false}
          />
          <MetricCard
            label="Weeks Analyzed"
            value={prediction.weeks_analyzed || 0}
            icon={Calendar}
            color="sky"
            showDiff={false}
          />
          <MetricCard
            label="Confidence"
            value={prediction.confidence || 0}
            suffix="%"
            icon={Shield}
            color="violet"
            showDiff={false}
          />
        </div>
      </div>
    )}
  </div>
);

export default InsightsTab;
