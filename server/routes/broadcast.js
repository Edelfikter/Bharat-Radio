'use strict';

const router = require('express').Router();
const sql = require('../db');
const { requireAuth } = require('../middleware/auth');
const { triggerStationLive, triggerStationStop } = require('../chat/socket');

// POST /api/stations/:id/live
router.post('/:id/live', requireAuth, async (req, res) => {
  try {
    const [station] = await sql`SELECT * FROM stations WHERE id = ${req.params.id}`;
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const segments = await sql`
      SELECT * FROM segments WHERE station_id = ${station.id} ORDER BY position ASC
    `;
    if (segments.length === 0) {
      return res.status(400).json({ error: 'Station must have at least one segment to go live' });
    }

    const now = Math.floor(Date.now() / 1000);
    await sql`
      UPDATE stations
      SET is_live = 1, live_started_at = ${now}, live_segment_index = 0, live_segment_started_at = ${now}
      WHERE id = ${station.id}
    `;

    triggerStationLive(station.id);

    const [updated] = await sql`SELECT * FROM stations WHERE id = ${station.id}`;
    return res.json(updated);
  } catch (err) {
    console.error('[broadcast] live error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stations/:id/stop
router.post('/:id/stop', requireAuth, async (req, res) => {
  try {
    const [station] = await sql`SELECT * FROM stations WHERE id = ${req.params.id}`;
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await sql`UPDATE stations SET is_live = 0 WHERE id = ${station.id}`;

    triggerStationStop(station.id);

    const [updated] = await sql`SELECT * FROM stations WHERE id = ${station.id}`;
    return res.json(updated);
  } catch (err) {
    console.error('[broadcast] stop error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stations/:id/now
router.get('/:id/now', async (req, res) => {
  try {
    const [station] = await sql`SELECT * FROM stations WHERE id = ${req.params.id}`;
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (!station.is_live) return res.json({ live: false, segment: null });

    const segments = await sql`
      SELECT * FROM segments WHERE station_id = ${station.id} ORDER BY position ASC
    `;
    if (segments.length === 0) return res.json({ live: false, segment: null });

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - station.live_started_at;

    // Calculate total playlist duration
    const totalPlaylistDuration = segments.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

    let segmentIndex = 0;
    let positionInSegment = 0;

    if (totalPlaylistDuration <= 0) {
      segmentIndex = 0;
      positionInSegment = 0;
    } else {
      const loopElapsed = elapsed % totalPlaylistDuration;
      let acc = 0;
      for (let i = 0; i < segments.length; i++) {
        const segDur = segments[i].duration_seconds || 0;
        if (loopElapsed < acc + segDur || i === segments.length - 1) {
          segmentIndex = i;
          positionInSegment = loopElapsed - acc;
          break;
        }
        acc += segDur;
      }
    }

    return res.json({
      live: true,
      segment_index: segmentIndex,
      position_seconds: positionInSegment,
      segment: segments[segmentIndex] || null
    });
  } catch (err) {
    console.error('[broadcast] now error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
