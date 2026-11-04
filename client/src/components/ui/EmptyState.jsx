import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No results found',
  description = '',
  action,
  actionLabel = 'Get Started',
  className = ''
}) => {
  const actionConfig = typeof action === 'object' && action !== null ? action : null;
  const actionHandler = actionConfig ? actionConfig.onClick : action;
  const label = actionConfig?.label || actionLabel;

  return (
    <div className={`empty-state ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-system-fill">
        <Icon className="h-6 w-6 text-tertiary-label" strokeWidth={1.75} />
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
