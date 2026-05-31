const bcrypt = require('bcryptjs');
const { queries } = require('../server/database');

async function seedDatabase() {
  try {
    // Create admin user if not exists
    const username = 'admin';
    const password = 'admin123';
    const role = 'admin';
    const fullName = 'System Administrator';

    const existing = await queries.findUserByUsername(username);
    if (existing) {
      console.log('Admin user already exists. Skipping.');
    } else {
      const passwordHash = bcrypt.hashSync(password, 10);
      await queries.createUser(username, passwordHash, role, fullName);
      console.log('Admin user created successfully!');
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
      console.log('⚠️  IMPORTANT: Change this password after first login!');
    }

    // Create sample sections
    const sections = ['Holy Spirit', 'Divine of God', 'Glory of God', 'Love of God'];
    for (const name of sections) {
      try {
        await queries.createSection(name);
        console.log(`Created section: ${name}`);
      } catch (error) {
        if (error.message.includes('UNIQUE')) {
          console.log(`Section already exists: ${name}`);
        } else {
          console.error(`Error creating section ${name}:`, error.message);
        }
      }
    }

    console.log('\nDatabase seeded successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedDatabase();
