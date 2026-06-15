import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const DataTable = React.memo(({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  onRowClick,
  emptyIcon: EmptyIcon,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no records to display.',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });

  const filteredData = useMemo(() => {
    if (!searchTerm.trim() || searchKeys.length === 0) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row =>
      searchKeys.some(key => {
        const val = typeof key === 'function' ? key(row) : row[key];
        return val && String(val).toLowerCase().includes(term);
      })
    );
  }, [data, searchTerm, searchKeys]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const col = columns.find(c => c.accessor === sortConfig.key);
    if (!col) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor];
      const bVal = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        const cmp = aVal - bVal;
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      const aNum = Number(aStr);
      const bNum = Number(bStr);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        const cmp = aNum - bNum;
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      }
      const cmp = aStr.localeCompare(bStr);
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortConfig, columns]);

  const toggleSort = (accessor) => {
    setSortConfig(prev => {
      if (prev.key === accessor) {
        return { key: accessor, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key: accessor, dir: 'asc' };
    });
  };

  return (
    <div className={`card overflow-hidden ${className}`}>
      {searchable && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="input pl-10 h-10"
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <div className="max-h-[68vh] overflow-auto scrollbar-thin">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-white/5">
            <thead className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-800/90 dark:backdrop-blur-xl">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.accessor || col.id}
                    className={`px-6 py-3.5 text-left text-label uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold ${col.sortable ? 'cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300 transition-colors' : ''} ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''}`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => col.sortable && toggleSort(col.accessor)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && (
                        sortConfig.key === col.accessor
                          ? sortConfig.dir === 'asc'
                            ? <ArrowUp className="w-3 h-3 text-primary-500" />
                            : <ArrowDown className="w-3 h-3 text-primary-500" />
                          : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {sortedData.length > 0 ? (
                sortedData.map((row, i) => (
                  <tr
                    key={row.id || i}
                    className={`transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick && onRowClick(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.accessor || col.id}
                        className={`px-6 py-4 text-sm text-slate-600 dark:text-slate-400 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''}`}
                      >
                        {col.render
                          ? col.render(row)
                          : typeof col.accessor === 'function'
                            ? col.accessor(row)
                            : row[col.accessor]
                        }
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="empty-state py-12">
                      {EmptyIcon && <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-4"><EmptyIcon className="w-7 h-7 text-slate-300 dark:text-slate-500" /></div>}
                      <p className="empty-state-title">{emptyTitle}</p>
                      <p className="empty-state-desc">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default DataTable;
DataTable.displayName = 'DataTable';
