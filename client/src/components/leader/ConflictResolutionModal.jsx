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
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-system-orange/15">
              <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-system-orange" />
            </div>
            <div>
              <h3 className="text-headline font-semibold text-label">Sync Conflicts</h3>
              <p className="text-footnote text-secondary-label">
                {conflicts.length} record(s) could not be synced
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon btn-ghost -mr-1.5 rounded-lg p-1.5"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body space-y-4">
          <p className="text-footnote text-secondary-label">
            These attendance records were already submitted on the server. Choose how to handle each
            one.
          </p>

          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="rounded-xl bg-system-grouped-background/70 p-4 dark:bg-white/[0.03]"
            >
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-tertiary-label" />
                <span className="text-footnote font-semibold text-label">{conflict.date}</span>
                <span className="text-caption-1 text-tertiary-label">
                  — queued {formatDate(conflict.timestamp)}
                </span>
              </div>
              <p className="mb-3 text-caption-1 text-secondary-label">
                {conflict.attendance.length} members marked
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => onResolve(conflict.id, 'discard')}
                  className="btn-secondary flex flex-1 items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4 text-rose-700 dark:text-system-red" />
                  Discard
                </button>
                <button
                  onClick={() => onResolve(conflict.id, 'overwrite')}
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
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
