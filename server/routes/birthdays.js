const express = require('express');
const { queries, all, db } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { addDays, formatLocalDate, getWeekStartDate, parseDateInput, startOfLocalDay } = require('../utils/date');
const { escapeCsvValue, toCsvRow } = require('../utils/csv');

const router = express.Router();

// Restrict to Admin and Pastor roles
router.use(isAuthenticated);
router.use(requireRole(['admin', 'pastor']));

/**
 * GET /api/birthdays
 * Query params: filter (thisWeek, next7Days, thisMonth, next30Days, fullYear, custom), start_date, end_date
 */
router.get('/', async (req, res) => {
  try {
    const { filter = 'thisWeek', start_date, end_date } = req.query;
    
    // Fetch all future birthdays (respecting privacy in the query)
    const allBirthdays = await queries.getUpcomingBirthdays();
    
    const now = startOfLocalDay(new Date());
    
    const getRange = () => {
      const start = new Date(now);
      const end = new Date(now);
      
      switch (filter) {
        case 'thisWeek':
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
          start.setDate(diff);
          end.setDate(start.getDate() + 6);
          break;
        case 'next7Days':
          end.setDate(start.getDate() + 7);
          break;
        case 'thisMonth':
          start.setDate(1);
          end.setMonth(start.getMonth() + 1);
          end.setDate(0);
          break;
        case 'next30Days':
          end.setDate(start.getDate() + 30);
          break;
        case 'custom':
          if (start_date && end_date) {
            return {
              customStart: startOfLocalDay(parseDateInput(start_date)),
              customEnd: startOfLocalDay(parseDateInput(end_date))
            };
          }
          break;
        case 'fullYear':
          return { fullYear: true };
      }
      return { start, end };
    };

    const range = getRange();
    
    const filtered = allBirthdays.filter(m => {
      if (range.fullYear) return true;
      
      const dob = new Date(m.date_of_birth);
      // Create a date for this year's birthday
      const thisYearBirthday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      
      if (range.customStart && range.customEnd) {
         return thisYearBirthday >= range.customStart && thisYearBirthday <= range.customEnd;
      }
      
      return thisYearBirthday >= range.start && thisYearBirthday <= range.end;
    });

    // Formatting results
    const results = filtered.map(m => {
      const dob = new Date(m.date_of_birth);
      const today = new Date();
      let age = null;
      if (m.show_age_to_leaders) {
        age = today.getFullYear() - dob.getFullYear();
        const m_diff = today.getMonth() - dob.getMonth();
        if (m_diff < 0 || (m_diff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
      }

      return {
        id: m.id,
        name: m.full_name,
        date_of_birth: m.date_of_birth,
        month_day: `${dob.getMonth() + 1}-${dob.getDate()}`,
        age: age,
        section: m.section_name,
        leader: m.leader_name,
        phone: m.phone,
        is_today: (dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate())
      };
    });

    // Stats
    const stats = {
      today: allBirthdays.filter(m => {
        const d = new Date(m.date_of_birth);
        return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      }).length,
      thisWeek: allBirthdays.filter(m => {
        const d = new Date(m.date_of_birth);
        const bday = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        const start = getWeekStartDate(now);
        const end = addDays(start, 6);
        return bday >= start && bday <= end;
      }).length,
      thisMonth: allBirthdays.filter(m => {
        const d = new Date(m.date_of_birth);
        return d.getMonth() === now.getMonth();
      }).length
    };

    res.json({
      members: results,
      stats,
      filter
    });
  } catch (error) {
    console.error('Birthdays route error:', error);
    res.status(500).json({ error: 'Failed to fetch birthday data' });
  }
});

// GET export
router.get('/export', async (req, res) => {
   try {
     const allBirthdays = await queries.getUpcomingBirthdays();
     const headers = ['Name', 'Date of Birth', 'Section', 'Leader', 'Phone'];
     const csvRows = [headers.map(escapeCsvValue).join(',')];
     allBirthdays.forEach(m => {
       csvRows.push(toCsvRow([m.full_name, m.date_of_birth, m.section_name, m.leader_name, m.phone || '']));
     });
     res.setHeader('Content-Type', 'text/csv');
     res.setHeader('Content-Disposition', `attachment; filename="birthdays_${formatLocalDate()}.csv"`);
     res.send(csvRows.join('\n'));
   } catch (error) {
     res.status(500).json({ error: 'Failed to export birthdays' });
   }
});

module.exports = router;
