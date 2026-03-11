'use strict';

const db = require('../db');

let io = null;

// Rate limiting: track last message time per socket
const lastMessageTime = new Map();
const RATE_LIMIT_MS = 2000;

function setupSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    socket.join('global');

    // Send last 50 chat messages to new connection
    const history = db.prepare(
      'SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50'
    ).all().reverse();
    socket.emit('chat:history', history);

    // Handle chat messages
    socket.on('chat:message', ({ username, message }) => {
      if (!username || !message) return;

      // Rate limit
      const now = Date.now();
      const last = lastMessageTime.get(socket.id) || 0;
      if (now - last < RATE_LIMIT_MS) return;
      lastMessageTime.set(socket.id, now);

      // Validate message length
      const clean = String(message).trim().slice(0, 200);
      if (!clean) return;
      const cleanUsername = String(username).trim().slice(0, 32) || 'Anonymous';

      // Persist message
      let msgId, createdAt;
      try {
        const result = db.prepare(
          'INSERT INTO chat_messages (username, message) VALUES (?, ?)'
        ).run(cleanUsername, clean);
        msgId = result.lastInsertRowid;
        const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msgId);
        createdAt = row ? row.created_at : Math.floor(Date.now() / 1000);
      } catch (e) {
        return;
      }

      // Broadcast to all in global room
      io.to('global').emit('chat:message', {
        id: msgId,
        username: cleanUsername,
        message: clean,
        created_at: createdAt
      });
    });

    // Station rooms
    socket.on('station:join', (stationId) => {
      if (stationId) socket.join(`station:${stationId}`);
    });

    socket.on('station:leave', (stationId) => {
      if (stationId) socket.leave(`station:${stationId}`);
    });

    socket.on('disconnect', () => {
      lastMessageTime.delete(socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { setupSocket, getIO };
