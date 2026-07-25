import React from 'react';
import { Church } from 'lucide-react';

const BrandMark = ({ compact = false, inverse = false, className = '' }) => (
  <div className={`inline-flex items-center gap-3 ${className}`}>
    <div className="brand-mark-symbol" aria-hidden="true">
      <Church className="h-5 w-5" strokeWidth={2.2} />
    </div>
    {!compact && (
      <div className="min-w-0">
        <p className={`brand-mark-name ${inverse ? 'text-white' : 'text-slate-950 dark:text-white'}`}>
          Shekina
        </p>
        <p className={`brand-mark-kicker ${inverse ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
          Church Operations
        </p>
      </div>
    )}
  </div>
);

export default BrandMark;
