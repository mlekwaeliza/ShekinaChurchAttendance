import { useEffect, useRef, useCallback } from 'react';

// useModalA11y(ref, isOpen, onClose)
// Adds the standard accessibility behaviors that the shared
// <Modal /> component provides, for ad-hoc createPortal modals
// that can't easily migrate to the shared component because of
// custom styling or layout.
//
// Behaviors:
//   1. Closes the modal on Escape (calls onClose()).
//   2. Traps Tab / Shift-Tab focus inside the dialog referenced
//      by ref.current. The first / last focusable elements
//      receive focus when the user tries to leave.
//   3. Saves the previously focused element on open and restores
//      focus to it on close.
//   4. Locks document.body scroll while open.
//
// Usage:
//   const dialogRef = useRef(null);
//   useModalA11y(dialogRef, isOpen, onClose);
//   ...
//   <div ref={dialogRef} role="dialog" aria-modal="true" ...>
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalA11y(dialogRef, isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    previouslyFocusedRef.current = document.activeElement;
    return () => {
      document.body.style.overflow = '';
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch (_) { /* element may be gone */ }
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(FOCUSABLE);
        if (focusables.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }
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
    };
    document.addEventListener('keydown', handler);

    // Defer focus to next tick so the dialog is in the DOM.
    const t = setTimeout(() => {
      const focusables = dialogRef.current?.querySelectorAll(FOCUSABLE);
      const target = focusables?.[0] || dialogRef.current;
      target?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handler);
    };
  }, [isOpen, dialogRef]);
}

export default useModalA11y;
