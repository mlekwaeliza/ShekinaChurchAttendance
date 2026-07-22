import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, Crown, Layers, Home, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { adminAPI } from '../../services/api';

const typeConfig = {
  member: { icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'Member' },
  leader: { icon: Crown, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'Leader' },
  section: { icon: Layers, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Section' },
  home_cell: { icon: Home, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', label: 'Home Cell' },
  department: { icon: Building2, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', label: 'Department' },
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

  const handleSelect = useCallback((item) => {
    if (item.type === 'member') navigate(`/admin/members?profile=${item.id}`);
    else if (item.type === 'leader') navigate(`/admin/leaders?profile=${item.id}`);
    else if (item.type === 'section') navigate(`/admin/sections?profile=${item.id}`);
    else if (item.type === 'home_cell') navigate('/admin/home-cells');
    else if (item.type === 'department') navigate('/admin/departments');
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIndex]) { handleSelect(results[selectedIndex]); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          {loading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search members, leaders, sections, home cells..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
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
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIndex
                        ? 'bg-primary-50 dark:bg-primary-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.full_name || item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {config.label}
                        {item.membership_id && ` · ${item.membership_id}`}
                        {item.section_name && ` · ${item.section_name}`}
                        {item.cell_number && ` · #${item.cell_number}`}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No results found for "{query}"</p>
            </div>
          ) : query.length < 2 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">Type at least 2 characters to search</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;