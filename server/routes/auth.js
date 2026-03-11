'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sql = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const cleanUsername = username.trim();
    const [existing] = await sql`SELECT id FROM users WHERE username = ${cleanUsername}`;
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const password_hash = bcrypt.hashSync(password, 10);
    const [result] = await sql`
      INSERT INTO users (username, password_hash) VALUES (${cleanUsername}, ${password_hash}) RETURNING id
    `;
    const user = { id: result.id, username: cleanUsername };
    const token = signToken(user);
    return res.status(201).json({ token, id: user.id, username: user.username });
  } catch (err) {
    console.error('[auth] register error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const [user] = await sql`SELECT * FROM users WHERE username = ${username.trim()}`;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    const token = signToken(user);
    return res.json({ token, id: user.id, username: user.username });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({ id: req.user.id, username: req.user.username });
});

module.exports = router;
