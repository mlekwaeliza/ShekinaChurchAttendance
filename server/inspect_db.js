const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  try {
    const titlesRes = await client.query('SELECT * FROM congregation_titles ORDER BY sort_order, name');
    console.log('--- congregation_titles ---');
    console.log(titlesRes.rows);

    const membersTitlesRes = await client.query(`
      SELECT mt.*, m.full_name, ct.name as title_name 
      FROM member_titles mt 
      JOIN members m ON mt.member_id = m.id 
      JOIN congregation_titles ct ON mt.title_id = ct.id
    `);
    console.log('--- member_titles assignments ---');
    console.log(membersTitlesRes.rows);
  } catch (err) {
    console.error('Error running queries:', err);
  } finally {
    await client.end();
  }
}

main();
