import React, { useState, useEffect } from 'react';
import { birthdayAPI } from '../../services/api';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { Calendar, Cake, Mail, MessageSquare, Download, ChevronRight, ChevronDown, Filter, Plus } from 'lucide-react';
import { addDays, formatDisplayDate, formatLocalDate, parseLocalDate } from '../../utils/date';

const BirthdayModule = () => {
  const [data, setData] = useState({ members: [], stats: {} });
  const [filter, setFilter] = useState('thisWeek');
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});

  const filters = [
    { id: 'thisWeek', label: 'This Week' },
    { id: 'next7Days', label: 'Next 7 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'next30Days', label: 'Next 30 Days' },
    { id: 'fullYear', label: 'Full Year List' }
  ];

  useEffect(() => {
    loadBirthdays();
  }, [filter]);

  const loadBirthdays = async () => {
    setLoading(true);
    try {
      const res = await birthdayAPI.getBirthdays({ filter });
      setData(res.data);
    } catch (error) {
      console.error('Failed to load birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    birthdayAPI.exportBirthdays({ filter });
  };

  const groupBirthdays = (members) => {
    if (filter === 'fullYear') {
      // Group by month
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const groups = {};
      members.forEach(m => {
        const monthIndex = parseLocalDate(m.date_of_birth).getMonth();
        const monthName = months[monthIndex];
        if (!groups[monthName]) groups[monthName] = [];
        groups[monthName].push(m);
      });
      return groups;
    } else {
      // Group by specific date
      const groups = {};
      members.forEach(m => {
        const date = m.date_of_birth;
        if (!groups[date]) groups[date] = [];
        groups[date].push(m);
      });
      return groups;
    }
  };

  const toggleMonth = (month) => {
    setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
  };

  const grouped = groupBirthdays(data.members);
  const today = formatLocalDate();

  const addToCalendar = (member) => {
    const bday = parseLocalDate(member.date_of_birth);
    const thisYear = new Date().getFullYear();
    const eventDate = new Date(thisYear, bday.getMonth(), bday.getDate());
    const startDate = formatLocalDate(eventDate).replace(/-/g, '');
    const endDate = formatLocalDate(addDays(eventDate, 1)).replace(/-/g, '');
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${member.name}'s Birthday`)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(`Send a greeting to ${member.name}`)}&sf=true&output=xml`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 p-6 text-white shadow-xl shadow-amber-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Cake className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Member Birthdays</h2>
              <p className="text-sm text-white/80">Manage and celebrate congregant milestones</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-all hover:bg-white/25"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard 
          icon={Cake} 
          label="Today" 
          value={data.stats.today || 0} 
          variant="primary" 
        />
        <StatCard 
          icon={Calendar} 
          label="This Week" 
          value={data.stats.thisWeek || 0} 
          variant="info" 
        />
        <StatCard 
          icon={Filter} 
          label="This Month" 
          value={data.stats.thisMonth || 0} 
          variant="warning" 
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl w-fit">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === f.id 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : data.members.length === 0 ? (
        <EmptyState
          icon={Cake}
          title={filter === 'thisWeek' ? "No birthdays this week 🎉" : "No birthdays found"}
          description={filter === 'thisWeek' ? "Check next month to plan ahead or invite more members." : "Try expanding your filter to see more upcoming birthdays."}
          action={filter === 'thisWeek' ? {
            label: "View Next 30 Days",
            onClick: () => setFilter('next30Days')
          } : null}
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([groupKey, members]) => (
            <div key={groupKey} className="space-y-4">
              {filter === 'fullYear' ? (
                <button 
                  onClick={() => toggleMonth(groupKey)}
                  className="flex items-center gap-3 group w-full text-left"
                >
                  <div className={`p-1 rounded-lg transition-colors ${expandedMonths[groupKey] ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    {expandedMonths[groupKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{groupKey}</h3>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{members.length} birthdays</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${groupKey === today ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                    {formatDisplayDate(groupKey, { weekday: 'short', month: 'long', day: 'numeric' })}
                    {groupKey === today && <span className="ml-2 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full text-[10px]">Today</span>}
                  </h3>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                </div>
              )}

              {(filter !== 'fullYear' || expandedMonths[groupKey]) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map(member => (
                    <div 
                      key={member.id} 
                      className={`group p-5 rounded-3xl bg-white dark:bg-slate-800 border transition-all hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 ${
                        member.is_today 
                        ? 'border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-800 dark:to-indigo-900/10' 
                        : 'border-slate-100 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                          <Cake className={`w-6 h-6 ${member.is_today ? 'text-indigo-600' : 'text-slate-400'} group-hover:text-white`} />
                        </div>
                        {member.age && (
                          <Badge variant="success" className="text-xs">
                            Turns {member.age}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1 mb-6">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{member.name}</h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="ghost" className="text-[10px] py-0">{member.section}</Badge>
                          <span className="text-[10px] text-slate-400 font-medium">Under {member.leader}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-slate-50 dark:border-slate-700">
                        <a 
                          href={`mailto:${member.email || ''}`}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition-all flex-1 flex justify-center items-center gap-2"
                          title="Send Message"
                        >
                          <Mail className="w-4 h-4" />
                          <span className="text-xs font-bold">Message</span>
                        </a>
                        <button 
                          onClick={() => addToCalendar(member)}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 transition-all flex-1 flex justify-center items-center gap-2"
                          title="Add to Calendar"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-xs font-bold">Remind</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BirthdayModule;
