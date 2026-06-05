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

  function createActionsToggle() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-actions-toggle';
    button.setAttribute('aria-label', 'Abrir acciones');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span></span><span></span><span></span>';
    return button;
  }

  function createActionsWrap() {
    const wrap = document.createElement('div');
    wrap.className = 'admin-actions-wrap';
    wrap.appendChild(createActionsToggle());

    const menu = document.createElement('div');
    menu.className = 'admin-actions-menu';
    wrap.appendChild(menu);

    return wrap;
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
    const headerRight = header.querySelector('.header-right');
    let actionsWrap = null;
    let actionsToggle = null;
    let actionsMenu = null;
    let actionItems = [];

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

    function closeActionsMenu() {
      if (!actionsWrap || !actionsToggle) return;
      actionsWrap.classList.remove('open');
      actionsToggle.setAttribute('aria-expanded', 'false');
    }

    function toggleActionsMenu(event) {
      event.stopPropagation();
      if (!actionsWrap || !actionsToggle) return;
      const willOpen = !actionsWrap.classList.contains('open');
      actionsWrap.classList.toggle('open', willOpen);
      actionsToggle.setAttribute('aria-expanded', String(willOpen));
    }

    function isActionCandidate(element) {
      if (!element || element.classList.contains('admin-actions-wrap')) return false;
      if (element.classList.contains('header-date')) return false;
      if (element.classList.contains('live-clock')) return false;
      return element.matches('button, .notification-wrap, .btn, .admin-logout-header-btn');
    }

    function collectActionItems() {
      if (!headerRight) return;

      const known = new Set(actionItems.map(item => item.element));
      const newItems = Array.from(headerRight.children)
        .filter(isActionCandidate)
        .filter(element => !known.has(element))
        .map(element => ({
          element,
          parent: element.parentNode,
          nextSibling: element.nextSibling
        }));

      actionItems.push(...newItems);
    }

    function ensureActionsMenu() {
      if (!headerRight) return;

      collectActionItems();

      if (!actionsWrap) {
        actionsWrap = createActionsWrap();
        actionsToggle = actionsWrap.querySelector('.admin-actions-toggle');
        actionsMenu = actionsWrap.querySelector('.admin-actions-menu');
        actionsToggle.addEventListener('click', toggleActionsMenu);
        headerRight.appendChild(actionsWrap);
      }
    }

    function moveActionsToMenu() {
      ensureActionsMenu();
      if (!actionsMenu) return;

      actionItems.forEach(({ element }) => {
        element.classList.add('admin-actions-menu-item');
        actionsMenu.appendChild(element);
      });
    }

    function restoreActionsToHeader() {
      closeActionsMenu();

      actionItems.forEach(({ element, parent, nextSibling }) => {
        element.classList.remove('admin-actions-menu-item');
        if (nextSibling && nextSibling.parentNode === parent) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      });
    }

    function syncActionsLayout() {
      if (!headerRight) return;

      if (mediaQuery.matches) {
        moveActionsToMenu();
      } else {
        restoreActionsToHeader();
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
      if (event.key === 'Escape') closeActionsMenu();
    });

    document.addEventListener('click', event => {
      if (!actionsWrap || !actionsWrap.classList.contains('open')) return;
      if (!actionsWrap.contains(event.target)) closeActionsMenu();
    });

    if (headerRight) {
      headerRight.addEventListener('click', event => {
        if (!mediaQuery.matches || !actionsWrap || !actionsWrap.classList.contains('open')) return;
        const action = event.target.closest('.admin-actions-menu-item');
        if (!action || action.classList.contains('notification-wrap')) return;
        window.setTimeout(closeActionsMenu, 0);
      });
    }

    function handleViewportChange() {
      if (!mediaQuery.matches) closeSidebar();
      syncActionsLayout();
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleViewportChange);
    }

    syncActionsLayout();
    window.setTimeout(syncActionsLayout, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminLayout);
  } else {
    initAdminLayout();
  }
})();
