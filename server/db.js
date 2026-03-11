'use strict';

const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. See .env.example for setup instructions.');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = sql;
