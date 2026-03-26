const csv = require('csv-parser');
const fs = require('fs');
const { createReadStream } = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { db, queries } = require('../database');

/**
 * Parse and validate CSV file for attendance system
 * Expected columns:
 * - MembershipID (required, unique)
 * - FullName (required)
 * - Section (required) - must match existing sections
 * - LeaderName (required) - creates leader user if new
 * - Phone (optional)
 * - Email (optional)
 * - Gender (optional)
 * - AgeGroup (optional)
 */
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];

    createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

/**
 * Import CSV data into database with proper validation and error handling
 */
async function importCSV(buffer, callback) {
  const tempDir = './temp';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempPath = `${tempDir}/${uuidv4()}.csv`;
  fs.writeFileSync(tempPath, buffer);

  try {
    const rows = await parseCSV(tempPath);

    const stats = {
      sectionsCreated: 0,
      leadersCreated: 0,
      membersCreated: 0,
      membersUpdated: 0,
      errors: []
    };

    const sectionsMap = new Map();
    const leadersMap = new Map();
    const userPasswords = new Map();

    // Pre-populate existing sections
    const existingSections = queries.getAllSections.all();
    existingSections.forEach(s => sectionsMap.set(s.name.toLowerCase().trim(), s.id));

    for (const row of rows) {
      try {
        const sectionName = row.Section?.trim();
        const leaderName = row.LeaderName?.trim();
        const membershipId = row.MembershipID?.trim();
        const fullName = row.FullName?.trim();

        // Validation
        if (!sectionName || !leaderName || !membershipId || !fullName) {
          stats.errors.push(`Row skipped: missing required fields (Section, LeaderName, MembershipID, FullName) for ${fullName || 'unknown'}`);
          continue;
        }

        // Get or create section
        let sectionId = sectionsMap.get(sectionName.toLowerCase());
        if (!sectionId) {
          try {
            queries.createSection.run(sectionName);
            sectionId = queries.getSectionByName.get(sectionName).id;
            sectionsMap.set(sectionName.toLowerCase(), sectionId);
            stats.sectionsCreated++;
          } catch (error) {
            if (error.message.includes('UNIQUE')) {
              sectionId = queries.getSectionByName.get(sectionName).id;
              sectionsMap.set(sectionName.toLowerCase(), sectionId);
            } else {
              stats.errors.push(`Failed to create section "${sectionName}": ${error.message}`);
              continue;
            }
          }
        }

        // Get or create leader user
        const leaderUsername = leaderName.toLowerCase().replace(/\s+/g, '_');
        let leaderUser = queries.findUserByUsername.get(leaderUsername);

        if (!leaderUser) {
          const tempPassword = `temp_${uuidv4().substring(0, 8)}`;
          const passwordHash = bcrypt.hashSync(tempPassword, 10);
          try {
            queries.createUser.run(leaderUsername, passwordHash, 'leader', leaderName);
            leaderUser = queries.findUserByUsername.get(leaderUsername);
            userPasswords.set(leaderUsername, tempPassword);
            stats.leadersCreated++;
          } catch (error) {
            stats.errors.push(`Failed to create leader user "${leaderUsername}": ${error.message}`);
            continue;
          }
        }

        // Get leader record (create if doesn't exist)
        let leaderRecord = queries.getLeaderByUserId.get(leaderUser.id);
        if (!leaderRecord) {
          try {
            queries.createLeader.run(leaderUser.id, sectionId, row.LeaderPhone || null, row.LeaderEmail || null);
            leaderRecord = queries.getLeaderByUserId.get(leaderUser.id);
          } catch (error) {
            stats.errors.push(`Failed to create leader record for ${leaderName}: ${error.message}`);
            continue;
          }
        }

        const leaderId = leaderRecord.id;

        // Create or update member
        const existingMember = queries.getMemberByMembershipId.get(membershipId);
        if (existingMember) {
          queries.updateMember.run(
            fullName,
            row.Phone || null,
            row.Email || null,
            row.Gender || null,
            row.AgeGroup || null,
            existingMember.id
          );
          stats.membersUpdated++;
        } else {
          try {
            queries.createMember.run(
              membershipId,
              fullName,
              sectionId,
              leaderId,
              row.Phone || null,
              row.Email || null,
              row.Gender || null,
              row.AgeGroup || null
            );
            stats.membersCreated++;
          } catch (error) {
            stats.errors.push(`Failed to create member ${membershipId}: ${error.message}`);
          }
        }
      } catch (error) {
        stats.errors.push(`Unexpected error: ${error.message}`);
      }
    }

    callback(null, stats);
  } catch (error) {
    callback(error);
  } finally {
    // Cleanup
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

module.exports = { importCSV, parseCSV };
