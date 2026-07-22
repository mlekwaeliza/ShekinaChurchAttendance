const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database');
const { logAudit } = require('../utils');

// ─── Classes ────────────────────────────────────────────────────────────────────

router.get('/classes', async (req, res) => {
  try {
    const classes = await all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM children_class_assignments WHERE class_id = c.id) as enrolled_count,
        (SELECT full_name FROM children_teachers ct 
         JOIN children_teacher_assignments cta ON ct.id = cta.teacher_id 
         WHERE cta.class_id = c.id AND ct.is_active = 1 LIMIT 1) as teacher_name
      FROM children_classes c
      WHERE c.is_active = 1
      ORDER BY c.age_group, c.name
    `);
    res.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/classes', async (req, res) => {
  try {
    const { name, age_group, description, max_capacity, room_number, schedule } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required' });

    const result = await run(
      'INSERT INTO children_classes (name, age_group, description, max_capacity, room_number, schedule) VALUES (?, ?, ?, ?, ?, ?)',
      [name, age_group || null, description || null, max_capacity || null, room_number || null, schedule || null]
    );
    logAudit(req.user?.id, 'children_class_create', 'children_classes', result.lastID, { name });
    res.status(201).json({ id: result.lastID, message: 'Class created' });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.put('/classes/:id', async (req, res) => {
  try {
    const { name, age_group, description, max_capacity, room_number, schedule, is_active } = req.body;
    await run(
      'UPDATE children_classes SET name = COALESCE(?, name), age_group = COALESCE(?, age_group), description = COALESCE(?, description), max_capacity = COALESCE(?, max_capacity), room_number = COALESCE(?, room_number), schedule = COALESCE(?, schedule), is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, age_group, description, max_capacity, room_number, schedule, is_active, req.params.id]
    );
    logAudit(req.user?.id, 'children_class_update', 'children_classes', req.params.id, { name });
    res.json({ message: 'Class updated' });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

router.delete('/classes/:id', async (req, res) => {
  try {
    await run('UPDATE children_classes SET is_active = 0 WHERE id = ?', [req.params.id]);
    logAudit(req.user?.id, 'children_class_delete', 'children_classes', req.params.id);
    res.json({ message: 'Class deactivated' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// ─── Teachers ────────────────────────────────────────────────────────────────────

router.get('/teachers', async (req, res) => {
  try {
    const teachers = await all(`
      SELECT ct.*,
        (SELECT string_agg(cc.name, ', ') FROM children_classes cc 
         JOIN children_teacher_assignments cta ON cc.id = cta.class_id 
         WHERE cta.teacher_id = ct.id) as assigned_classes
      FROM children_teachers ct
      WHERE ct.is_active = 1
      ORDER BY ct.full_name
    `);
    res.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

router.post('/teachers', async (req, res) => {
  try {
    const { member_id, user_id, full_name, phone, email, qualification, background_check, class_ids } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Teacher name is required' });

    const result = await run(
      'INSERT INTO children_teachers (member_id, user_id, full_name, phone, email, qualification, background_check) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [member_id || null, user_id || null, full_name, phone || null, email || null, qualification || null, background_check ? 1 : 0]
    );

    if (class_ids && class_ids.length > 0) {
      for (const classId of class_ids) {
        await run(
          'INSERT OR IGNORE INTO children_teacher_assignments (teacher_id, class_id) VALUES (?, ?)',
          [result.lastID, classId]
        );
      }
    }

    logAudit(req.user?.id, 'children_teacher_create', 'children_teachers', result.lastID, { full_name });
    res.status(201).json({ id: result.lastID, message: 'Teacher created' });
  } catch (error) {
    console.error('Error creating teacher:', error);
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

router.put('/teachers/:id', async (req, res) => {
  try {
    const { full_name, phone, email, qualification, background_check, is_active, class_ids } = req.body;
    await run(
      'UPDATE children_teachers SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), email = COALESCE(?, email), qualification = COALESCE(?, qualification), background_check = COALESCE(?, background_check), is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [full_name, phone, email, qualification, background_check, is_active, req.params.id]
    );

    if (class_ids !== undefined) {
      await run('DELETE FROM children_teacher_assignments WHERE teacher_id = ?', [req.params.id]);
      if (class_ids.length > 0) {
        for (const classId of class_ids) {
          await run(
            'INSERT OR IGNORE INTO children_teacher_assignments (teacher_id, class_id) VALUES (?, ?)',
            [req.params.id, classId]
          );
        }
      }
    }

    logAudit(req.user?.id, 'children_teacher_update', 'children_teachers', req.params.id, { full_name });
    res.json({ message: 'Teacher updated' });
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

router.delete('/teachers/:id', async (req, res) => {
  try {
    await run('UPDATE children_teachers SET is_active = 0 WHERE id = ?', [req.params.id]);
    logAudit(req.user?.id, 'children_teacher_delete', 'children_teachers', req.params.id);
    res.json({ message: 'Teacher deactivated' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// ─── Children ────────────────────────────────────────────────────────────────────

router.get('/children', async (req, res) => {
  try {
    const { class_id, age_group, search } = req.query;
    let query = `
      SELECT ch.*,
        cc.name as class_name,
        (SELECT string_agg(ct.full_name, ', ') FROM children_teachers ct 
         JOIN children_teacher_assignments cta ON ct.id = cta.teacher_id 
         WHERE cta.class_id = ch.class_id AND ct.is_active = 1) as class_teachers
      FROM children ch
      LEFT JOIN children_classes cc ON ch.class_id = cc.id
      WHERE ch.is_active = 1
    `;
    const params = [];

    if (class_id) {
      query += ' AND ch.class_id = ?';
      params.push(class_id);
    }
    if (age_group) {
      query += ' AND ch.age_group = ?';
      params.push(age_group);
    }
    if (search) {
      query += ' AND (ch.full_name LIKE ? OR ch.parent_guardian_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY ch.full_name';
    const children = await all(query, params);
    res.json(children);
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

router.post('/children', async (req, res) => {
  try {
    const { full_name, date_of_birth, gender, parent_guardian_name, parent_guardian_phone, parent_guardian_email, emergency_contact, emergency_phone, medical_notes, allergies, class_id, age_group, photo_consent } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Child name is required' });

    const result = await run(
      `INSERT INTO children (full_name, date_of_birth, gender, parent_guardian_name, parent_guardian_phone, parent_guardian_email, emergency_contact, emergency_phone, medical_notes, allergies, class_id, age_group, photo_consent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, date_of_birth || null, gender || null, parent_guardian_name || null, parent_guardian_phone || null, parent_guardian_email || null, emergency_contact || null, emergency_phone || null, medical_notes || null, allergies || null, class_id || null, age_group || null, photo_consent ? 1 : 0]
    );

    if (class_id) {
      await run('INSERT OR IGNORE INTO children_class_assignments (child_id, class_id) VALUES (?, ?)', [result.lastID, class_id]);
    }

    logAudit(req.user?.id, 'children_create', 'children', result.lastID, { full_name });
    res.status(201).json({ id: result.lastID, message: 'Child registered' });
  } catch (error) {
    console.error('Error creating child:', error);
    res.status(500).json({ error: 'Failed to register child' });
  }
});

router.put('/children/:id', async (req, res) => {
  try {
    const { full_name, date_of_birth, gender, parent_guardian_name, parent_guardian_phone, parent_guardian_email, emergency_contact, emergency_phone, medical_notes, allergies, class_id, age_group, photo_consent, is_active } = req.body;
    await run(
      `UPDATE children SET full_name = COALESCE(?, full_name), date_of_birth = COALESCE(?, date_of_birth), gender = COALESCE(?, gender), parent_guardian_name = COALESCE(?, parent_guardian_name), parent_guardian_phone = COALESCE(?, parent_guardian_phone), parent_guardian_email = COALESCE(?, parent_guardian_email), emergency_contact = COALESCE(?, emergency_contact), emergency_phone = COALESCE(?, emergency_phone), medical_notes = COALESCE(?, medical_notes), allergies = COALESCE(?, allergies), class_id = COALESCE(?, class_id), age_group = COALESCE(?, age_group), photo_consent = COALESCE(?, photo_consent), is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [full_name, date_of_birth, gender, parent_guardian_name, parent_guardian_phone, parent_guardian_email, emergency_contact, emergency_phone, medical_notes, allergies, class_id, age_group, photo_consent, is_active, req.params.id]
    );

    if (class_id) {
      await run('DELETE FROM children_class_assignments WHERE child_id = ?', [req.params.id]);
      await run('INSERT OR IGNORE INTO children_class_assignments (child_id, class_id) VALUES (?, ?)', [req.params.id, class_id]);
    }

    logAudit(req.user?.id, 'children_update', 'children', req.params.id, { full_name });
    res.json({ message: 'Child updated' });
  } catch (error) {
    console.error('Error updating child:', error);
    res.status(500).json({ error: 'Failed to update child' });
  }
});

router.delete('/children/:id', async (req, res) => {
  try {
    await run('UPDATE children SET is_active = 0 WHERE id = ?', [req.params.id]);
    logAudit(req.user?.id, 'children_delete', 'children', req.params.id);
    res.json({ message: 'Child deactivated' });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ error: 'Failed to delete child' });
  }
});

// ─── Attendance ────────────────────────────────────────────────────────────────────

router.get('/attendance', async (req, res) => {
  try {
    const { class_id, date, start_date, end_date } = req.query;
    let query = `
      SELECT ca.*, ch.full_name as child_name, cc.name as class_name
      FROM children_attendance ca
      JOIN children ch ON ca.child_id = ch.id
      JOIN children_classes cc ON ca.class_id = cc.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      query += ' AND ca.class_id = ?';
      params.push(class_id);
    }
    if (date) {
      query += ' AND ca.date = ?';
      params.push(date);
    }
    if (start_date && end_date) {
      query += ' AND ca.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY ca.date DESC, ch.full_name';
    const attendance = await all(query, params);
    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.post('/attendance', async (req, res) => {
  try {
    const { child_id, class_id, date, status, notes } = req.body;
    if (!child_id || !class_id || !date) return res.status(400).json({ error: 'Child, class, and date are required' });

    const result = await run(
      `INSERT INTO children_attendance (child_id, class_id, date, status, notes, checked_in_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(child_id, class_id, date) DO UPDATE SET status = ?, notes = ?, checked_in_by = ?`,
      [child_id, class_id, date, status || 'present', notes || null, req.user?.id, status || 'present', notes || null, req.user?.id]
    );

    res.status(201).json({ id: result.lastID, message: 'Attendance recorded' });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

router.post('/attendance/bulk', async (req, res) => {
  try {
    const { class_id, date, records } = req.body;
    if (!class_id || !date || !records) return res.status(400).json({ error: 'Class, date, and records are required' });

    for (const record of records) {
      await run(
        `INSERT INTO children_attendance (child_id, class_id, date, status, notes, checked_in_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(child_id, class_id, date) DO UPDATE SET status = ?, notes = ?, checked_in_by = ?`,
        [record.child_id, class_id, date, record.status || 'present', record.notes || null, req.user?.id, record.status || 'present', record.notes || null, req.user?.id]
      );
    }

    res.status(201).json({ message: 'Attendance recorded for ' + records.length + ' children' });
  } catch (error) {
    console.error('Error recording bulk attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// ─── Promotions ────────────────────────────────────────────────────────────────────

router.get('/promotions', async (req, res) => {
  try {
    const promotions = await all(`
      SELECT cp.*, ch.full_name as child_name, 
        fc.name as from_class_name, tc.name as to_class_name
      FROM children_promotions cp
      JOIN children ch ON cp.child_id = ch.id
      LEFT JOIN children_classes fc ON cp.from_class_id = fc.id
      JOIN children_classes tc ON cp.to_class_id = tc.id
      ORDER BY cp.promotion_date DESC
    `);
    res.json(promotions);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

router.post('/promotions', async (req, res) => {
  try {
    const { child_id, from_class_id, to_class_id, promotion_date, notes } = req.body;
    if (!child_id || !to_class_id || !promotion_date) return res.status(400).json({ error: 'Child, new class, and date are required' });

    const result = await run(
      'INSERT INTO children_promotions (child_id, from_class_id, to_class_id, promotion_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [child_id, from_class_id || null, to_class_id, promotion_date, notes || null, req.user?.id]
    );

    await run('UPDATE children SET class_id = ?, age_group = (SELECT age_group FROM children_classes WHERE id = ?) WHERE id = ?', [to_class_id, to_class_id, child_id]);
    await run('DELETE FROM children_class_assignments WHERE child_id = ?', [child_id]);
    await run('INSERT OR IGNORE INTO children_class_assignments (child_id, class_id) VALUES (?, ?)', [child_id, to_class_id]);

    logAudit(req.user?.id, 'children_promotion', 'children_promotions', result.lastID, { child_id, to_class_id });
    res.status(201).json({ id: result.lastID, message: 'Child promoted' });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ error: 'Failed to record promotion' });
  }
});

// ─── Dashboard Stats ────────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const totalChildren = await get('SELECT COUNT(*) as count FROM children WHERE is_active = 1');
    const totalClasses = await get('SELECT COUNT(*) as count FROM children_classes WHERE is_active = 1');
    const totalTeachers = await get('SELECT COUNT(*) as count FROM children_teachers WHERE is_active = 1');

    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = await get(
      'SELECT COUNT(*) as count FROM children_attendance WHERE date = ? AND status = ?',
      [today, 'present']
    );

    const recentPromotions = await all(`
      SELECT cp.*, ch.full_name as child_name, tc.name as new_class
      FROM children_promotions cp
      JOIN children ch ON cp.child_id = ch.id
      JOIN children_classes tc ON cp.to_class_id = tc.id
      ORDER BY cp.promotion_date DESC LIMIT 5
    `);

    const attendanceByClass = await all(`
      SELECT cc.name, 
        COUNT(CASE WHEN ca.status = 'present' THEN 1 END) as present_count,
        COUNT(*) as total_records
      FROM children_attendance ca
      JOIN children_classes cc ON ca.class_id = cc.id
      WHERE ca.date >= DATE('now', '-30 days')
      GROUP BY cc.id, cc.name
    `);

    const medicalAlerts = await all(`
      SELECT full_name, medical_notes, allergies 
      FROM children 
      WHERE is_active = 1 AND (medical_notes IS NOT NULL AND medical_notes != '') OR (allergies IS NOT NULL AND allergies != '')
    `);

    res.json({
      totalChildren: totalChildren?.count || 0,
      totalClasses: totalClasses?.count || 0,
      totalTeachers: totalTeachers?.count || 0,
      todayAttendance: todayAttendance?.count || 0,
      recentPromotions,
      attendanceByClass,
      medicalAlerts
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

module.exports = router;
