'use strict';

/**
 * One-time database migration script.
 * Run this once to create the PostgreSQL schema in your Neon database:
 *   DATABASE_URL=<your-neon-url> node scripts/migrate.js
 * Or via npm:
 *   npm run migrate
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  console.error('Copy .env.example to .env and fill in your Neon database URL.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running database migration...');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    )
  `;
  console.log('✓ users table ready');

  await sql`
    CREATE TABLE IF NOT EXISTS stations (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      is_live INTEGER NOT NULL DEFAULT 0,
      live_started_at INTEGER,
      live_segment_index INTEGER NOT NULL DEFAULT 0,
      live_segment_started_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    )
  `;
  console.log('✓ stations table ready');

  await sql`
    CREATE TABLE IF NOT EXISTS segments (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('youtube','tts')),
      youtube_id TEXT,
      youtube_title TEXT,
      tts_text TEXT,
      duration_seconds REAL NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    )
  `;
  console.log('✓ segments table ready');

  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    )
  `;
  console.log('✓ chat_messages table ready');

  console.log('\nMigration complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
