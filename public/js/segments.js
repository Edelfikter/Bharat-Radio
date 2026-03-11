/* ─── segments.js ───────────────────────────────────────────── */
let _segments = [];
let _isOwner = false;
let _stationLive = false;

function renderSegments(segments, isOwner, isLive) {
  _segments = segments;
  _isOwner = isOwner;
  _stationLive = isLive;

  const list = document.getElementById('segments-list');
  if (!segments || segments.length === 0) {
    list.innerHTML = '<div class="empty-state">NO SEGMENTS IN PLAYLIST</div>';
    return;
  }
  list.innerHTML = segments.map((seg, i) => buildSegmentHTML(seg, i, isOwner, isLive)).join('');
}

function buildSegmentHTML(seg, index, isOwner, isLive) {
  const typeClass = seg.type === 'youtube' ? 'youtube' : 'tts';
  const typeName = seg.type === 'youtube' ? 'YT' : 'TTS';
  const title = seg.type === 'youtube'
    ? (seg.youtube_title || seg.youtube_id || 'Unknown')
    : (seg.tts_text ? seg.tts_text.substring(0, 60) + (seg.tts_text.length > 60 ? '…' : '') : 'TTS');
  const dur = seg.duration_seconds ? formatTime(seg.duration_seconds) : '?:??';

  const controls = isOwner && !isLive ? `
    <div class="segment-controls">
      ${index > 0 ? `<button class="btn-terminal" onclick="moveSegment(${seg.id}, -1)">▲</button>` : ''}
      ${index < _segments.length - 1 ? `<button class="btn-terminal" onclick="moveSegment(${seg.id}, 1)">▼</button>` : ''}
      <button class="btn-terminal btn-danger" onclick="deleteSegment(${seg.id})">✕</button>
    </div>` : '';

  return `
    <div class="segment-item" data-seg-id="${seg.id}">
      <div class="segment-pos">${index + 1}</div>
      <div class="segment-info">
        <span class="segment-type-badge ${typeClass}">${typeName}</span>
        <div class="segment-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
        <div class="segment-duration">${dur}</div>
      </div>
      ${controls}
    </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function deleteSegment(segId) {
  const stationId = window.getCurrentStationId && window.getCurrentStationId();
  if (!stationId) return;
  if (!confirm('Remove this segment?')) return;
  try {
    await apiFetch(`/api/stations/${stationId}/segments/${segId}`, { method: 'DELETE' });
    await reloadSegments(stationId);
  } catch (e) {
    alert('ERROR: ' + e.message);
  }
}

async function moveSegment(segId, direction) {
  const stationId = window.getCurrentStationId && window.getCurrentStationId();
  if (!stationId) return;
  const idx = _segments.findIndex(s => s.id === segId);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= _segments.length) return;

  const newOrder = _segments.map(s => s.id);
  newOrder.splice(idx, 1);
  newOrder.splice(newIdx, 0, segId);

  try {
    const updated = await apiFetch(`/api/stations/${stationId}/segments/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ order: newOrder })
    });
    renderSegments(updated, _isOwner, _stationLive);
  } catch (e) {
    alert('ERROR: ' + e.message);
  }
}

async function reloadSegments(stationId) {
  try {
    const segments = await apiFetch(`/api/stations/${stationId}/segments`);
    renderSegments(segments, _isOwner, _stationLive);
    _segments = segments;
  } catch (e) {
    console.error('Failed to reload segments:', e);
  }
}

function highlightCurrentSegment(segmentIndex) {
  document.querySelectorAll('.segment-item').forEach((el, i) => {
    el.classList.toggle('currently-playing', i === segmentIndex);
  });
}

function initSegments() {
  const typeSelect = document.getElementById('seg-type');
  const ytFields = document.getElementById('seg-youtube-fields');
  const ttsFields = document.getElementById('seg-tts-fields');
  const validateBtn = document.getElementById('seg-yt-validate');
  const addBtn = document.getElementById('seg-add-btn');
  const errorEl = document.getElementById('seg-error');

  typeSelect.addEventListener('change', () => {
    const isYt = typeSelect.value === 'youtube';
    ytFields.classList.toggle('hidden', !isYt);
    ttsFields.classList.toggle('hidden', isYt);
  });

  let validatedYtId = null;
  let validatedYtTitle = null;
  let validatedYtDuration = null;

  validateBtn.addEventListener('click', async () => {
    const raw = document.getElementById('seg-yt-id').value.trim();
    const videoId = extractYouTubeId(raw);
    const resultEl = document.getElementById('seg-yt-result');
    if (!videoId) {
      resultEl.textContent = 'INVALID URL/ID';
      resultEl.style.color = 'var(--red)';
      validatedYtId = null;
      return;
    }
    validateBtn.disabled = true;
    validateBtn.textContent = 'VERIFYING...';
    resultEl.textContent = '';
    try {
      const data = await apiFetch(`/api/youtube/validate?v=${encodeURIComponent(videoId)}`);
      if (data.valid) {
        validatedYtId = videoId;
        validatedYtTitle = data.title;
        validatedYtDuration = null; // will use 0 as default, user can set
        resultEl.textContent = `✓ ${data.title}`;
        resultEl.style.color = 'var(--green)';
      } else {
        validatedYtId = null;
        resultEl.textContent = 'VIDEO NOT FOUND';
        resultEl.style.color = 'var(--red)';
      }
    } catch (e) {
      resultEl.textContent = 'VALIDATION ERROR';
      resultEl.style.color = 'var(--red)';
    } finally {
      validateBtn.disabled = false;
      validateBtn.textContent = 'VERIFY';
    }
  });

  addBtn.addEventListener('click', async () => {
    const stationId = window.getCurrentStationId && window.getCurrentStationId();
    if (!stationId) return;
    hideError(errorEl);
    const type = typeSelect.value;

    let body = { type };
    if (type === 'youtube') {
      if (!validatedYtId) { showError(errorEl, 'Verify a YouTube video first'); return; }
      body.youtube_id = validatedYtId;
      body.youtube_title = validatedYtTitle;
      body.duration_seconds = validatedYtDuration || 0;
    } else {
      const text = document.getElementById('seg-tts-text').value.trim();
      if (!text) { showError(errorEl, 'Enter text for TTS'); return; }
      body.tts_text = text;
      body.duration_seconds = text.length * 0.065;
    }

    addBtn.disabled = true;
    addBtn.textContent = 'ADDING...';
    try {
      await apiFetch(`/api/stations/${stationId}/segments`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      // Reset form
      document.getElementById('seg-yt-id').value = '';
      document.getElementById('seg-yt-result').textContent = '';
      document.getElementById('seg-tts-text').value = '';
      validatedYtId = null;
      validatedYtTitle = null;
      await reloadSegments(stationId);
    } catch (e) {
      showError(errorEl, e.message);
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'ADD TO PLAYLIST';
    }
  });
}

window.renderSegments = renderSegments;
window.deleteSegment = deleteSegment;
window.moveSegment = moveSegment;
window.highlightCurrentSegment = highlightCurrentSegment;
window.initSegments = initSegments;
