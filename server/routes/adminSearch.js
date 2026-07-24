const express = require('express');
const { queries, all, get } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { withCache, withTimeout } = require('../utils/cache');

const router = express.Router();
router.use(isAuthenticated);
router.use(requireRole(['admin']));

const search = async (table, query, columns, extraJoins = '', extraWhere = '') => {
  const q = `%${query}%`;
  const conditions = columns.map(c => `${c} ILIKE ?`).join(' OR ');
  const params = columns.map(() => q);
  let sql = `SELECT * FROM ${table} WHERE (${conditions}) ${extraWhere} ORDER BY 1 LIMIT 10`;
  if (extraJoins) sql = sql.replace('SELECT *', `SELECT ${table}.*`);
  return all(sql, params);
};

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ results: [] });

    const [members, leaders, sections, homeCells, departments] = await withTimeout(Promise.allSettled([
      withCache(`search-members:${q}`, 30000, () =>
        all(`SELECT id, full_name, membership_id, phone, email, 'member' as type
             FROM members WHERE is_active = 1 AND soft_deleted_at IS NULL
             AND (full_name ILIKE ? OR membership_id ILIKE ? OR phone ILIKE ? OR email ILIKE ?)
             ORDER BY full_name LIMIT 10`, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`])
      ),
      withCache(`search-leaders:${q}`, 30000, () =>
        all(`SELECT l.id, u.full_name, s.name as section_name, 'leader' as type
             FROM leaders l JOIN users u ON l.user_id = u.id
             LEFT JOIN sections s ON s.id = l.section_id
             WHERE l.is_active = 1
             AND (u.full_name ILIKE ? OR u.username ILIKE ?)
             ORDER BY u.full_name LIMIT 10`, [`%${q}%`, `%${q}%`])
      ),
      withCache(`search-sections:${q}`, 30000, () =>
        all(`SELECT id, name, 'section' as type FROM sections
             WHERE name ILIKE ? ORDER BY name LIMIT 5`, [`%${q}%`])
      ),
      withCache(`search-homecells:${q}`, 30000, () =>
        all(`SELECT id, name, cell_number, 'home_cell' as type FROM home_cells
             WHERE is_active = 1 AND (name ILIKE ? OR CAST(cell_number AS TEXT) ILIKE ?)
             ORDER BY cell_number LIMIT 5`, [`%${q}%`, `%${q}%`])
      ),
      withCache(`search-departments:${q}`, 30000, () =>
        all(`SELECT id, name, 'department' as type FROM departments
             WHERE is_active = 1 AND name ILIKE ? ORDER BY name LIMIT 5`, [`%${q}%`])
      ),
    ]), 15000, 'Search queries timed out');

    const results = [
      ...(members.status === 'fulfilled' ? members.value : []),
      ...(leaders.status === 'fulfilled' ? leaders.value : []),
      ...(sections.status === 'fulfilled' ? sections.value : []),
      ...(homeCells.status === 'fulfilled' ? homeCells.value : []),
      ...(departments.status === 'fulfilled' ? departments.value : []),
    ];

    res.json({ results, query: q });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;