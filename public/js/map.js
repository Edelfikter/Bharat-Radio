/* ─── map.js ────────────────────────────────────────────────── */
let map = null;
let markers = {};
let pickingLocation = false;
let pickCallback = null;

function initMap() {
  map = L.map('map', {
    center: [20.5937, 78.9629],
    zoom: 5,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  map.on('click', (e) => {
    if (pickingLocation && pickCallback) {
      pickCallback(e.latlng.lat, e.latlng.lng);
    }
  });

  loadStations();
}

function createMarkerIcon(isLive) {
  return L.divIcon({
    className: '',
    html: `<div class="station-marker ${isLive ? 'is-live' : ''}"><div class="marker-dot"></div></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

async function loadStations() {
  try {
    const stations = await apiFetch('/api/stations');
    // Remove old markers
    Object.values(markers).forEach(m => m.remove());
    markers = {};

    stations.forEach(station => {
      const icon = createMarkerIcon(!!station.is_live);
      const marker = L.marker([station.lat, station.lng], { icon })
        .addTo(map)
        .bindTooltip(station.name, { permanent: false, direction: 'top' });

      marker.on('click', () => {
        if (pickingLocation) return;
        if (window.openStationPanel) window.openStationPanel(station.id);
      });

      markers[station.id] = marker;
    });
  } catch (e) {
    console.error('Failed to load stations:', e);
  }
}

function refreshStations() {
  loadStations();
}

function addStationMode(callback) {
  pickingLocation = true;
  pickCallback = (lat, lng) => {
    pickingLocation = false;
    pickCallback = null;
    document.body.classList.remove('picking-location');
    document.getElementById('map-pick-hint').classList.add('hidden');
    callback(lat, lng);
  };
  document.body.classList.add('picking-location');
  document.getElementById('map-pick-hint').classList.remove('hidden');
}

function cancelAddStationMode() {
  pickingLocation = false;
  pickCallback = null;
  document.body.classList.remove('picking-location');
  document.getElementById('map-pick-hint').classList.add('hidden');
}

function updateMarker(station) {
  if (markers[station.id]) {
    markers[station.id].remove();
    delete markers[station.id];
  }
  const icon = createMarkerIcon(!!station.is_live);
  const marker = L.marker([station.lat, station.lng], { icon })
    .addTo(map)
    .bindTooltip(station.name, { permanent: false, direction: 'top' });
  marker.on('click', () => {
    if (pickingLocation) return;
    if (window.openStationPanel) window.openStationPanel(station.id);
  });
  markers[station.id] = marker;
}

function removeMarker(stationId) {
  if (markers[stationId]) {
    markers[stationId].remove();
    delete markers[stationId];
  }
}

window.initMap = initMap;
window.refreshStations = refreshStations;
window.addStationMode = addStationMode;
window.cancelAddStationMode = cancelAddStationMode;
window.updateMarker = updateMarker;
window.removeMarker = removeMarker;
