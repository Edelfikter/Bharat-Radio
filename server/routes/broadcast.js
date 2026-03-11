'use strict';

const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

function getIO() {
  try { return require('../chat/socket').getIO(); } catch (e) { return null; }
}

// POST /api/stations/:id/live
router.post('/:id/live', requireAuth, (req, res) => {
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const segments = db.prepare('SELECT * FROM segments WHERE station_id = ? ORDER BY position ASC').all(station.id);
  if (segments.length === 0) {
    return res.status(400).json({ error: 'Station must have at least one segment to go live' });
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE stations
    SET is_live = 1, live_started_at = ?, live_segment_index = 0, live_segment_started_at = ?
    WHERE id = ?
  `).run(now, now, station.id);

  const io = getIO();
  if (io) io.emit('station:live', { id: station.id });

  const updated = db.prepare('SELECT * FROM stations WHERE id = ?').get(station.id);
  return res.json(updated);
});

// POST /api/stations/:id/stop
router.post('/:id/stop', requireAuth, (req, res) => {
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('UPDATE stations SET is_live = 0 WHERE id = ?').run(station.id);

  const io = getIO();
  if (io) io.emit('station:stop', { id: station.id });

  const updated = db.prepare('SELECT * FROM stations WHERE id = ?').get(station.id);
  return res.json(updated);
});

// GET /api/stations/:id/now
router.get('/:id/now', (req, res) => {
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.is_live) return res.json({ live: false, segment: null });

  const segments = db.prepare('SELECT * FROM segments WHERE station_id = ? ORDER BY position ASC').all(station.id);
  if (segments.length === 0) return res.json({ live: false, segment: null });

  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - station.live_started_at;

  // Calculate total playlist duration
  const totalPlaylistDuration = segments.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  let segmentIndex = 0;
  let positionInSegment = 0;

  if (totalPlaylistDuration <= 0) {
    // No meaningful duration — stay at first segment
    segmentIndex = 0;
    positionInSegment = 0;
  } else {
    // Loop elapsed time within playlist
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
});

module.exports = router;
