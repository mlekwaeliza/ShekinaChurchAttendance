import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Users,
  Crown,
  Layers,
  Home,
  Building2,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { adminAPI } from '../../services/api';

const typeConfig = {
  member: {
    icon: Users,
    color: 'text-blue-700 dark:text-system-blue',
    bg: 'bg-system-blue/15',
    label: 'Member'
  },
  leader: {
    icon: Crown,
    color: 'text-amber-700 dark:text-system-orange',
    bg: 'bg-system-orange/15',
    label: 'Leader'
  },
  section: {
    icon: Layers,
    color: 'text-emerald-700 dark:text-system-green',
    bg: 'bg-system-green/15',
    label: 'Section'
  },
  home_cell: {
    icon: Home,
    color: 'text-purple-700 dark:text-system-purple',
    bg: 'bg-system-purple/15',
    label: 'Home Cell'
  },
  department: {
    icon: Building2,
    color: 'text-rose-700 dark:text-system-red',
    bg: 'bg-system-red/15',
    label: 'Department'
  }
};

const SearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await adminAPI.search(query.trim());
        setResults(res.data.results || []);
        setSelectedIndex(0);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback(
    (item) => {
      if (item.type === 'member') navigate(`/admin/members?profile=${item.id}`);
      else if (item.type === 'leader') navigate(`/admin/leaders?profile=${item.id}`);
      else if (item.type === 'section') navigate(`/admin/sections?profile=${item.id}`);
      else if (item.type === 'home_cell') navigate('/admin/home-cells');
      else if (item.type === 'department') navigate('/admin/departments');
      onClose();
    },
    [navigate, onClose]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-black/[0.08] bg-secondary-system-grouped-background shadow-modal dark:border-white/[0.1] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <div className="flex items-center gap-3 border-b border-separator/60 px-4 py-3 dark:border-white/[0.08]">
          {loading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-tertiary-label" />
          ) : (
            <Search className="h-5 w-5 shrink-0 text-tertiary-label" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search members, leaders, sections, home cells..."
            className="flex-1 bg-transparent text-subheadline text-label placeholder:text-tertiary-label outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((item, i) => {
                const config = typeConfig[item.type] || typeConfig.member;
                const Icon = config.icon;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIndex
                        ? 'bg-primary-500/[0.08]'
                        : 'hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-footnote font-semibold text-label">
                        {item.full_name || item.name}
                      </p>
                      <p className="text-caption-1 text-secondary-label">
                        {config.label}
                        {item.membership_id && ` · ${item.membership_id}`}
                        {item.section_name && ` · ${item.section_name}`}
                        {item.cell_number && ` · #${item.cell_number}`}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-tertiary-label" />
                  </button>
                );
              })}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="py-12 text-center">
              <p className="text-footnote text-secondary-label">No results found for "{query}"</p>
            </div>
          ) : query.length < 2 ? (
            <div className="py-12 text-center">
              <p className="text-footnote text-secondary-label">
                Type at least 2 characters to search
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
