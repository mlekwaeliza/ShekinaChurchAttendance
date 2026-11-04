import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { birthdayAPI } from '../../services/api';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import {
  Calendar,
  Cake,
  Mail,
  Download,
  ChevronRight,
  ChevronDown,
  Filter,
  Plus
} from 'lucide-react';
import { addDays, formatLocalDate, parseLocalDate, fdate } from '../../utils/date';

const BirthdayModule = () => {
  const { t } = useTranslation();
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
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
      ];
      const groups = {};
      members.forEach((m) => {
        const monthIndex = parseLocalDate(m.date_of_birth).getMonth();
        const monthName = months[monthIndex];
        if (!groups[monthName]) groups[monthName] = [];
        groups[monthName].push(m);
      });
      return groups;
    } else {
      // Group by specific date
      const groups = {};
      members.forEach((m) => {
        const date = m.date_of_birth;
        if (!groups[date]) groups[date] = [];
        groups[date].push(m);
      });
      return groups;
    }
  };

  const toggleMonth = (month) => {
    setExpandedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
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
      {/* Hero */}
      <section className="product-surface px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-system-orange/15 text-amber-700 dark:text-system-orange">
              <Cake className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="section-eyebrow">Celebrations</p>
              <h2 className="text-title-2 font-semibold text-label">{t('birthdays.title')}</h2>
              <p className="mt-0.5 text-subheadline text-secondary-label">
                {t('birthdays.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="btn-secondary btn-sm focus-ring self-start sm:self-auto"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={Cake} label="Today" value={data.stats.today || 0} variant="primary" />
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
      <div className="tab-pills w-fit">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`tab-pill ${filter === f.id ? 'active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-system-fill" />
          ))}
        </div>
      ) : data.members.length === 0 ? (
        <EmptyState
          icon={Cake}
          title={filter === 'thisWeek' ? 'No birthdays this week 🎉' : 'No birthdays found'}
          description={
            filter === 'thisWeek'
              ? 'Check next month to plan ahead or invite more members.'
              : 'Try expanding your filter to see more upcoming birthdays.'
          }
          action={
            filter === 'thisWeek'
              ? {
                  label: 'View Next 30 Days',
                  onClick: () => setFilter('next30Days')
                }
              : null
          }
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([groupKey, members]) => (
            <div key={groupKey} className="space-y-4">
              {filter === 'fullYear' ? (
                <button
                  onClick={() => toggleMonth(groupKey)}
                  className="focus-ring flex w-full items-center gap-3 rounded-lg text-left group"
                >
                  <div
                    className={`rounded-lg p-1 transition-colors ${
                      expandedMonths[groupKey]
                        ? 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
                        : 'bg-system-fill text-secondary-label'
                    }`}
                  >
                    {expandedMonths[groupKey] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                  <h3 className="text-title-3 font-semibold text-label">{groupKey}</h3>
                  <div className="h-px flex-1 bg-separator/60 dark:bg-white/[0.08]"></div>
                  <span className="text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label tabular-nums">
                    {members.length} birthdays
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <h3
                    className={`text-footnote font-semibold uppercase tracking-[0.06em] ${
                      groupKey === today
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-secondary-label'
                    }`}
                  >
                    {fdate(groupKey)}
                    {groupKey === today && (
                      <span className="ml-2 rounded-full bg-primary-500/[0.12] px-2 py-0.5 text-caption-1 font-semibold text-primary-700 dark:text-primary-300">
                        Today
                      </span>
                    )}
                  </h3>
                  <div className="h-px flex-1 bg-separator/60 dark:bg-white/[0.08]"></div>
                </div>
              )}

              {(filter !== 'fullYear' || expandedMonths[groupKey]) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className={`card group p-5 transition-shadow hover:shadow-card-hover ${
                        member.is_today ? 'ring-1 ring-primary-500/30' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-system-orange/15 text-amber-700 dark:text-system-orange">
                          <Cake className="h-5 w-5" />
                        </div>
                        {member.age && (
                          <Badge variant="success" className="text-xs">
                            Turns {member.age}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 mb-6">
                        <h4 className="text-subheadline font-semibold text-label">{member.name}</h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="ghost" className="text-[10px] py-0">
                            {member.section}
                          </Badge>
                          <span className="text-caption-1 font-medium text-secondary-label">
                            Under {member.leader}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-separator/60 pt-3 dark:border-white/[0.08]">
                        <a
                          href={`mailto:${member.email || ''}`}
                          className="btn-secondary btn-sm flex-1 justify-center focus-ring"
                          title="Send Message"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span className="text-xs">Message</span>
                        </a>
                        <button
                          onClick={() => addToCalendar(member)}
                          className="btn-secondary btn-sm flex-1 justify-center focus-ring"
                          title="Add to Calendar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span className="text-xs">Remind</span>
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
