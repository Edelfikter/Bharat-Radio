'use strict';

const router = require('express').Router();
const sql = require('../db');
const { requireAuth } = require('../middleware/auth');

async function getStation(id) {
  const [station] = await sql`SELECT * FROM stations WHERE id = ${id}`;
  return station || null;
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
router.get('/:id/segments', async (req, res) => {
  try {
    const station = await getStation(req.params.id);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    const segments = await sql`
      SELECT * FROM segments WHERE station_id = ${station.id} ORDER BY position ASC
    `;
    return res.json(segments);
  } catch (err) {
    console.error('[segments] GET error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stations/:id/segments – auth, owner, not live
router.post('/:id/segments', requireAuth, async (req, res) => {
  try {
    const station = await getStation(req.params.id);
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

    const [maxPosRow] = await sql`
      SELECT COALESCE(MAX(position), -1)::INTEGER AS m FROM segments WHERE station_id = ${station.id}
    `;
    const position = maxPosRow.m + 1;

    const [seg] = await sql`
      INSERT INTO segments (station_id, type, youtube_id, youtube_title, tts_text, duration_seconds, position)
      VALUES (${station.id}, ${type}, ${youtube_id || null}, ${youtube_title || null}, ${tts_text || null}, ${dur}, ${position})
      RETURNING *
    `;
    return res.status(201).json(seg);
  } catch (err) {
    console.error('[segments] POST error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/stations/:id/segments/reorder – auth, owner, not live
// NOTE: must be defined before /:id/segments/:segId to avoid Express capturing 'reorder' as :segId
router.put('/:id/segments/reorder', requireAuth, async (req, res) => {
  try {
    const station = await getStation(req.params.id);
    if (!ownerGuard(station, req, res)) return;
    if (!liveGuard(station, res)) return;

    const { order } = req.body || {};
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of segment IDs' });
    }
    for (let i = 0; i < order.length; i++) {
      await sql`UPDATE segments SET position = ${i} WHERE id = ${order[i]} AND station_id = ${station.id}`;
    }

    const segments = await sql`
      SELECT * FROM segments WHERE station_id = ${station.id} ORDER BY position ASC
    `;
    return res.json(segments);
  } catch (err) {
    console.error('[segments] reorder error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/stations/:id/segments/:segId – auth, owner, not live
router.put('/:id/segments/:segId', requireAuth, async (req, res) => {
  try {
    const station = await getStation(req.params.id);
    if (!ownerGuard(station, req, res)) return;
    if (!liveGuard(station, res)) return;

    const [seg] = await sql`
      SELECT * FROM segments WHERE id = ${req.params.segId} AND station_id = ${station.id}
    `;
    if (!seg) return res.status(404).json({ error: 'Segment not found' });

    const { youtube_title, tts_text, duration_seconds } = req.body || {};
    const newTitle = youtube_title !== undefined ? youtube_title : seg.youtube_title;
    const newText = tts_text !== undefined ? tts_text : seg.tts_text;
    const newDur = duration_seconds !== undefined ? Number(duration_seconds) : seg.duration_seconds;

    const [updated] = await sql`
      UPDATE segments SET youtube_title = ${newTitle}, tts_text = ${newText}, duration_seconds = ${newDur}
      WHERE id = ${seg.id}
      RETURNING *
    `;
    return res.json(updated);
  } catch (err) {
    console.error('[segments] PUT error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/stations/:id/segments/:segId – auth, owner, not live
router.delete('/:id/segments/:segId', requireAuth, async (req, res) => {
  try {
    const station = await getStation(req.params.id);
    if (!ownerGuard(station, req, res)) return;
    if (!liveGuard(station, res)) return;

    const [seg] = await sql`
      SELECT * FROM segments WHERE id = ${req.params.segId} AND station_id = ${station.id}
    `;
    if (!seg) return res.status(404).json({ error: 'Segment not found' });

    await sql`DELETE FROM segments WHERE id = ${seg.id}`;

    // Re-order remaining segments
    const remaining = await sql`
      SELECT id FROM segments WHERE station_id = ${station.id} ORDER BY position ASC
    `;
    for (let i = 0; i < remaining.length; i++) {
      await sql`UPDATE segments SET position = ${i} WHERE id = ${remaining[i].id}`;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[segments] DELETE error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
