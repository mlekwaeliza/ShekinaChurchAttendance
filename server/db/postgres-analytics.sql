BEGIN;

CREATE OR REPLACE VIEW attendance_report_view AS
SELECT
  a.id AS attendance_id,
  a.date AS attendance_date,
  a.status,
  a.submitted_at,
  a.service_type_id,
  COALESCE(st.name, a.service_type, 'Main Service') AS service_name,
  m.id AS member_id,
  m.membership_id,
  m.full_name AS member_name,
  m.gender,
  m.age_group,
  m.status AS member_status,
  m.is_active AS member_is_active,
  s.id AS section_id,
  s.name AS section_name,
  l.id AS leader_id,
  leader_user.full_name AS leader_name,
  submitter.id AS submitted_by_user_id,
  submitter.full_name AS submitted_by_name
FROM attendance a
JOIN members m ON m.id = a.member_id
JOIN sections s ON s.id = m.section_id
JOIN leaders l ON l.id = m.leader_id
JOIN users leader_user ON leader_user.id = l.user_id
JOIN users submitter ON submitter.id = a.submitted_by
LEFT JOIN service_types st ON st.id = a.service_type_id;

CREATE OR REPLACE VIEW member_directory_view AS
SELECT
  m.id,
  m.membership_id,
  m.full_name,
  m.phone,
  m.email,
  m.gender,
  m.date_of_birth,
  m.age_group,
  m.status,
  m.flags,
  m.prayer_requests,
  m.hall_of_fame_points,
  m.is_active,
  s.id AS section_id,
  s.name AS section_name,
  l.id AS leader_id,
  u.full_name AS leader_name,
  latest.last_attendance_date,
  latest.last_attendance_status,
  m.created_at,
  m.updated_at
FROM members m
JOIN sections s ON s.id = m.section_id
JOIN leaders l ON l.id = m.leader_id
JOIN users u ON u.id = l.user_id
LEFT JOIN LATERAL (
  SELECT a.date AS last_attendance_date, a.status AS last_attendance_status
  FROM attendance a
  WHERE a.member_id = m.id
  ORDER BY a.date DESC, a.submitted_at DESC
  LIMIT 1
) latest ON true;

CREATE MATERIALIZED VIEW IF NOT EXISTS attendance_daily_summary AS
SELECT
  a.date AS attendance_date,
  a.service_type_id,
  COALESCE(st.name, a.service_type, 'Main Service') AS service_name,
  s.id AS section_id,
  s.name AS section_name,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
  COUNT(*) FILTER (WHERE a.status = 'excused') AS excused_count,
  ROUND((COUNT(*) FILTER (WHERE a.status = 'present')::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS present_rate
FROM attendance a
JOIN members m ON m.id = a.member_id
JOIN sections s ON s.id = m.section_id
LEFT JOIN service_types st ON st.id = a.service_type_id
GROUP BY a.date, a.service_type_id, COALESCE(st.name, a.service_type, 'Main Service'), s.id, s.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_daily_summary_unique
  ON attendance_daily_summary(attendance_date, service_type_id, section_id);

CREATE INDEX IF NOT EXISTS idx_attendance_daily_summary_date
  ON attendance_daily_summary(attendance_date DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS leader_performance_summary AS
SELECT
  l.id AS leader_id,
  u.id AS user_id,
  u.full_name AS leader_name,
  s.id AS section_id,
  s.name AS section_name,
  COUNT(DISTINCT m.id) FILTER (WHERE m.is_active = 1) AS active_members,
  COUNT(a.id) AS total_attendance_records,
  COUNT(a.id) FILTER (WHERE a.status = 'present') AS present_records,
  COUNT(a.id) FILTER (WHERE a.status = 'absent') AS absent_records,
  COUNT(a.id) FILTER (WHERE a.status = 'excused') AS excused_records,
  COUNT(DISTINCT sl.id) AS submission_count,
  MAX(sl.created_at) AS last_submission_at,
  ROUND((COUNT(a.id) FILTER (WHERE a.status = 'present')::numeric / NULLIF(COUNT(a.id), 0)) * 100, 2) AS present_rate,
  COALESCE(SUM(m.hall_of_fame_points), 0) AS section_points
FROM leaders l
JOIN users u ON u.id = l.user_id
JOIN sections s ON s.id = l.section_id
LEFT JOIN members m ON m.leader_id = l.id
LEFT JOIN attendance a ON a.member_id = m.id
LEFT JOIN submission_log sl ON sl.leader_id = l.id
GROUP BY l.id, u.id, u.full_name, s.id, s.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leader_performance_summary_leader
  ON leader_performance_summary(leader_id);

CREATE INDEX IF NOT EXISTS idx_leader_performance_summary_rate
  ON leader_performance_summary(present_rate DESC NULLS LAST);

CREATE MATERIALIZED VIEW IF NOT EXISTS member_engagement_summary AS
SELECT
  m.id AS member_id,
  m.membership_id,
  m.full_name,
  m.section_id,
  s.name AS section_name,
  m.leader_id,
  u.full_name AS leader_name,
  m.status AS member_status,
  m.hall_of_fame_points,
  COUNT(a.id) FILTER (WHERE a.date >= CURRENT_DATE - INTERVAL '90 days') AS records_90d,
  COUNT(a.id) FILTER (WHERE a.status = 'present' AND a.date >= CURRENT_DATE - INTERVAL '90 days') AS present_90d,
  COUNT(a.id) FILTER (WHERE a.status = 'absent' AND a.date >= CURRENT_DATE - INTERVAL '90 days') AS absent_90d,
  MAX(a.date) AS last_attendance_date,
  MAX(ol.created_at) AS last_outreach_at,
  ROUND((COUNT(a.id) FILTER (WHERE a.status = 'present' AND a.date >= CURRENT_DATE - INTERVAL '90 days')::numeric / NULLIF(COUNT(a.id) FILTER (WHERE a.date >= CURRENT_DATE - INTERVAL '90 days'), 0)) * 100, 2) AS present_rate_90d
FROM members m
JOIN sections s ON s.id = m.section_id
JOIN leaders l ON l.id = m.leader_id
JOIN users u ON u.id = l.user_id
LEFT JOIN attendance a ON a.member_id = m.id
LEFT JOIN outreach_logs ol ON ol.member_id = m.id
GROUP BY m.id, m.membership_id, m.full_name, m.section_id, s.name, m.leader_id, u.full_name, m.status, m.hall_of_fame_points;

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_engagement_summary_member
  ON member_engagement_summary(member_id);

CREATE INDEX IF NOT EXISTS idx_member_engagement_summary_attention
  ON member_engagement_summary(present_rate_90d ASC NULLS FIRST, absent_90d DESC);

CREATE OR REPLACE VIEW missed_submission_candidates AS
SELECT
  service_days.attendance_date,
  st.id AS service_id,
  st.name AS service_name,
  l.id AS leader_id,
  u.id AS user_id,
  u.full_name AS leader_name,
  s.id AS section_id,
  s.name AS section_name
FROM generate_series(CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE, INTERVAL '1 day') AS service_days(attendance_date)
JOIN service_types st
  ON st.is_active = 1
 AND LOWER(TRIM(st.default_day)) = LOWER(TRIM(TO_CHAR(service_days.attendance_date, 'FMDay')))
JOIN leaders l ON l.is_active = 1
JOIN users u ON u.id = l.user_id
JOIN sections s ON s.id = l.section_id
WHERE NOT EXISTS (
  SELECT 1
  FROM submission_log sl
  WHERE sl.leader_id = l.id
    AND sl.service_id = st.id
    AND sl.date = service_days.attendance_date::date
);

CREATE OR REPLACE VIEW calendar_role_schedule_view AS
SELECT
  e.id AS event_id,
  e.title,
  e.event_date,
  e.event_time,
  e.event_type,
  e.role_title,
  e.assigned_to,
  e.section_name,
  e.location,
  e.notes,
  creator.full_name AS created_by_name,
  e.created_at,
  e.updated_at
FROM church_calendar_events e
LEFT JOIN users creator ON creator.id = e.created_by;

INSERT INTO schema_migrations (name)
VALUES ('002_postgres_analytics_views')
ON CONFLICT (name) DO NOTHING;

COMMIT;
