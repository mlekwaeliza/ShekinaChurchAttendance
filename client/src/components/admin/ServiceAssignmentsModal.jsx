import React, { useState, useEffect } from 'react';
import { X, Search, Check, ShieldAlert, Calendar } from 'lucide-react';

const ServiceAssignmentsModal = ({ 
  isOpen, 
  onClose, 
  selectedDate,
  selectedServiceId,
  serviceTypes,
  leaders = [], 
  sections = [],
  assignedLeaderIds = [], 
  onSave, 
  loading 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(assignedLeaderIds);
  
  useEffect(() => {
    setSelectedIds(assignedLeaderIds);
  }, [assignedLeaderIds, isOpen]);

  if (!isOpen) return null;

  const currentService = serviceTypes.find(s => s.id === selectedServiceId);
  const serviceName = currentService?.name || 'Service';

  // Sort leaders by section, then name
  const sortedLeaders = [...leaders].sort((a, b) => {
    if (a.section_name > b.section_name) return 1;
    if (a.section_name < b.section_name) return -1;
    return a.full_name > b.full_name ? 1 : -1;
  });

  const filteredLeaders = sortedLeaders.filter(l => 
    l.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.section_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleLeader = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (sectionName) => {
    const secLeaders = sortedLeaders.filter(l => l.section_name === sectionName).map(l => l.id);
    const allSelected = secLeaders.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !secLeaders.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...secLeaders])]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 p-safe-bottom animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden scale-in">
        
        {/* Header */}
        <div className="px-6 py-6 sm:px-8 sm:py-8 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-primary-500" />
                Assign Duty Roster
              </h2>
              <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                Grant explicit permission for leaders to take attendance for <span className="text-primary-600 dark:text-primary-400">{serviceName}</span> on <span className="text-primary-600 dark:text-primary-400">{selectedDate}</span>.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 sm:p-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leaders by name or section..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
          {sections.map(section => {
            const secLeaders = filteredLeaders.filter(l => l.section_name === section.name);
            if (secLeaders.length === 0) return null;
            
            const isAllSelected = secLeaders.every(l => selectedIds.includes(l.id));

            return (
              <div key={section.id} className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/50">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{section.name}</h3>
                  <button 
                    onClick={() => handleSelectAll(section.name)}
                    className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {secLeaders.map(leader => {
                    const isSelected = selectedIds.includes(leader.id);
                    return (
                      <div 
                        key={leader.id}
                        onClick={() => toggleLeader(leader.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 shadow-sm shadow-primary-500/10' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-primary-500 border-primary-500' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-slate-700 dark:text-slate-300'}`}>
                            {leader.full_name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {filteredLeaders.length === 0 && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 font-medium">
              No leaders found matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-6 sm:px-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {selectedIds.length} leaders assigned
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(selectedIds)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl bg-primary-600 text-white font-black hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50 min-w-[120px]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Save Assignments'
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ServiceAssignmentsModal;
