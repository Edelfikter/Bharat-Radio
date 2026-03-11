'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { validateYouTube } = require('../services/youtube');

// GET /api/youtube/validate?v=VIDEO_ID
router.get('/validate', requireAuth, async (req, res) => {
  const videoId = req.query.v;
  if (!videoId || !videoId.trim()) {
    return res.status(400).json({ error: 'Video ID (v) query parameter is required' });
  }
  try {
    const result = await validateYouTube(videoId.trim());
    return res.json({ valid: result.valid, title: result.title || null, video_id: videoId.trim() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to validate YouTube video', details: err.message });
  }
});

module.exports = router;
