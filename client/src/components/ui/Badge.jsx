import React from 'react';

const variants = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral'
};

const dotColors = {
  success: 'bg-system-green',
  warning: 'bg-system-orange',
  danger: 'bg-system-red',
  info: 'bg-primary-500',
  neutral: 'bg-system-gray'
};

const Badge = ({ children, variant = 'neutral', dot = false, icon: Icon, className = '' }) => {
  return (
    <span className={`${variants[variant] || variants.neutral} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant] || dotColors.neutral}`} />
      )}
      {children}
    </span>
  );
};

export default Badge;
