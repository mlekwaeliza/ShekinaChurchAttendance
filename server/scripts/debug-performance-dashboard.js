const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { query, close } = require('../db/postgres');
const { all, get } = require('../database');

const endDate = new Date().toISOString().slice(0, 10);
const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const checks = [
  ['members', "SELECT m.id, m.full_name, m.gender, m.age_group, m.section_id, s.name as section_name, m.leader_id, u.full_name as leader_name FROM members m LEFT JOIN sections s ON m.section_id = s.id LEFT JOIN leaders l ON m.leader_id = l.id LEFT JOIN users u ON l.user_id = u.id WHERE m.is_active = 1", []],
  ['leaders', 'SELECT l.id, u.full_name as leader_name, l.section_id, s.name as section_name FROM leaders l JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id', []],
  ['home_cells', 'SELECT id, name, cell_number FROM home_cells WHERE is_active = 1', []],
  ['home_cell_members', 'SELECT cell_id, church_member_id FROM home_cell_members WHERE is_active = 1', []],
  ['department_members', 'SELECT department_id, member_id FROM department_members', []],
  ['attendance', 'SELECT member_id, status FROM attendance WHERE date >= $1 AND date <= $2', [startDate, endDate]],
  ['contributions', 'SELECT member_id, amount FROM contributions WHERE payment_date >= $1 AND payment_date <= $2', [startDate, endDate]],
  ['outreach_logs', 'SELECT member_id, leader_id FROM outreach_logs WHERE created_at >= $1 AND created_at <= $2', [`${startDate} 00:00:00`, `${endDate} 23:59:59`]],
  ['visitor_intake', 'SELECT created_by, status FROM visitor_intake WHERE created_at >= $1 AND created_at <= $2', [`${startDate} 00:00:00`, `${endDate} 23:59:59`]],
  ['absent_followups', 'SELECT member_id, leader_id, contacted FROM absent_followups WHERE created_at >= $1 AND created_at <= $2', [`${startDate} 00:00:00`, `${endDate} 23:59:59`]],
  ['submission_log', 'SELECT leader_id, date FROM submission_log WHERE date >= $1 AND date <= $2', [startDate, endDate]],
  ['departments', 'SELECT id, name FROM departments', []]
];

async function main() {
  const settings = await all('SELECT key, value FROM settings');
  const serviceDays = await get('SELECT COUNT(DISTINCT date) as count FROM submission_log WHERE date >= ? AND date <= ?', [startDate, endDate]);
  console.log(`runtime helpers: settings=${settings.length}, serviceDays=${serviceDays?.count || 0}`);
  for (const [name, sql, params] of checks) {
    try {
      const result = await query(sql, params);
      console.log(`${name}: ok (${result.rowCount})`);
    } catch (error) {
      console.error(`${name}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

main().finally(close);
