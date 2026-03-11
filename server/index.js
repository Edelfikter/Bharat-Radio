'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const stationsRoutes = require('./routes/stations');
const segmentsRoutes = require('./routes/segments');
const broadcastRoutes = require('./routes/broadcast');
const youtubeRoutes = require('./routes/youtube');
const { setupSocket } = require('./chat/socket');

const app = express();

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);

// Static files from public/
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationsRoutes);
app.use('/api/stations', segmentsRoutes);
app.use('/api/stations', broadcastRoutes);
app.use('/api/youtube', youtubeRoutes);

// Stats
app.get('/api/stats', (req, res) => {
  const db = require('./db');
  const stations_total = db.prepare('SELECT COUNT(*) as c FROM stations').get().c;
  const stations_live = db.prepare('SELECT COUNT(*) as c FROM stations WHERE is_live=1').get().c;
  const users_total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const { getIO } = require('./chat/socket');
  let listeners_online = 0;
  try { const io = getIO(); listeners_online = io.engine.clientsCount; } catch (e) {}
  res.json({ stations_total, stations_live, users_total, listeners_online, server_time: Date.now() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server when run directly (local dev)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);
  setupSocket(server);
  server.listen(PORT, () => console.log(`Bharat Radio on http://localhost:${PORT}`));
}

module.exports = app;
