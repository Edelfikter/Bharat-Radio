/* ─── station.js ────────────────────────────────────────────── */
let currentStationId = null;

async function openStationPanel(stationId) {
  currentStationId = stationId;
  if (window.stopPlayerSync) window.stopPlayerSync();
  const panel = document.getElementById('station-panel');
  panel.classList.remove('hidden');
  await loadStationDetail(stationId);
}

function closeStationPanel() {
  document.getElementById('station-panel').classList.add('hidden');
  if (window.stopPlayerSync) window.stopPlayerSync();
  currentStationId = null;
}

async function loadStationDetail(stationId) {
  try {
    const station = await apiFetch(`/api/stations/${stationId}`);
    renderStationDetail(station);
  } catch (e) {
    console.error('Failed to load station:', e);
  }
}

function renderStationDetail(station) {
  document.getElementById('sp-name').textContent = station.name;
  document.getElementById('sp-owner-val').textContent = station.owner_username;
  document.getElementById('sp-desc-val').textContent = station.description || '—';

  const statusEl = document.getElementById('sp-status-val');
  if (station.is_live) {
    statusEl.textContent = '● ON AIR';
    statusEl.className = 'status-live';
  } else {
    statusEl.textContent = 'OFFLINE';
    statusEl.className = 'status-offline';
  }

  const user = getCurrentUser();
  const isOwner = user && user.id === station.owner_id;
  const ownerControls = document.getElementById('owner-controls');
  const addSegForm = document.getElementById('add-segment-form');

  if (isOwner) {
    ownerControls.classList.remove('hidden');
    addSegForm.classList.remove('hidden');
    const liveBtn = document.getElementById('sp-btn-live');
    const stopBtn = document.getElementById('sp-btn-stop');
    if (station.is_live) {
      liveBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      liveBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  } else {
    ownerControls.classList.add('hidden');
    addSegForm.classList.add('hidden');
  }

  if (window.renderSegments) window.renderSegments(station.segments || [], isOwner, !!station.is_live);
  if (station.is_live && window.startPlayerSync) window.startPlayerSync(station.id);
}

function initStationPanel() {
  document.getElementById('station-panel-close').addEventListener('click', closeStationPanel);

  makeDraggable(
    document.getElementById('station-panel'),
    document.getElementById('station-panel-header')
  );

  document.getElementById('sp-btn-live').addEventListener('click', async () => {
    if (!currentStationId) return;
    try {
      const station = await apiFetch(`/api/stations/${currentStationId}/live`, { method: 'POST' });
      renderStationDetail(station);
      if (window.updateMarker) window.updateMarker(station);
    } catch (e) {
      alert('ERROR: ' + e.message);
    }
  });

  document.getElementById('sp-btn-stop').addEventListener('click', async () => {
    if (!currentStationId) return;
    try {
      const station = await apiFetch(`/api/stations/${currentStationId}/stop`, { method: 'POST' });
      renderStationDetail(station);
      if (window.stopPlayerSync) window.stopPlayerSync();
      if (window.updateMarker) window.updateMarker(station);
    } catch (e) {
      alert('ERROR: ' + e.message);
    }
  });

  document.getElementById('sp-btn-edit').addEventListener('click', () => {
    if (!currentStationId) return;
    openStationFormForEdit(currentStationId);
  });

  document.getElementById('sp-btn-delete').addEventListener('click', async () => {
    if (!currentStationId) return;
    if (!confirm('DELETE THIS STATION? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/stations/${currentStationId}`, { method: 'DELETE' });
      if (window.removeMarker) window.removeMarker(currentStationId);
      closeStationPanel();
    } catch (e) {
      alert('ERROR: ' + e.message);
    }
  });
}

// ─── Station create/edit form ─────────────────────────────────
function initStationForm() {
  const panel = document.getElementById('station-form-panel');
  const formTitle = document.getElementById('station-form-title');
  const submitBtn = document.getElementById('sf-submit');
  const closeBtn = document.getElementById('station-form-close');
  const errorEl = document.getElementById('station-form-error');

  makeDraggable(panel, document.getElementById('station-form-header'));

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
    if (window.cancelAddStationMode) window.cancelAddStationMode();
  });

  document.getElementById('btn-new-station').addEventListener('click', () => {
    formTitle.textContent = 'NEW STATION';
    document.getElementById('sf-station-id').value = '';
    document.getElementById('sf-name').value = '';
    document.getElementById('sf-desc').value = '';
    document.getElementById('sf-lat').value = '';
    document.getElementById('sf-lng').value = '';
    submitBtn.textContent = 'TRANSMIT';
    hideError(errorEl);
    panel.classList.remove('hidden');
  });

  // Map pick for coordinates
  document.getElementById('sf-lat').addEventListener('focus', promptMapPick);
  document.getElementById('sf-lng').addEventListener('focus', promptMapPick);

  function promptMapPick() {
    if (document.getElementById('sf-lat').value || document.getElementById('sf-lng').value) return;
    if (window.addStationMode) {
      window.addStationMode((lat, lng) => {
        document.getElementById('sf-lat').value = lat.toFixed(6);
        document.getElementById('sf-lng').value = lng.toFixed(6);
      });
    }
  }

  document.getElementById('map-pick-cancel').addEventListener('click', () => {
    if (window.cancelAddStationMode) window.cancelAddStationMode();
  });

  submitBtn.addEventListener('click', async () => {
    const stationId = document.getElementById('sf-station-id').value;
    const name = document.getElementById('sf-name').value.trim();
    const description = document.getElementById('sf-desc').value.trim();
    const lat = parseFloat(document.getElementById('sf-lat').value);
    const lng = parseFloat(document.getElementById('sf-lng').value);
    hideError(errorEl);

    if (!name) { showError(errorEl, 'Station name required'); return; }
    if (isNaN(lat) || isNaN(lng)) { showError(errorEl, 'Valid coordinates required'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'TRANSMITTING...';
    try {
      let station;
      if (stationId) {
        station = await apiFetch(`/api/stations/${stationId}`, {
          method: 'PUT',
          body: JSON.stringify({ name, description, lat, lng })
        });
      } else {
        station = await apiFetch('/api/stations', {
          method: 'POST',
          body: JSON.stringify({ name, description, lat, lng })
        });
      }
      panel.classList.add('hidden');
      if (window.updateMarker) window.updateMarker(station);
      openStationPanel(station.id);
    } catch (e) {
      showError(errorEl, e.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = stationId ? 'UPDATE' : 'TRANSMIT';
    }
  });
}

async function openStationFormForEdit(stationId) {
  const station = await apiFetch(`/api/stations/${stationId}`);
  document.getElementById('station-form-title').textContent = 'EDIT STATION';
  document.getElementById('sf-station-id').value = station.id;
  document.getElementById('sf-name').value = station.name;
  document.getElementById('sf-desc').value = station.description || '';
  document.getElementById('sf-lat').value = station.lat;
  document.getElementById('sf-lng').value = station.lng;
  document.getElementById('sf-submit').textContent = 'UPDATE';
  document.getElementById('station-form-panel').classList.remove('hidden');
}

window.openStationPanel = openStationPanel;
window.closeStationPanel = closeStationPanel;
window.initStationPanel = initStationPanel;
window.initStationForm = initStationForm;
window.getCurrentStationId = () => currentStationId;
