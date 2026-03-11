/* ─── app.js ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  initAuth();
  initMap();
  initStationPanel();
  initStationForm();
  initSegments();
  initChat();

  // Load stats periodically
  loadStats();
  setInterval(loadStats, 30000);

  // Handle URL hash for direct station links
  if (window.location.hash && window.location.hash.startsWith('#station/')) {
    const stationId = parseInt(window.location.hash.split('/')[1], 10);
    if (stationId) {
      setTimeout(() => {
        if (window.openStationPanel) window.openStationPanel(stationId);
      }, 500);
    }
  }
});

async function loadStats() {
  try {
    const stats = await apiFetch('/api/stats');
    document.getElementById('stat-stations').textContent = `STATIONS: ${stats.stations_total}`;
    document.getElementById('stat-live').textContent = `LIVE: ${stats.stations_live}`;
    document.getElementById('stat-users').textContent = `USERS: ${stats.users_total}`;
    document.getElementById('stat-listeners').textContent = `ONLINE: ${stats.listeners_online}`;
  } catch (e) {
    // Silently fail stats
  }
}

// Helper: update marker live state without full reload
window.updateMarkerLive = function(stationId, isLive) {
  // Fetch station to get full data for marker update
  apiFetch(`/api/stations/${stationId}`)
    .then(station => {
      if (window.updateMarker) window.updateMarker(station);
    })
    .catch(() => {});
};
