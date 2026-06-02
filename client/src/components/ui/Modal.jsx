import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[95vw]',
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className = '',
  labelledBy,
  describedBy,
  closeOnOverlayClick = true
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;
  const subtitleId = useRef(`modal-subtitle-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCloseRef.current?.();
    }
    // Focus trap
    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = dialogRef.current.querySelectorAll(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      document.addEventListener('keydown', handleEsc);
      // Defer focus to next tick so the modal is in the DOM
      const t = setTimeout(() => {
        const focusables = dialogRef.current?.querySelectorAll(FOCUSABLE);
        const target = focusables?.[0] || dialogRef.current;
        target?.focus();
      }, 0);
      return () => {
        clearTimeout(t);
        document.removeEventListener('keydown', handleEsc);
        const prev = previouslyFocusedRef.current;
        if (prev && typeof prev.focus === 'function') prev.focus();
      };
    }
    return undefined;
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (!closeOnOverlayClick) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? titleId : undefined)}
        aria-describedby={describedBy || (subtitle ? subtitleId : undefined)}
        tabIndex={-1}
        className={`modal-content ${sizeClasses[size] || sizeClasses.md} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="modal-header">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
              {subtitle && <p id={subtitleId} className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="btn-ghost p-1.5 -mr-1.5 rounded-lg"
              aria-label="Close dialog"
              type="button"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
