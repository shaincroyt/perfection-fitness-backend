(function () {
  const MOBILE_QUERY = '(max-width: 1024px)';

  function createMenuButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-menu-toggle';
    button.setAttribute('aria-label', 'Abrir menu');
    button.setAttribute('aria-controls', 'adminSidebar');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span></span><span></span><span></span>';
    return button;
  }

  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-sidebar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    return overlay;
  }

  function initAdminLayout() {
    const body = document.body;
    const header = document.querySelector('.header');
    const sidebar = document.querySelector('.sidebar');

    if (!body.classList.contains('admin-page') || !header || !sidebar) {
      return;
    }

    sidebar.id = sidebar.id || 'adminSidebar';

    let menuButton = document.querySelector('.admin-menu-toggle');
    if (!menuButton) {
      menuButton = createMenuButton();
      header.insertBefore(menuButton, header.firstElementChild);
    }

    let overlay = document.querySelector('.admin-sidebar-overlay');
    if (!overlay) {
      overlay = createOverlay();
      document.body.appendChild(overlay);
    }

    const mediaQuery = window.matchMedia(MOBILE_QUERY);

    function openSidebar() {
      if (!mediaQuery.matches) return;
      body.classList.add('admin-sidebar-open');
      menuButton.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
      body.classList.remove('admin-sidebar-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }

    function toggleSidebar() {
      if (body.classList.contains('admin-sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    }

    menuButton.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeSidebar);

    sidebar.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (mediaQuery.matches) closeSidebar();
      });
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeSidebar();
    });

    function handleViewportChange() {
      if (!mediaQuery.matches) closeSidebar();
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleViewportChange);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminLayout);
  } else {
    initAdminLayout();
  }
})();
