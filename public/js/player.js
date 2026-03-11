/* ─── player.js ─────────────────────────────────────────────── */
let _syncInterval = null;
let _currentStationId = null;
let _ttsUtterance = null;
let _lastSegmentId = null;
let _ytPlayer = null;

function startPlayerSync(stationId) {
  stopPlayerSync();
  _currentStationId = stationId;
  pollNow();
  _syncInterval = setInterval(pollNow, 5000);
}

function stopPlayerSync() {
  if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
  _currentStationId = null;
  _lastSegmentId = null;
  hideNowPlaying();
  stopTTS();
  clearYtEmbed();
}

async function pollNow() {
  if (!_currentStationId) return;
  try {
    const data = await apiFetch(`/api/stations/${_currentStationId}/now`);
    if (!data.live || !data.segment) {
      hideNowPlaying();
      stopTTS();
      clearYtEmbed();
      return;
    }
    showNowPlaying(data);
  } catch (e) {
    console.error('Player sync error:', e);
  }
}

function showNowPlaying(data) {
  const section = document.getElementById('now-playing-section');
  section.classList.remove('hidden');

  const seg = data.segment;
  const pos = data.position_seconds || 0;
  const total = seg.duration_seconds || 1;
  const pct = Math.min(100, (pos / total) * 100);

  document.getElementById('np-progress-fill').style.width = `${pct}%`;
  document.getElementById('np-time').textContent = `${formatTime(pos)} / ${formatTime(total)}`;

  if (window.highlightCurrentSegment) window.highlightCurrentSegment(data.segment_index);

  const segChanged = seg.id !== _lastSegmentId;
  _lastSegmentId = seg.id;

  if (seg.type === 'youtube') {
    document.getElementById('np-segment-title').textContent = `▶ ${seg.youtube_title || seg.youtube_id}`;
    stopTTS();
    if (segChanged) {
      showYtEmbed(seg.youtube_id, Math.floor(pos));
    }
  } else if (seg.type === 'tts') {
    document.getElementById('np-segment-title').textContent = `🔊 TTS`;
    clearYtEmbed();
    if (segChanged) {
      speakTTS(seg.tts_text, pos);
    }
  }
}

function hideNowPlaying() {
  document.getElementById('now-playing-section').classList.add('hidden');
  document.getElementById('np-progress-fill').style.width = '0%';
  document.getElementById('np-time').textContent = '';
  document.getElementById('np-segment-title').textContent = '';
}

function showYtEmbed(videoId, startSeconds) {
  clearYtEmbed();
  // Basic validation: YouTube IDs are 11 alphanumeric chars
  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) return;
  const container = document.getElementById('np-youtube-embed');
  const safeId = encodeURIComponent(videoId);
  const safeStart = Math.max(0, Math.floor(startSeconds));
  const src = `https://www.youtube.com/embed/${safeId}?autoplay=1&start=${safeStart}&enablejsapi=1`;
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  container.appendChild(iframe);
}

function clearYtEmbed() {
  document.getElementById('np-youtube-embed').innerHTML = '';
  _ytPlayer = null;
}

function speakTTS(text, offsetSeconds) {
  stopTTS();
  if (!window.speechSynthesis || !text) return;
  // Approximate character offset based on rate
  const charsPerSec = 1 / 0.065;
  const charOffset = Math.floor(offsetSeconds * charsPerSec);
  const slicedText = text.slice(Math.max(0, charOffset - 5));

  _ttsUtterance = new SpeechSynthesisUtterance(slicedText);
  _ttsUtterance.rate = 1.0;
  _ttsUtterance.lang = 'en-IN';
  window.speechSynthesis.speak(_ttsUtterance);
}

function stopTTS() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  _ttsUtterance = null;
}

window.startPlayerSync = startPlayerSync;
window.stopPlayerSync = stopPlayerSync;
