'use strict';

const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/stations – public, all stations with owner username
router.get('/', (req, res) => {
  const stations = db.prepare(`
    SELECT s.*, u.username AS owner_username
    FROM stations s
    JOIN users u ON u.id = s.owner_id
    ORDER BY s.created_at DESC
  `).all();
  return res.json(stations);
});

// POST /api/stations – auth, max 3 per user
router.post('/', requireAuth, (req, res) => {
  const { name, description, lat, lng } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Station name is required' });
  }
  if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }
  const count = db.prepare('SELECT COUNT(*) as c FROM stations WHERE owner_id = ?').get(req.user.id).c;
  if (count >= 3) {
    return res.status(400).json({ error: 'Maximum 3 stations per user' });
  }
  const result = db.prepare(
    'INSERT INTO stations (owner_id, name, description, lat, lng) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, name.trim(), description || '', Number(lat), Number(lng));
  const station = db.prepare(`
    SELECT s.*, u.username AS owner_username
    FROM stations s JOIN users u ON u.id = s.owner_id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);
  return res.status(201).json(station);
});

// GET /api/stations/:id – public, with segments
router.get('/:id', (req, res) => {
  const station = db.prepare(`
    SELECT s.*, u.username AS owner_username
    FROM stations s JOIN users u ON u.id = s.owner_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const segments = db.prepare(
    'SELECT * FROM segments WHERE station_id = ? ORDER BY position ASC'
  ).all(station.id);
  return res.json({ ...station, segments });
});

// PUT /api/stations/:id – auth, owner only
router.put('/:id', requireAuth, (req, res) => {
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const { name, description, lat, lng } = req.body || {};
  const newName = (name || station.name).trim();
  const newDesc = description !== undefined ? description : station.description;
  const newLat = lat !== undefined ? Number(lat) : station.lat;
  const newLng = lng !== undefined ? Number(lng) : station.lng;
  if (!newName) return res.status(400).json({ error: 'Station name is required' });
  db.prepare(
    'UPDATE stations SET name = ?, description = ?, lat = ?, lng = ? WHERE id = ?'
  ).run(newName, newDesc, newLat, newLng, station.id);
  const updated = db.prepare(`
    SELECT s.*, u.username AS owner_username
    FROM stations s JOIN users u ON u.id = s.owner_id
    WHERE s.id = ?
  `).get(station.id);
  return res.json(updated);
});

// DELETE /api/stations/:id – auth, owner only
router.delete('/:id', requireAuth, (req, res) => {
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM stations WHERE id = ?').run(station.id);
  return res.json({ success: true });
});

module.exports = router;
