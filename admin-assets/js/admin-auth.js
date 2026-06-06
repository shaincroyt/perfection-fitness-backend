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
  const loginUrl = '/admin/login.html';
  const originalFetch = window.fetch.bind(window);
  let redirecting = false;

  function redirectToLogin() {
    if (redirecting) return;
    redirecting = true;
    window.location.replace(loginUrl);
  }

  window.AdminAuth = {
    apiBase: API_BASE,
    checkSession
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

    return response;
  };

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

      return true;
    } catch (error) {
      redirectToLogin();
      return false;
    }
  }

  checkSession();
})();
