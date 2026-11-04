import React from 'react';
import { Activity, Brain, Calendar, Shield, TrendingUp, Zap } from 'lucide-react';
import { InsightCard, MetricCard } from './reportShared';

const InsightsTab = ({ insights = [], prediction }) => (
  <div className="space-y-4">
    <h3 className="text-headline font-semibold text-label flex items-center gap-2">
      <Zap className="w-5 h-5 text-primary-700" />
      AI Executive Insights
    </h3>
    {insights.length === 0 ? (
      <div className="text-center py-12 text-tertiary-label text-footnote">
        <Brain className="w-8 h-8 mx-auto mb-2 text-tertiary-label" />
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
      <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] p-5 shadow-card">
        <h3 className="text-footnote font-semibold text-label mb-3">Predictive Analytics</h3>
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
