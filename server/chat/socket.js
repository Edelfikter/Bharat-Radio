'use strict';

/**
 * Pusher event emitter — replaces Socket.io for Vercel serverless compatibility.
 * Pusher handles real-time delivery; the server triggers events via HTTP.
 */

let _pusher = null;

function getPusher() {
  if (_pusher) return _pusher;
  const Pusher = require('pusher');
  _pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER || 'mt1',
    useTLS: true,
  });
  return _pusher;
}

function triggerStationLive(stationId) {
  if (!process.env.PUSHER_APP_ID) return;
  try {
    getPusher().trigger('stations', 'station:live', { id: stationId });
  } catch (e) {
    console.error('[Pusher] triggerStationLive error:', e.message);
  }
}

function triggerStationStop(stationId) {
  if (!process.env.PUSHER_APP_ID) return;
  try {
    getPusher().trigger('stations', 'station:stop', { id: stationId });
  } catch (e) {
    console.error('[Pusher] triggerStationStop error:', e.message);
  }
}

function triggerChatMessage(payload) {
  if (!process.env.PUSHER_APP_ID) return;
  try {
    getPusher().trigger('global-chat', 'chat:message', payload);
  } catch (e) {
    console.error('[Pusher] triggerChatMessage error:', e.message);
  }
}

module.exports = { getPusher, triggerStationLive, triggerStationStop, triggerChatMessage };
