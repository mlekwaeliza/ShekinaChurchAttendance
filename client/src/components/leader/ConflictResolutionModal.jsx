import React from 'react';
import { X, AlertTriangle, Trash2, Upload, Clock } from 'lucide-react';

const ConflictResolutionModal = ({ conflicts, onResolve, onClose }) => {
  if (conflicts.length === 0) return null;

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sync Conflicts</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {conflicts.length} record(s) could not be synced
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These attendance records were already submitted on the server. Choose how to handle each one.
          </p>

          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {conflict.date}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  — queued {formatDate(conflict.timestamp)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {conflict.attendance.length} members marked
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => onResolve(conflict.id, 'discard')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                    bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-700 dark:text-slate-200
                    hover:bg-slate-50 dark:hover:bg-slate-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  Discard
                </button>
                <button
                  onClick={() => onResolve(conflict.id, 'overwrite')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                    bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Overwrite Server
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button
            onClick={() => {
              conflicts.forEach((c) => onResolve(c.id, 'discard'));
              onClose();
            }}
            className="btn-secondary"
          >
            Discard All
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;
