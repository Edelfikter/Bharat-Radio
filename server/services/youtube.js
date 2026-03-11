'use strict';

const fetch = require('node-fetch');

/**
 * Validate a YouTube video ID using the oEmbed API.
 * @param {string} videoId
 * @returns {Promise<{valid: boolean, title: string|null}>}
 */
async function validateYouTube(videoId) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
  try {
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) {
      return { valid: false, title: null };
    }
    const data = await res.json();
    return { valid: true, title: data.title || null };
  } catch (err) {
    return { valid: false, title: null };
  }
}

module.exports = { validateYouTube };
