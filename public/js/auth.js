/* ─── auth.js ───────────────────────────────────────────────── */
let _currentUser = null;

function getCurrentUser() { return _currentUser; }

function setAuthUI(user) {
  _currentUser = user;
  const loginBtn = document.getElementById('btn-login');
  const registerBtn = document.getElementById('btn-register');
  const logoutBtn = document.getElementById('btn-logout');
  const newStationBtn = document.getElementById('btn-new-station');
  const userDisplay = document.getElementById('auth-user-display');

  if (user) {
    loginBtn.classList.add('hidden');
    registerBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    newStationBtn.classList.remove('hidden');
    userDisplay.textContent = `▶ ${user.username}`;
  } else {
    loginBtn.classList.remove('hidden');
    registerBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    newStationBtn.classList.add('hidden');
    userDisplay.textContent = '';
  }
}

function logout() {
  localStorage.removeItem('token');
  setAuthUI(null);
  if (window.refreshStations) window.refreshStations();
}

async function verifyToken() {
  const token = localStorage.getItem('token');
  if (!token) { setAuthUI(null); return; }
  try {
    const user = await apiFetch('/api/auth/me');
    setAuthUI(user);
  } catch (e) {
    localStorage.removeItem('token');
    setAuthUI(null);
  }
}

function initAuth() {
  const modal = document.getElementById('auth-modal');
  const loginBtn = document.getElementById('btn-login');
  const registerBtn = document.getElementById('btn-register');
  const logoutBtn = document.getElementById('btn-logout');
  const closeBtn = document.getElementById('auth-modal-close');
  const submitBtn = document.getElementById('auth-submit');
  const modeSwitchBtn = document.getElementById('auth-mode-btn');
  const modalTitle = document.getElementById('auth-modal-title');
  const switchText = document.getElementById('auth-switch-text');
  const errorEl = document.getElementById('auth-error');

  let mode = 'login'; // or 'register'

  function openModal(m) {
    mode = m;
    modalTitle.textContent = m === 'login' ? 'LOGIN' : 'REGISTER';
    switchText.textContent = m === 'login' ? 'No account? ' : 'Have an account? ';
    modeSwitchBtn.textContent = m === 'login' ? 'REGISTER' : 'LOGIN';
    submitBtn.textContent = m === 'login' ? 'AUTHENTICATE' : 'ENLIST';
    hideError(errorEl);
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('auth-username').focus(), 50);
  }

  function closeModal() { modal.classList.add('hidden'); }

  loginBtn.addEventListener('click', () => openModal('login'));
  registerBtn.addEventListener('click', () => openModal('register'));
  closeBtn.addEventListener('click', closeModal);
  logoutBtn.addEventListener('click', logout);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modeSwitchBtn.addEventListener('click', () => {
    openModal(mode === 'login' ? 'register' : 'login');
  });

  submitBtn.addEventListener('click', async () => {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    hideError(errorEl);
    if (!username) { showError(errorEl, 'Callsign required'); return; }
    if (!password) { showError(errorEl, 'Passphrase required'); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'CONNECTING...';
    try {
      const data = await apiFetch(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem('token', data.token);
      setAuthUI({ id: data.id, username: data.username });
      closeModal();
      if (window.refreshStations) window.refreshStations();
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'AUTHENTICATE' : 'ENLIST';
    }
  });

  // Allow enter key in inputs
  ['auth-username', 'auth-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBtn.click();
    });
  });

  verifyToken();
}

window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.initAuth = initAuth;
