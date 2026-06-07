(function () {
  const protectedPages = new Set([
    'dashboard.html',
    'clientes.html',
    'membresias.html',
    'validar.html',
    'asistencias.html',
    'planes.html',
    'configuracion.html',
    'nueva-membresia.html'
  ]);

  const pageName = window.location.pathname.split('/').pop();
  const isProtectedPage = protectedPages.has(pageName);

  if (!isProtectedPage) return;

  const API_BASE = '/api';
  const sessionUrl = `${API_BASE}/auth/session`;
  const heartbeatUrl = `${API_BASE}/auth/heartbeat`;
  const loginUrl = '/admin/login.html';
  const originalFetch = window.fetch.bind(window);
  let redirecting = false;
  let sessionData = null;
  let permissions = new Set();
  let permissionsVersion = null;
  let heartbeatTimer = null;

  function redirectToLogin() {
    if (redirecting) return;
    redirecting = true;
    window.location.replace(loginUrl);
  }

  window.AdminAuth = {
    apiBase: API_BASE,
    checkSession,
    applyPermissions,
    showAccessDenied,
    getSession: () => sessionData,
    getPermissions: () => Array.from(permissions),
    hasPermission: (codigo) => permissions.has(codigo)
  };

  window.fetch = async function adminFetch(input, init) {
    const options = init ? { ...init } : {};

    if (!options.credentials) {
      options.credentials = 'include';
    }

    const response = await originalFetch(input, options);

    if (response.status === 401) {
      redirectToLogin();
    }

    if (response.status === 403) {
      showAccessDenied();
    }

    return response;
  };

  function showSessionNotice(message) {
    let notice = document.getElementById('adminSessionNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'adminSessionNotice';
      notice.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;background:#111827;color:#fff;padding:13px 16px;border-radius:8px;box-shadow:0 18px 40px rgba(0,0,0,.22);font:600 13px/1.35 "DM Sans",Arial,sans-serif;max-width:320px;';
      document.body.appendChild(notice);
    }
    notice.textContent = message;
  }

  function showAccessDenied(message = 'No tienes permisos para realizar esta accion.') {
    let overlay = document.getElementById('adminAccessDeniedOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'adminAccessDeniedOverlay';
      overlay.className = 'admin-access-denied-overlay';
      overlay.innerHTML = `
        <div class="admin-access-denied-modal" role="dialog" aria-modal="true" aria-labelledby="adminAccessDeniedTitle">
          <div class="admin-access-denied-icon">!</div>
          <h2 id="adminAccessDeniedTitle">Acceso denegado</h2>
          <p id="adminAccessDeniedMessage"></p>
          <button type="button" id="adminAccessDeniedOk">Entendido</button>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.classList.remove('open');
      });
      overlay.querySelector('#adminAccessDeniedOk')?.addEventListener('click', () => {
        overlay.classList.remove('open');
      });
    }

    const text = overlay.querySelector('#adminAccessDeniedMessage');
    if (text) text.textContent = message;
    overlay.classList.add('open');
  }

  function applyPermissions(root = document) {
    const allowed = (codigo) => !codigo || permissions.has(codigo);

    root.querySelectorAll('[data-permission]').forEach(el => {
      const required = String(el.getAttribute('data-permission') || '').trim();
      el.hidden = !allowed(required);
    });

    const notificationWrap = root.querySelector('#notificationWrap');
    if (notificationWrap) {
      notificationWrap.hidden = !allowed('notificaciones.ver');
    }
  }

  async function checkSession() {
    try {
      const response = await originalFetch(sessionUrl, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      });

      if (response.status === 401) {
        redirectToLogin();
        return false;
      }

      if (!response.ok) {
        redirectToLogin();
        return false;
      }

      const data = await response.json();
      sessionData = data.admin || data;
      permissions = new Set(sessionData.permisos || data.permisos || []);
      applyPermissions();
      return sessionData;
    } catch (error) {
      redirectToLogin();
      return false;
    }
  }

  function heartbeatReasonMessage(reason) {
    if (reason === 'session_replaced') return 'Tu cuenta inicio sesion en otro dispositivo.';
    if (reason === 'user_disabled') return 'Tu cuenta fue desactivada.';
    if (reason === 'role_disabled') return 'Tu rol fue desactivado.';
    return 'Tu sesion ya no esta activa.';
  }

  async function heartbeat() {
    try {
      const response = await originalFetch(heartbeatUrl, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || data.valid === false) {
        showSessionNotice(heartbeatReasonMessage(data.reason));
        setTimeout(redirectToLogin, 1200);
        return;
      }

      if (!response.ok) return;

      if (permissionsVersion !== null && data.permissions_version !== permissionsVersion) {
        showSessionNotice('Tus permisos cambiaron. Vuelve a iniciar sesion.');
        await originalFetch(`${API_BASE}/logout`, {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
        setTimeout(redirectToLogin, 1200);
        return;
      }
      permissionsVersion = data.permissions_version;
    } catch (error) {
      console.warn('Heartbeat no disponible:', error);
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) applyPermissions(node);
      });
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
    checkSession().then(() => heartbeat());
    heartbeatTimer = heartbeatTimer || setInterval(heartbeat, 15000);
  });

  if (document.readyState !== 'loading') {
    observer.observe(document.body, { childList: true, subtree: true });
    checkSession().then(() => heartbeat());
    heartbeatTimer = heartbeatTimer || setInterval(heartbeat, 15000);
  }
})();
