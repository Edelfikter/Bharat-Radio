'use strict';

/**
 * Estimate TTS audio duration based on text length.
 * @param {string} text
 * @returns {number} Duration in seconds
 */
function estimateTTSDuration(text) {
  if (!text) return 0;
  return text.length * 0.065;
}

module.exports = { estimateTTSDuration };
