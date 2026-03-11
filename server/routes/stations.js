'use strict';

const router = require('express').Router();
const sql = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/stations – public, all stations with owner username
router.get('/', async (req, res) => {
  try {
    const stations = await sql`
      SELECT s.*, u.username AS owner_username
      FROM stations s
      JOIN users u ON u.id = s.owner_id
      ORDER BY s.created_at DESC
    `;
    return res.json(stations);
  } catch (err) {
    console.error('[stations] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stations – auth, max 3 per user
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, lat, lng } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Station name is required' });
    }
    if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return res.status(400).json({ error: 'Valid lat and lng are required' });
    }
    const [countRow] = await sql`SELECT COUNT(*)::INTEGER AS c FROM stations WHERE owner_id = ${req.user.id}`;
    if (parseInt(countRow.c, 10) >= 3) {
      return res.status(400).json({ error: 'Maximum 3 stations per user' });
    }
    const [result] = await sql`
      INSERT INTO stations (owner_id, name, description, lat, lng)
      VALUES (${req.user.id}, ${name.trim()}, ${description || ''}, ${Number(lat)}, ${Number(lng)})
      RETURNING id
    `;
    const [station] = await sql`
      SELECT s.*, u.username AS owner_username
      FROM stations s JOIN users u ON u.id = s.owner_id
      WHERE s.id = ${result.id}
    `;
    return res.status(201).json(station);
  } catch (err) {
    console.error('[stations] POST / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stations/:id – public, with segments
router.get('/:id', async (req, res) => {
  try {
    const [station] = await sql`
      SELECT s.*, u.username AS owner_username
      FROM stations s JOIN users u ON u.id = s.owner_id
      WHERE s.id = ${req.params.id}
    `;
    if (!station) return res.status(404).json({ error: 'Station not found' });
    const segments = await sql`
      SELECT * FROM segments WHERE station_id = ${station.id} ORDER BY position ASC
    `;
    return res.json({ ...station, segments });
  } catch (err) {
    console.error('[stations] GET /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/stations/:id – auth, owner only
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const [station] = await sql`SELECT * FROM stations WHERE id = ${req.params.id}`;
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { name, description, lat, lng } = req.body || {};
    const newName = (name || station.name).trim();
    const newDesc = description !== undefined ? description : station.description;
    const newLat = lat !== undefined ? Number(lat) : station.lat;
    const newLng = lng !== undefined ? Number(lng) : station.lng;
    if (!newName) return res.status(400).json({ error: 'Station name is required' });
    await sql`
      UPDATE stations SET name = ${newName}, description = ${newDesc}, lat = ${newLat}, lng = ${newLng}
      WHERE id = ${station.id}
    `;
    const [updated] = await sql`
      SELECT s.*, u.username AS owner_username
      FROM stations s JOIN users u ON u.id = s.owner_id
      WHERE s.id = ${station.id}
    `;
    return res.json(updated);
  } catch (err) {
    console.error('[stations] PUT /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/stations/:id – auth, owner only
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [station] = await sql`SELECT * FROM stations WHERE id = ${req.params.id}`;
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await sql`DELETE FROM stations WHERE id = ${station.id}`;
    return res.json({ success: true });
  } catch (err) {
    console.error('[stations] DELETE /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
