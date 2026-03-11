'use strict';

const router = require('express').Router();
const sql = require('../db');
const { triggerChatMessage } = require('../chat/socket');

// GET /api/chat/history – last 50 messages
router.get('/history', async (req, res) => {
  try {
    const messages = await sql`
      SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50
    `;
    return res.json(messages.reverse());
  } catch (err) {
    console.error('[chat] history error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/chat/message – send a message
// Rate limiting for this endpoint is handled by the global express-rate-limit middleware
// applied at /api/ in server/index.js, which works across serverless invocations.
router.post('/message', async (req, res) => {
  try {
    const { username, message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    const clean = String(message).trim().slice(0, 200);
    if (!clean) return res.status(400).json({ error: 'message is required' });
    const cleanUsername = String(username || 'Anonymous').trim().slice(0, 32) || 'Anonymous';

    const [row] = await sql`
      INSERT INTO chat_messages (username, message) VALUES (${cleanUsername}, ${clean})
      RETURNING *
    `;

    const payload = {
      id: row.id,
      username: row.username,
      message: row.message,
      created_at: row.created_at,
    };

    triggerChatMessage(payload);

    return res.status(201).json(payload);
  } catch (err) {
    console.error('[chat] message error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
