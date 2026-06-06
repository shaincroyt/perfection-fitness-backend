(function () {
  let notificacionesPrevias = new Set();
  let notificacionesInicializadas = false;
  let notificationToastTimer = null;

  function notificationId(n) {
    return String(n.id || [n.tipo, n.entidad || '', n.entidad_id || '', n.fecha_creacion || ''].join('|'));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fechaNotificacion(value) {
    if (!value) return '';
    const fecha = new Date(value);
    if (Number.isNaN(fecha.getTime())) return String(value);

    const diff = Date.now() - fecha.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return 'Hace ' + min + ' min';
    const horas = Math.floor(min / 60);
    if (horas < 24) return 'Hace ' + horas + ' h';

    return fecha.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function ensureNotificationActions() {
    const head = document.querySelector('#notificationPopover .notification-head');
    if (!head || document.getElementById('markAllNotificationsBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'notification-mark-all';
    btn.id = 'markAllNotificationsBtn';
    btn.textContent = 'Marcar todas';
    btn.addEventListener('click', event => {
      event.stopPropagation();
      marcarTodasNotificaciones();
    });
    head.appendChild(btn);
  }

  function mostrarToastNotificacion(notificacion) {
    let toast = document.getElementById('notificationToast');

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'notificationToast';
      toast.className = 'notification-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      Nueva notificacion: ${escapeHtml(notificacion.titulo)}
      <span>${escapeHtml(notificacion.mensaje || '')}</span>
    `;

    toast.classList.add('show');
    clearTimeout(notificationToastTimer);
    notificationToastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3600);
  }

  async function cargarNotificaciones() {
    const wrap = document.getElementById('notificationWrap');
    if (!wrap) return;

    ensureNotificationActions();

    try {
      const res = await fetch('/api/notificaciones');
      if (!res.ok) throw new Error('Error al obtener notificaciones');

      const data = await res.json();
      const notificaciones = Array.isArray(data)
        ? data
        : Array.isArray(data.notificaciones) ? data.notificaciones : [];
      const totalNoLeidas = Array.isArray(data)
        ? notificaciones.filter(n => !Number(n.leida)).length
        : Number(data.total_no_leidas || 0);
      const count = document.getElementById('notifCount');
      const total = document.getElementById('notificationTotal');
      const list = document.getElementById('notificationList');
      const markAll = document.getElementById('markAllNotificationsBtn');
      const idsActuales = new Set(notificaciones.map(notificationId));

      if (notificacionesInicializadas) {
        const nueva = notificaciones.find(n => !Number(n.leida) && !notificacionesPrevias.has(notificationId(n)));
        if (nueva) mostrarToastNotificacion(nueva);
      }

      notificacionesPrevias = idsActuales;
      notificacionesInicializadas = true;

      count.classList.remove('loading-value');
      total.classList.remove('loading-value');
      count.style.display = totalNoLeidas > 0 ? 'flex' : 'none';
      count.textContent = totalNoLeidas > 9 ? '9+' : totalNoLeidas;
      total.textContent = totalNoLeidas === 1 ? '1 no leida' : totalNoLeidas + ' no leidas';
      if (markAll) markAll.disabled = totalNoLeidas === 0;

      if (notificaciones.length === 0) {
        list.innerHTML = '<div class="notification-empty">No hay notificaciones pendientes</div>';
        return;
      }

      list.innerHTML = notificaciones.map(n => `
        <div class="notification-item ${escapeHtml(n.tipo)} ${Number(n.leida) ? 'is-read' : 'is-unread'}">
          <span class="notification-mark"></span>
          <div class="notification-item-body">
            <div class="notification-item-title-row">
              <div class="notification-item-title">${escapeHtml(n.titulo)}</div>
              <span class="notification-read-state">${Number(n.leida) ? 'Leida' : 'Nueva'}</span>
            </div>
            <div class="notification-item-msg">${escapeHtml(n.mensaje)}</div>
            <div class="notification-item-meta">${escapeHtml(fechaNotificacion(n.fecha_creacion))}${n.usuario_nombre ? ' - ' + escapeHtml(n.usuario_nombre) : ''}</div>
            ${Number(n.leida) ? '' : `<button type="button" class="notification-read-btn" onclick="marcarNotificacionLeida(${Number(n.id)})">Marcar como leida</button>`}
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error notificaciones:', error);
      const count = document.getElementById('notifCount');
      const total = document.getElementById('notificationTotal');
      const list = document.getElementById('notificationList');
      if (count) {
        count.classList.remove('loading-value');
        count.style.display = 'none';
      }
      if (total) {
        total.classList.remove('loading-value');
        total.textContent = 'No disponible';
      }
      if (list) list.innerHTML = '<div class="notification-empty">Error al cargar notificaciones</div>';
    }
  }

  async function marcarNotificacionLeida(id) {
    try {
      const res = await fetch(`/api/notificaciones/${id}/leida`, { method: 'PUT' });
      if (!res.ok) throw new Error('Error al marcar notificacion');
      await cargarNotificaciones();
    } catch (error) {
      console.error(error);
    }
  }

  async function marcarTodasNotificaciones() {
    try {
      const res = await fetch('/api/notificaciones/leidas', { method: 'PUT' });
      if (!res.ok) throw new Error('Error al marcar notificaciones');
      await cargarNotificaciones();
    } catch (error) {
      console.error(error);
    }
  }

  function toggleNotificaciones(event) {
    event.stopPropagation();
    document.getElementById('notificationPopover')?.classList.toggle('open');
  }

  function initNotifications() {
    document.addEventListener('click', event => {
      const wrap = document.getElementById('notificationWrap');
      const popover = document.getElementById('notificationPopover');

      if (popover && wrap && !wrap.contains(event.target)) {
        popover.classList.remove('open');
      }
    });

    cargarNotificaciones();
    setInterval(cargarNotificaciones, 30000);
  }

  window.toggleNotificaciones = toggleNotificaciones;
  window.marcarNotificacionLeida = marcarNotificacionLeida;
  window.marcarTodasNotificaciones = marcarTodasNotificaciones;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifications);
  } else {
    initNotifications();
  }
})();
