import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No results found',
  description = '',
  action,
  actionLabel = 'Get Started',
  className = '',
}) => {
  const actionConfig = typeof action === 'object' && action !== null ? action : null;
  const actionHandler = actionConfig ? actionConfig.onClick : action;
  const label = actionConfig?.label || actionLabel;

  return (
    <div className={`empty-state ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-300 dark:text-slate-500" />
      </div>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {actionHandler && (
        <button onClick={actionHandler} className="btn-primary btn-sm mt-5">
          {label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
