const { queries, all, run, db } = require('./database');
const { addDays, formatMonthDay, getWeekStartString, startOfLocalDay } = require('./utils/date');
const { monthsAgo } = require('./utils/sqlDialect');

function getNextSunday() {
  const d = new Date();
  const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

function getSaturdayEvening() {
  const d = new Date();
  const daysUntilSaturday = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilSaturday);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

async function scheduleWeeklyReminders() {
  try {
    const leaders = await all(`
      SELECT l.id, l.user_id, u.full_name, s.name as section_name
      FROM leaders l JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id
      WHERE l.is_active = 1
    `);

    const saturdayTime = getSaturdayEvening();
    const weekStart = getWeekStartString();

    for (const leader of leaders) {
      const existing = await all(
        "SELECT id FROM scheduled_reminders WHERE type = 'submission_reminder' AND entity_id = ? AND scheduled_for >= ?",
        [leader.id, weekStart]
      );

      if (existing.length === 0) {
        await queries.createScheduledReminder(
          'submission_reminder',
          'leader',
          leader.id,
          saturdayTime,
          JSON.stringify({ leader_id: leader.id, leader_name: leader.full_name, section_name: leader.section_name })
        );
      }
    }

    const admins = await all("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      const existing = await all(
        "SELECT id FROM scheduled_reminders WHERE type = 'weekly_summary' AND entity_id = ? AND scheduled_for >= ?",
        [admin.id, weekStart]
      );

      if (existing.length === 0) {
        const mondayMorning = new Date();
        mondayMorning.setDate(mondayMorning.getDate() + ((1 - mondayMorning.getDay() + 7) % 7 || 7));
        mondayMorning.setHours(9, 0, 0, 0);

        await queries.createScheduledReminder(
          'weekly_summary',
          'admin',
          admin.id,
          mondayMorning.toISOString(),
          null
        );
      }
    }

    console.log(`Scheduled ${leaders.length} submission reminders and ${admins.length} weekly summaries`);
  } catch (error) {
    console.error('Schedule weekly reminders error:', error);
  }
}

async function processPendingReminders() {
  try {
    const reminders = await queries.getPendingReminders();

    for (const reminder of reminders) {
      const payload = reminder.payload ? JSON.parse(reminder.payload) : null;

      try {
        if (reminder.type === 'submission_reminder' && payload) {
          const userId = payload.leader_id ? await getLeaderUserId(payload.leader_id) : null;
          if (userId) {
            await queries.createNotification(
              userId,
              'system',
              'Reminder: Submit Attendance',
              `Don't forget to submit attendance for ${payload.section_name || 'your section'} tomorrow!`,
              'leader',
              payload.leader_id
            );
          } else {
            console.warn(`Could not find User ID for Leader ID ${payload.leader_id}. Skipping notification.`);
          }
        }

        if (reminder.type === 'weekly_summary') {
          if (!reminder.entity_id) {
            console.warn(`Weekly summary reminder ${reminder.id} has no entity_id (target user). Skipping.`);
          } else {
            const weekStart = getWeekStartString();
            const summary = await queries.getWeeklySummary(weekStart);
            const leadersNotSubmitted = summary.filter(l => l.submitted === 0);

            await queries.createNotification(
              reminder.entity_id,
              'system',
              'Weekly Summary',
              `This week: ${summary.filter(l => l.submitted > 0).length}/${summary.length} leaders submitted. ${leadersNotSubmitted.length} leader(s) still pending: ${leadersNotSubmitted.map(l => l.leader_name).join(', ') || 'none'}`,
              'system',
              null
            );
          }
        }

        if (reminder.type === 'birthday_greeting' && payload) {
          if (!payload.leader_user_id) {
            console.warn(`Birthday reminder ${reminder.id} for member ${payload.member_id} (${payload.member_name || 'unnamed'}) has no leader_user_id. Skipping notification.`);
          } else {
            await queries.createNotification(
              payload.leader_user_id,
              'system',
              'Birthday Today!',
              `${payload.member_name} from ${payload.section_name} has a birthday today! Consider sending a greeting.`,
              'member',
              payload.member_id
            );
          }
        }

        if (reminder.type === 'follow_up_reminder' && payload) {
          if (!payload.leader_user_id) {
            console.warn(`Follow-up reminder ${reminder.id} for member ${payload.member_id} (${payload.member_name || 'unnamed'}) has no leader_user_id. Skipping notification.`);
          } else {
            await queries.createNotification(
              payload.leader_user_id,
              'system',
              'Follow-Up Needed',
              `${payload.member_name} has been absent and needs follow-up.`,
              'member',
              payload.member_id
            );
          }
        }
      } catch (reminderError) {
        console.error(`Failed to process reminder ${reminder.id} (type=${reminder.type}):`, reminderError.message);
      }

      await queries.markReminderSent(reminder.id);
    }

    if (reminders.length > 0) {
      console.log(`Processed ${reminders.length} scheduled reminders`);
    }
  } catch (error) {
    console.error('Process pending reminders error:', error);
  }
}

async function getLeaderUserId(leaderId) {
  const result = await all('SELECT user_id FROM leaders WHERE id = ?', [leaderId]);
  return result.length > 0 ? result[0].user_id : null;
}

async function scheduleBirthdayReminders() {
  try {
    const birthdays = await queries.getTodayBirthdays(formatMonthDay());
    const todayStart = startOfLocalDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);

    for (const bday of birthdays) {
      if (!bday.leader_user_id) {
        continue;
      }
      const existing = await all(
        "SELECT id FROM scheduled_reminders WHERE type = 'birthday_greeting' AND entity_id = ? AND scheduled_for >= ? AND scheduled_for < ?",
        [bday.id, todayStart.toISOString(), tomorrowStart.toISOString()]
      );

      if (existing.length === 0) {
        await queries.createScheduledReminder(
          'birthday_greeting',
          'member',
          bday.id,
          new Date().toISOString(),
          JSON.stringify({
            member_id: bday.id,
            member_name: bday.full_name,
            section_name: bday.section_name,
            leader_user_id: bday.leader_user_id
          })
        );
      }
    }
  } catch (error) {
    console.error('Schedule birthday reminders error:', error);
  }
}

async function scheduleFollowUpReminders() {
  try {
    const members = await queries.getMembersNeedingFollowUp();

    for (const member of members) {
      if (!member.leader_user_id) {
        continue;
      }
      const existing = await all(
        "SELECT id FROM scheduled_reminders WHERE type = 'follow_up_reminder' AND entity_id = ? AND sent = 0",
        [member.id]
      );

      if (existing.length === 0) {
        await queries.createScheduledReminder(
          'follow_up_reminder',
          'member',
          member.id,
          new Date().toISOString(),
          JSON.stringify({
            member_id: member.id,
            member_name: member.full_name,
            leader_user_id: member.leader_user_id
          })
        );
      }
    }
  } catch (error) {
    console.error('Schedule follow-up reminders error:', error);
  }
}

async function cleanupExpiredFlags() {
  try {
    const today = new Date().toISOString();
    const membersWithFlags = await all("SELECT id, flags FROM members WHERE flags IS NOT NULL AND flags != '[]'");

    for (const member of membersWithFlags) {
      try {
        const flags = JSON.parse(member.flags);
        const validFlags = flags.filter(f => !f.expires_at || f.expires_at > today);

        if (flags.length !== validFlags.length) {
          await queries.updateMemberFlags(member.id, JSON.stringify(validFlags));
        }
      } catch (e) {
        console.error(`Error parsing flags for member ${member.id}:`, e);
      }
    }
  } catch (error) {
    console.error('Cleanup expired flags error:', error);
  }
}

async function flagPendingPermanentDeletions() {
  try {
    // Mark members soft-deleted more than 6 months ago as pending permanent
    // deletion. The admin must explicitly confirm deletion via
    // POST /api/admin/members/confirm-deletion.
    const flagged = await run(`
      UPDATE members
      SET pending_deletion_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE is_active = 0
        AND deletion_confirmed_at IS NULL
        AND soft_deleted_at IS NOT NULL
        AND pending_deletion_at IS NULL
        AND soft_deleted_at <= ${monthsAgo(6)}
    `);
    if (flagged.changes && flagged.changes > 0) {
      console.log(`Flagged ${flagged.changes} member(s) as pending permanent deletion`);
    }
  } catch (error) {
    console.error('Flag pending deletions error:', error);
  }
}

function startScheduler() {
  // Run the four bootstrap functions in sequence so the in-memory query
  // queue in postgresRuntime.js is not flooded by 4 concurrent producers
  // at startup. Subsequent intervals stay concurrent.
  (async () => {
    try {
      await scheduleWeeklyReminders();
      await scheduleBirthdayReminders();
      await scheduleFollowUpReminders();
      await cleanupExpiredFlags();
      await flagPendingPermanentDeletions();
    } catch (error) {
      console.error('Scheduler bootstrap error:', error);
    }
  })();

  setInterval(processPendingReminders, 15 * 60 * 1000);
  setInterval(scheduleBirthdayReminders, 24 * 60 * 60 * 1000);
  setInterval(scheduleFollowUpReminders, 6 * 60 * 60 * 1000);
  setInterval(scheduleWeeklyReminders, 7 * 24 * 60 * 60 * 1000);
  setInterval(cleanupExpiredFlags, 24 * 60 * 60 * 1000);
  setInterval(flagPendingPermanentDeletions, 24 * 60 * 60 * 1000);

  console.log('Scheduler started');
}

module.exports = { startScheduler, processPendingReminders, scheduleWeeklyReminders, flagPendingPermanentDeletions };
