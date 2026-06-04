const express = require('express');
const { queries, run, get, all, transaction } = require('../database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.use(requireRole(['admin']));

const parseLeaderIds = (value) => Array.isArray(value)
  ? value.map((id) => Number(id)).filter((id) => Number.isInteger(id))
  : [];

const normalizePersonKey = (name, phone = '') => {
  const normalizedName = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  return `${normalizedName}|${normalizedPhone}`;
};

router.get('/home-cells', async (req, res) => {
  try {
    const cells = await all(`
      SELECT hc.*, COALESCE(COUNT(DISTINCT hcm.id), 0) AS member_count
      FROM home_cells hc
      LEFT JOIN home_cell_members hcm ON hcm.cell_id = hc.id AND hcm.is_active = 1
      WHERE hc.is_active = 1
      GROUP BY hc.id, hc.name, hc.cell_number, hc.is_active, hc.created_at
      ORDER BY hc.cell_number
    `);

    const leaders = await all(`
      SELECT hcl.cell_id, l.id AS leader_id, u.full_name, s.name AS section_name
      FROM home_cell_leaders hcl
      JOIN leaders l ON l.id = hcl.leader_id
      JOIN users u ON u.id = l.user_id
      JOIN sections s ON s.id = l.section_id
      WHERE l.is_active = 1
      ORDER BY u.full_name
    `);

    const members = await all(`
      SELECT
        hcm.*,
        hc.name AS cell_name,
        m.membership_id AS church_membership_id,
        s.name AS church_section_name,
        u.full_name AS church_leader_name
      FROM home_cell_members hcm
      JOIN home_cells hc ON hc.id = hcm.cell_id
      LEFT JOIN members m ON m.id = hcm.church_member_id
      LEFT JOIN sections s ON s.id = m.section_id
      LEFT JOIN leaders l ON l.id = m.leader_id
      LEFT JOIN users u ON u.id = l.user_id
      WHERE hcm.is_active = 1
      ORDER BY hc.cell_number, hcm.full_name
    `);

    res.json(cells.map((cell) => ({
      ...cell,
      leaders: leaders.filter((leader) => Number(leader.cell_id) === Number(cell.id)),
      members: members.filter((member) => Number(member.cell_id) === Number(cell.id))
    })));
  } catch (error) {
    console.error('Fetch home cells error:', error);
    res.status(500).json({ error: 'Failed to fetch home cells' });
  }
});

router.post('/home-cells', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Home cell name is required' });
    }

    const nextNumberRow = await get('SELECT COALESCE(MAX(cell_number), 0) + 1 AS next_number FROM home_cells');
    const cellNumber = Number(req.body.cell_number) || Number(nextNumberRow?.next_number || 1);
    const existing = await get(
      'SELECT id FROM home_cells WHERE LOWER(name) = LOWER(?) OR cell_number = ?',
      [name, cellNumber]
    );
    if (existing) {
      return res.status(400).json({ error: 'A home cell with that name or number already exists' });
    }

    const result = await run(
      'INSERT INTO home_cells (name, cell_number, is_active) VALUES (?, ?, 1)',
      [name, cellNumber]
    );
    res.status(201).json({ id: result.lastID, message: 'Home cell created' });
  } catch (error) {
    console.error('Create home cell error:', error);
    res.status(500).json({ error: 'Failed to create home cell' });
  }
});

router.put('/home-cells/:id/leaders', async (req, res) => {
  try {
    const cellId = Number(req.params.id);
    const leaderIds = parseLeaderIds(req.body.leader_ids);
    if (!Number.isInteger(cellId)) {
      return res.status(400).json({ error: 'Invalid home cell' });
    }

    const cell = await get('SELECT id FROM home_cells WHERE id = ? AND is_active = 1', [cellId]);
    if (!cell) {
      return res.status(404).json({ error: 'Home cell not found' });
    }

    const validLeaderIds = [];
    for (const leaderId of leaderIds) {
      const leader = await get('SELECT id FROM leaders WHERE id = ? AND is_active = 1', [leaderId]);
      if (leader) validLeaderIds.push(leaderId);
    }

    await transaction(async (tx) => {
      await tx.run('DELETE FROM home_cell_leaders WHERE cell_id = ?', [cellId]);
      for (const leaderId of validLeaderIds) {
        await tx.run('INSERT INTO home_cell_leaders (cell_id, leader_id) VALUES (?, ?)', [cellId, leaderId]);
      }
    });

    res.json({ message: 'Home cell leaders updated' });
  } catch (error) {
    console.error('Update home cell leaders error:', error);
    res.status(500).json({ error: 'Failed to update home cell leaders' });
  }
});

router.post('/home-cell-members', async (req, res) => {
  try {
    const cellId = Number(req.body.cell_id);
    const churchMembershipId = String(req.body.membership_id || '').trim();
    let fullName = String(req.body.full_name || '').trim();
    const phone = req.body.phone || null;

    if (!Number.isInteger(cellId)) {
      return res.status(400).json({ error: 'Home cell is required' });
    }

    const cell = await get('SELECT id FROM home_cells WHERE id = ? AND is_active = 1', [cellId]);
    if (!cell) {
      return res.status(404).json({ error: 'Home cell not found' });
    }

    let churchMember = null;
    if (churchMembershipId) {
      churchMember = await queries.getMemberByMembershipId(churchMembershipId);
      if (!churchMember) {
        return res.status(400).json({ error: 'Church member ID was not found' });
      }
      fullName = fullName || churchMember.full_name;
    }

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const duplicateKey = churchMember
      ? `member:${churchMember.id}`
      : `person:${normalizePersonKey(fullName, phone)}`;

    const duplicate = await get(`
      SELECT id, full_name
      FROM home_cell_members
      WHERE is_active = 1
        AND (duplicate_key = ? OR (? IS NOT NULL AND church_member_id = ?))
    `, [duplicateKey, churchMember?.id || null, churchMember?.id || null]);
    if (duplicate) {
      return res.status(400).json({ error: `${duplicate.full_name} is already registered in a home cell` });
    }

    await run(`
      INSERT INTO home_cell_members
        (cell_id, church_member_id, full_name, phone, email, address, duplicate_key, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cellId,
      churchMember?.id || null,
      fullName,
      phone || churchMember?.phone || null,
      req.body.email || churchMember?.email || null,
      req.body.address || churchMember?.address || null,
      duplicateKey,
      req.session.userId
    ]);

    res.status(201).json({ message: 'Home cell member assigned' });
  } catch (error) {
    console.error('Create admin home cell member error:', error);
    res.status(500).json({ error: 'Failed to assign home cell member' });
  }
});

router.delete('/home-cell-members/:id', async (req, res) => {
  try {
    await run('UPDATE home_cell_members SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ message: 'Home cell member removed' });
  } catch (error) {
    console.error('Remove admin home cell member error:', error);
    res.status(500).json({ error: 'Failed to remove home cell member' });
  }
});

module.exports = router;
