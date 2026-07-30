import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';

/**
 * Full-screen photo lightbox.
 * Props:
 *   src       – image src (base64 or URL)
 *   alt       – alt / member name
 *   onClose   – close handler
 */
const PhotoViewer = ({ src, alt = 'Photo', onClose }) => {
  // Close on Escape key
  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${alt.replace(/\s+/g, '_')}_photo.jpg`;
    a.click();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-4"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-xs font-semibold border border-white/20 transition-all"
          title="Download photo"
        >
          <Download className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/20 transition-all"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Photo */}
      <div
        className="relative max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
        />
        {alt && (
          <p className="mt-3 text-center text-white/80 text-sm font-semibold tracking-wide">
            {alt}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
};

export default PhotoViewer;
