import React from 'react';

const variants = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

const Badge = ({ children, variant = 'neutral', dot = false, className = '' }) => {
  return (
    <span className={`${variants[variant] || variants.neutral} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-emerald-500' :
          variant === 'warning' ? 'bg-amber-500' :
          variant === 'danger' ? 'bg-rose-500' :
          variant === 'info' ? 'bg-primary-500' :
          'bg-slate-400'
        }`} />
      )}
      {children}
    </span>
  );
};

export default Badge;
