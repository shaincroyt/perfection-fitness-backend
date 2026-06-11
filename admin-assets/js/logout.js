(function () {
  const API_LOGOUT = '/api/logout';

  function ensureModal() {
    let overlay = document.getElementById('logoutModalOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'logout-modal-overlay';
    overlay.id = 'logoutModalOverlay';
    overlay.innerHTML = `
      <div class="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logoutModalTitle">
        <div class="logout-modal-header">
          <div class="logout-modal-title" id="logoutModalTitle">Cerrar sesión</div>
        </div>
        <div class="logout-modal-body">
          <p class="logout-modal-text">¿Seguro que deseas cerrar sesión?</p>
          <div class="logout-error" id="logoutError">Error al cerrar sesión</div>
        </div>
        <div class="logout-modal-actions">
          <button type="button" class="logout-cancel-btn" id="logoutCancelBtn">Cancelar</button>
          <button type="button" class="logout-confirm-btn" id="logoutConfirmBtn">Cerrar sesión</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeLogoutModal();
    });

    document.getElementById('logoutCancelBtn').addEventListener('click', closeLogoutModal);
    document.getElementById('logoutConfirmBtn').addEventListener('click', confirmarLogout);

    return overlay;
  }

  function openLogoutModal() {
    const overlay = ensureModal();
    const error = document.getElementById('logoutError');
    const confirm = document.getElementById('logoutConfirmBtn');

    if (error) error.classList.remove('visible');
    if (confirm) {
      confirm.disabled = false;
      confirm.textContent = 'Cerrar sesión';
    }

    overlay.classList.add('open');
  }

  function closeLogoutModal() {
    const overlay = document.getElementById('logoutModalOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  async function confirmarLogout() {
    const error = document.getElementById('logoutError');
    const confirm = document.getElementById('logoutConfirmBtn');

    if (error) error.classList.remove('visible');
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = 'Cerrando...';
    }

    try {
      const res = await fetch(API_LOGOUT, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Logout failed');
      }

      window.location.href = '/admin/';
    } catch (err) {
      console.error(err);
      if (error) error.classList.add('visible');
      if (confirm) {
        confirm.disabled = false;
        confirm.textContent = 'Cerrar sesión';
      }
    }
  }

  function bindLogoutButtons() {
    document.querySelectorAll('.admin-logout-trigger').forEach(button => {
      if (button.dataset.logoutBound === 'true') return;
      button.dataset.logoutBound = 'true';
      button.addEventListener('click', openLogoutModal);
    });
  }

  function initLogout() {
    document.querySelectorAll('.sidebar-user').forEach(el => {
      el.classList.add('admin-session-box');
    });
    bindLogoutButtons();
    ensureModal();
  }

  window.openLogoutModal = openLogoutModal;
  window.closeLogoutModal = closeLogoutModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogout);
  } else {
    initLogout();
  }
})();
