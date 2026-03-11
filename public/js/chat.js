/* ─── chat.js ───────────────────────────────────────────────── */
let _pusher = null;
let _chatCollapsed = false;

async function initChat() {
  // Fetch Pusher config from server
  let pusherKey = '';
  let pusherCluster = 'mt1';
  try {
    const config = await apiFetch('/api/config');
    pusherKey = config.pusherKey;
    pusherCluster = config.pusherCluster;
  } catch (e) {
    console.warn('Could not fetch Pusher config:', e.message);
  }

  // Load chat history via HTTP
  try {
    const history = await apiFetch('/api/chat/history');
    const list = document.getElementById('chat-messages');
    list.innerHTML = '';
    if (history.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'chat-history-divider';
      divider.textContent = '── TRANSMISSION LOG ──';
      list.appendChild(divider);
      history.forEach(msg => appendMessage(msg));
    }
    list.scrollTop = list.scrollHeight;
  } catch (e) {
    console.warn('Could not load chat history:', e.message);
  }

  // Connect to Pusher for real-time events
  if (pusherKey && typeof Pusher !== 'undefined') {
    _pusher = new Pusher(pusherKey, { cluster: pusherCluster });

    const chatChannel = _pusher.subscribe('global-chat');
    chatChannel.bind('chat:message', (msg) => {
      appendMessage(msg);
      const list = document.getElementById('chat-messages');
      list.scrollTop = list.scrollHeight;
    });

    const stationsChannel = _pusher.subscribe('stations');
    stationsChannel.bind('station:live', ({ id }) => {
      if (window.updateMarkerLive) window.updateMarkerLive(id, true);
      if (window.getCurrentStationId && window.getCurrentStationId() === id) {
        if (window.openStationPanel) window.openStationPanel(id);
      }
    });
    stationsChannel.bind('station:stop', ({ id }) => {
      if (window.updateMarkerLive) window.updateMarkerLive(id, false);
      if (window.getCurrentStationId && window.getCurrentStationId() === id) {
        if (window.stopPlayerSync) window.stopPlayerSync();
        if (window.openStationPanel) window.openStationPanel(id);
      }
    });
  } else {
    console.warn('Pusher not available — real-time features disabled.');
  }

  // Chat input
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    const user = getCurrentUser();
    const username = user ? user.username : 'Anonymous';
    input.value = '';
    try {
      await apiFetch('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({ username, message: text }),
      });
    } catch (e) {
      console.warn('Failed to send message:', e.message);
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Toggle collapse
  const chatPanel = document.getElementById('chat-panel');
  document.getElementById('chat-toggle').addEventListener('click', () => {
    _chatCollapsed = !_chatCollapsed;
    chatPanel.classList.toggle('collapsed', _chatCollapsed);
  });

  // Make draggable
  makeDraggable(chatPanel, document.getElementById('chat-header'));
}

function appendMessage(msg) {
  const list = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  const time = msg.created_at ? formatTimestamp(msg.created_at) : '';
  div.innerHTML = `<span class="chat-msg-user">[${escapeHtmlChat(msg.username)}]</span><span class="chat-msg-text">${escapeHtmlChat(msg.message)}</span><span class="chat-msg-time">${time}</span>`;
  list.appendChild(div);
}

function escapeHtmlChat(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function joinStationRoom(stationId) {
  // No-op with Pusher — all clients receive all station events via the 'stations' channel
}

function leaveStationRoom(stationId) {
  // No-op with Pusher
}

window.initChat = initChat;
window.joinStationRoom = joinStationRoom;
window.leaveStationRoom = leaveStationRoom;
