'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const stationsRoutes = require('./routes/stations');
const segmentsRoutes = require('./routes/segments');
const broadcastRoutes = require('./routes/broadcast');
const youtubeRoutes = require('./routes/youtube');
const chatRoutes = require('./routes/chat');

const app = express();

app.use(cors());
app.use(express.json());

// Rate limiting: 200 requests per 15 min for API, 500 for SPA
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);

const spaLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });

// Static files from public/
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationsRoutes);
app.use('/api/stations', segmentsRoutes);
app.use('/api/stations', broadcastRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/chat', chatRoutes);

// Client-side Pusher configuration (public key and cluster only)
app.get('/api/config', (req, res) => {
  res.json({
    pusherKey: process.env.PUSHER_KEY || '',
    pusherCluster: process.env.PUSHER_CLUSTER || 'mt1',
  });
});

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const sql = require('./db');
    const [stationsTotal] = await sql`SELECT COUNT(*)::INTEGER AS c FROM stations`;
    const [stationsLive] = await sql`SELECT COUNT(*)::INTEGER AS c FROM stations WHERE is_live = 1`;
    const [usersTotal] = await sql`SELECT COUNT(*)::INTEGER AS c FROM users`;
    return res.json({
      stations_total: parseInt(stationsTotal.c, 10),
      stations_live: parseInt(stationsLive.c, 10),
      users_total: parseInt(usersTotal.c, 10),
      listeners_online: 0,
      server_time: Date.now(),
    });
  } catch (err) {
    console.error('[stats] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// SPA fallback (for client-side routing)
app.get('*', spaLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server when run directly (local dev)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Bharat Radio on http://localhost:${PORT}`));
}

module.exports = app;
