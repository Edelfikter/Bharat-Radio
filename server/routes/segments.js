'use strict';

const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

function getStation(id) {
  return db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
}

function ownerGuard(station, req, res) {
  if (!station) { res.status(404).json({ error: 'Station not found' }); return false; }
  if (station.owner_id !== req.user.id) { res.status(403).json({ error: 'Forbidden' }); return false; }
  return true;
}

function liveGuard(station, res) {
  if (station.is_live) { res.status(409).json({ error: 'Cannot modify segments while station is live' }); return false; }
  return true;
}

// GET /api/stations/:id/segments – public
router.get('/:id/segments', (req, res) => {
  const station = getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const segments = db.prepare(
    'SELECT * FROM segments WHERE station_id = ? ORDER BY position ASC'
  ).all(station.id);
  return res.json(segments);
});

// POST /api/stations/:id/segments – auth, owner, not live
router.post('/:id/segments', requireAuth, (req, res) => {
  const station = getStation(req.params.id);
  if (!ownerGuard(station, req, res)) return;
  if (!liveGuard(station, res)) return;

  const { type, youtube_id, youtube_title, tts_text, duration_seconds } = req.body || {};
  if (!type || !['youtube', 'tts'].includes(type)) {
    return res.status(400).json({ error: "type must be 'youtube' or 'tts'" });
  }
  if (type === 'youtube') {
    if (!youtube_id || !youtube_title) {
      return res.status(400).json({ error: 'youtube_id and youtube_title are required for youtube segments' });
    }
  }
  if (type === 'tts') {
    if (!tts_text || !tts_text.trim()) {
      return res.status(400).json({ error: 'tts_text is required for tts segments' });
    }
  }
  const dur = duration_seconds != null ? Number(duration_seconds) : 0;

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as m FROM segments WHERE station_id = ?'
  ).get(station.id).m;
  const position = maxPos + 1;

  const result = db.prepare(`
    INSERT INTO segments (station_id, type, youtube_id, youtube_title, tts_text, duration_seconds, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    station.id, type,
    youtube_id || null,
    youtube_title || null,
    tts_text || null,
    dur,
    position
  );
  const seg = db.prepare('SELECT * FROM segments WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(seg);
});

// PUT /api/stations/:id/segments/:segId – auth, owner, not live
router.put('/:id/segments/:segId', requireAuth, (req, res) => {
  const station = getStation(req.params.id);
  if (!ownerGuard(station, req, res)) return;
  if (!liveGuard(station, res)) return;

  const seg = db.prepare('SELECT * FROM segments WHERE id = ? AND station_id = ?').get(req.params.segId, station.id);
  if (!seg) return res.status(404).json({ error: 'Segment not found' });

  const { youtube_title, tts_text, duration_seconds } = req.body || {};
  const newTitle = youtube_title !== undefined ? youtube_title : seg.youtube_title;
  const newText = tts_text !== undefined ? tts_text : seg.tts_text;
  const newDur = duration_seconds !== undefined ? Number(duration_seconds) : seg.duration_seconds;

  db.prepare(
    'UPDATE segments SET youtube_title = ?, tts_text = ?, duration_seconds = ? WHERE id = ?'
  ).run(newTitle, newText, newDur, seg.id);
  const updated = db.prepare('SELECT * FROM segments WHERE id = ?').get(seg.id);
  return res.json(updated);
});

// DELETE /api/stations/:id/segments/:segId – auth, owner, not live
router.delete('/:id/segments/:segId', requireAuth, (req, res) => {
  const station = getStation(req.params.id);
  if (!ownerGuard(station, req, res)) return;
  if (!liveGuard(station, res)) return;

  const seg = db.prepare('SELECT * FROM segments WHERE id = ? AND station_id = ?').get(req.params.segId, station.id);
  if (!seg) return res.status(404).json({ error: 'Segment not found' });

  db.prepare('DELETE FROM segments WHERE id = ?').run(seg.id);

  // Re-order remaining segments
  const remaining = db.prepare(
    'SELECT id FROM segments WHERE station_id = ? ORDER BY position ASC'
  ).all(station.id);
  const updatePos = db.prepare('UPDATE segments SET position = ? WHERE id = ?');
  const reorder = db.transaction((segs) => {
    segs.forEach((s, i) => updatePos.run(i, s.id));
  });
  reorder(remaining);

  return res.json({ success: true });
});

// PUT /api/stations/:id/segments/reorder – auth, owner, not live
router.put('/:id/segments/reorder', requireAuth, (req, res) => {
  const station = getStation(req.params.id);
  if (!ownerGuard(station, req, res)) return;
  if (!liveGuard(station, res)) return;

  const { order } = req.body || {};
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of segment IDs' });
  }
  const updatePos = db.prepare('UPDATE segments SET position = ? WHERE id = ? AND station_id = ?');
  const reorder = db.transaction((ids) => {
    ids.forEach((id, i) => updatePos.run(i, id, station.id));
  });
  reorder(order);

  const segments = db.prepare('SELECT * FROM segments WHERE station_id = ? ORDER BY position ASC').all(station.id);
  return res.json(segments);
});

module.exports = router;
