/* ─── chat.js ───────────────────────────────────────────────── */
let _socket = null;
let _chatCollapsed = false;

function initChat() {
  _socket = io({ transports: ['websocket', 'polling'] });

  _socket.on('connect', () => {
    console.log('Chat connected');
  });

  _socket.on('chat:history', (messages) => {
    const list = document.getElementById('chat-messages');
    list.innerHTML = '';
    if (messages.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'chat-history-divider';
      divider.textContent = '── TRANSMISSION LOG ──';
      list.appendChild(divider);
      messages.forEach(msg => appendMessage(msg));
    }
    list.scrollTop = list.scrollHeight;
  });

  _socket.on('chat:message', (msg) => {
    appendMessage(msg);
    const list = document.getElementById('chat-messages');
    list.scrollTop = list.scrollHeight;
  });

  // Station events
  _socket.on('station:live', ({ id }) => {
    if (window.updateMarkerLive) window.updateMarkerLive(id, true);
    if (window.getCurrentStationId && window.getCurrentStationId() === id) {
      if (window.openStationPanel) window.openStationPanel(id);
    }
  });

  _socket.on('station:stop', ({ id }) => {
    if (window.updateMarkerLive) window.updateMarkerLive(id, false);
    if (window.getCurrentStationId && window.getCurrentStationId() === id) {
      if (window.stopPlayerSync) window.stopPlayerSync();
      if (window.openStationPanel) window.openStationPanel(id);
    }
  });

  // Chat input
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    const user = getCurrentUser();
    const username = user ? user.username : 'Anonymous';
    _socket.emit('chat:message', { username, message: text });
    input.value = '';
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
  if (_socket) _socket.emit('station:join', stationId);
}

function leaveStationRoom(stationId) {
  if (_socket) _socket.emit('station:leave', stationId);
}

window.initChat = initChat;
window.joinStationRoom = joinStationRoom;
window.leaveStationRoom = leaveStationRoom;
