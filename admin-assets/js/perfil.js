(function () {
  const API_PERFIL = '/api/admin/perfil';
  const SESSION_KEY = 'adminSessionStartedAt';

  function ensureSessionFallback() {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, new Date().toISOString());
    }
  }

  function ensureStyles() {
    if (document.getElementById('adminProfileStyles')) return;

    const style = document.createElement('style');
    style.id = 'adminProfileStyles';
    style.textContent = `
      .profile-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(10, 12, 18, .42);
        backdrop-filter: blur(3px);
        z-index: 240;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }

      .profile-modal-overlay.open { display: flex; }

      .profile-modal {
        width: min(430px, 100%);
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e8e9ec);
        border-radius: 12px;
        box-shadow: 0 24px 70px rgba(0,0,0,.22);
        overflow: hidden;
        animation: profileModalIn .18s ease both;
      }

      @keyframes profileModalIn {
        from { opacity: 0; transform: translateY(10px) scale(.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .profile-modal-head {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 12px;
        padding: 18px 20px;
        border-bottom: 1px solid var(--border, #e8e9ec);
      }

      .profile-modal-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--red, #DD0F0D);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 800;
        flex-shrink: 0;
      }

      .profile-modal-title {
        font-size: 15px;
        font-weight: 800;
        color: var(--text-1, #1a1a1a);
        line-height: 1.2;
      }

      .profile-modal-subtitle {
        margin-top: 3px;
        font-size: 12px;
        color: var(--text-3, #9999a8);
      }

      .profile-modal-close {
        margin-left: auto;
        width: 32px;
        height: 32px;
        border: 1px solid var(--border, #e8e9ec);
        background: rgba(255, 255, 255, 0.035) !important;
        border-radius: 8px;
        cursor: pointer;
        color: var(--text-2);
        font-size: 20px;
        line-height: 1;
        flex-shrink: 0;
      }

      .profile-modal-close:hover {
        border-color: var(--red, #DD0F0D);
        color: var(--red, #DD0F0D);
      }

      .profile-modal-body { padding: 18px 20px 6px; display: flex;
    flex-direction: column;
    gap: 10px; }

      .profile-field {
        display: grid;
        grid-template-columns: 128px 1fr;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(232,233,236,.75);
        align-items: center;
      }

      .profile-field:last-child { border-bottom: 0; }

      .profile-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--text-3, #9999a8);
      }

      .profile-value {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-1, #1a1a1a);
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .profile-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: max-content;
        padding: 3px 9px;
        border-radius: 20px;
        color: var(--green, #16a34a);
        background: var(--green-bg, #dcfce7);
        font-size: 12px;
        font-weight: 800;
      }

      .profile-status::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      .profile-modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        padding: 16px 20px 20px;
      }

      .profile-secondary-btn,
      .profile-danger-btn {
        border: 0;
        border-radius: 8px;
        padding: 10px 13px;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      .profile-secondary-btn {
        color: var(--text-1, #1a1a1a);
        background: var(--bg, #f4f5f7);
        border: 1px solid var(--border, #e8e9ec);
      }

      .profile-danger-btn {
        color: #fff;
        background: var(--red, #DD0F0D);
      }

      .profile-error {
        display: none;
        margin: 0 20px 14px;
        padding: 10px 12px;
        border-radius: 8px;
        background: #fee2e2;
        color: #b91c1c;
        font-size: 12px;
        font-weight: 700;
      }

      .profile-error.visible { display: block; }

      @media (max-width: 520px) {
        .profile-field { grid-template-columns: 1fr; gap: 4px; }
        .profile-modal-actions { flex-direction: column; }
      }
    `;

    document.head.appendChild(style);
  }

  function initials(name) {
    return String(name || 'AD')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase() || 'AD';
  }

  function formatDate(value, fallback) {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function estadoTexto(estado) {
    return String(estado || 'activo').toLowerCase() === 'activo'
      ? 'Activo'
      : String(estado || 'Activo');
  }

  function ensureModal() {
    let overlay = document.getElementById('adminProfileOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'profile-modal-overlay';
    overlay.id = 'adminProfileOverlay';
    overlay.innerHTML = `
      <div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="adminProfileTitle">
        <div class="profile-modal-head">
          <div class="profile-modal-avatar" id="adminProfileAvatar">AD</div>
          <div>
            <div class="profile-modal-title" id="adminProfileTitle">Perfil</div>
            <div class="profile-modal-subtitle">Cuenta administrativa</div>
          </div>
          <button type="button" class="profile-modal-close" id="adminProfileClose" aria-label="Cerrar">&times;</button>
        </div>
        <div class="profile-modal-body">
          <div class="profile-field">
            <div class="profile-label">Nombre</div>
            <div class="profile-value" id="adminProfileNombre">Cargando...</div>
          </div>
          <div class="profile-field">
            <div class="profile-label">Usuario</div>
            <div class="profile-value" id="adminProfileUsuario">Cargando...</div>
          </div>
          <div class="profile-field">
            <div class="profile-label">Estado</div>
            <div class="profile-value"><span class="profile-status" id="adminProfileEstado">Activo</span></div>
          </div>
          <div class="profile-field">
            <div class="profile-label">Rol</div>
            <div class="profile-value" id="adminProfileRol">Administrador</div>
          </div>
          <div class="profile-field">
            <div class="profile-label">Fecha creación</div>
            <div class="profile-value" id="adminProfileCreacion">No registrada</div>
          </div>
          <div class="profile-field">
            <div class="profile-label">Último acceso</div>
            <div class="profile-value" id="adminProfileUltimo">Sesión actual</div>
          </div>
          <div class="profile-field">
            <div class="profile-label">Sesión iniciada</div>
            <div class="profile-value" id="adminProfileSesion">Cargando...</div>
          </div>
        </div>
        <div class="profile-error" id="adminProfileError">No se pudo cargar el perfil.</div>
        <div class="profile-modal-actions">
          <button type="button" class="profile-secondary-btn" id="adminProfilePassword">Cambiar contraseña</button>
          <button type="button" class="profile-danger-btn" id="adminProfileLogout">Cerrar sesión</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeProfileModal();
    });

    document.getElementById('adminProfileClose').addEventListener('click', closeProfileModal);
    document.getElementById('adminProfilePassword').addEventListener('click', () => {
      window.location.href = '/admin/configuracion.html';
    });
    document.getElementById('adminProfileLogout').addEventListener('click', () => {
      closeProfileModal();
      if (typeof window.openLogoutModal === 'function') {
        window.openLogoutModal();
      }
    });

    return overlay;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function cargarPerfil() {
    const error = document.getElementById('adminProfileError');
    if (error) error.classList.remove('visible');

    try {
      const res = await fetch(API_PERFIL, { credentials: 'include' });

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      if (!res.ok) {
        throw new Error('No se pudo cargar el perfil');
      }

      const perfil = await res.json();
      const sesion = perfil.sesion_iniciada || sessionStorage.getItem(SESSION_KEY);

      setText('adminProfileAvatar', initials(perfil.nombre));
      setText('adminProfileTitle', perfil.nombre || 'Administrador');
      setText('adminProfileNombre', perfil.nombre || 'Administrador');
      setText('adminProfileUsuario', perfil.usuario || '-');
      setText('adminProfileEstado', estadoTexto(perfil.estado));
      setText('adminProfileRol', perfil.rol || 'Recepción');
      setText('adminProfileCreacion', formatDate(perfil.fecha_creacion, 'No registrada'));
      setText('adminProfileUltimo', formatDate(perfil.ultimo_acceso, 'Sesión actual'));
      setText('adminProfileSesion', formatDate(sesion, 'Sesión actual'));
    } catch (err) {
      console.error(err);
      if (error) error.classList.add('visible');
    }
  }

  function openProfileModal() {
    ensureStyles();
    ensureSessionFallback();
    const overlay = ensureModal();
    overlay.classList.add('open');
    cargarPerfil();
  }

  function closeProfileModal() {
    const overlay = document.getElementById('adminProfileOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  function profileIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
  }

  function ensureProfileButtons() {
    const existing = Array.from(document.querySelectorAll('button'))
      .filter(button => button.getAttribute('title') === 'Perfil' || button.classList.contains('admin-profile-trigger'));

    existing.forEach(button => {
      button.type = 'button';
      button.classList.add('admin-profile-trigger');
    });

    document.querySelectorAll('.header-right').forEach(header => {
      if (header.querySelector('.admin-profile-trigger')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'header-btn admin-profile-trigger';
      button.title = 'Perfil';
      button.innerHTML = profileIcon();

      const notification = header.querySelector('.notification-wrap');
      const primaryButton = header.querySelector('.btn-primary');

      if (notification && notification.nextSibling) {
        header.insertBefore(button, notification.nextSibling);
      } else if (primaryButton) {
        header.insertBefore(button, primaryButton);
      } else {
        header.appendChild(button);
      }
    });

    document.querySelectorAll('.admin-profile-trigger').forEach(button => {
      if (button.dataset.profileBound === 'true') return;
      button.dataset.profileBound = 'true';
      button.addEventListener('click', openProfileModal);
    });
  }

  function initProfile() {
    ensureSessionFallback();
    ensureStyles();
    ensureProfileButtons();
    ensureModal();
  }

  window.openProfileModal = openProfileModal;
  window.closeProfileModal = closeProfileModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfile);
  } else {
    initProfile();
  }
})();
