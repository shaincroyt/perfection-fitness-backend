(function () {
  const API_URL = '/api';
  const BASE_ROLES = [
    { id: 'recepcion', codigo: 'recepcion', nombre: 'Recepcion', descripcion: 'Gestiona ingresos y atencion al cliente.', estado: 'activo', sistema: true, usuarios: 0, permisos: 0 },
    { id: 'admin', codigo: 'admin', nombre: 'Administrador', descripcion: 'Acceso total al sistema.', estado: 'activo', sistema: true, usuarios: 0, permisos: 0 }
  ];

  // Descripciones legibles por humanos para cada permiso
  // El backend puede traer su propia descripcion; este mapa es el fallback
  const PERMISOS_DESCRIPCIONES = {
    'clientes.ver': 'Permite ver la lista de clientes registrados.',
    'clientes.crear': 'Permite registrar nuevos clientes en el sistema.',
    'clientes.editar': 'Permite modificar datos de clientes existentes.',
    'clientes.eliminar': 'Permite eliminar o desactivar clientes registrados.',
    'membresias.ver': 'Permite ver las membresías creadas y su estado.',
    'membresias.crear': 'Permite crear nuevas membresías y generar códigos de acceso.',
    'membresias.editar': 'Permite modificar datos de una membresía existente.',
    'membresias.eliminar': 'Permite eliminar o desactivar membresías registradas.',
    'membresias.renovar': 'Permite renovar membresías inactivas cuando corresponda.',
    'planes.ver': 'Permite consultar los planes disponibles del gimnasio.',
    'planes.crear': 'Permite crear nuevos planes de membresía.',
    'planes.editar': 'Permite modificar precios, duración y asistencias de los planes.',
    'planes.eliminar': 'Permite eliminar o desactivar planes del sistema.',
    'asistencias.ver': 'Permite revisar el historial de ingresos y asistencias.',
    'asistencias.eliminar': 'Permite eliminar asistencias registradas por error.',
    'validacion.usar': 'Permite validar códigos de membresía y registrar ingresos al gimnasio.',
    'dashboard.ver': 'Permite acceder al resumen general del gimnasio.',
    'configuracion.ver': 'Permite entrar a la configuración del sistema.',
    'usuarios.ver': 'Permite ver los usuarios administrativos registrados.',
    'usuarios.crear': 'Permite crear nuevos usuarios administrativos.',
    'usuarios.editar': 'Permite modificar datos y rol de usuarios administrativos.',
    'usuarios.desactivar': 'Permite activar o desactivar usuarios del sistema.',
    'roles.ver': 'Permite ver los roles y permisos del sistema.',
    'roles.crear': 'Permite crear roles personalizados para el personal.',
    'roles.editar': 'Permite modificar nombre, descripción y estado de roles.',
    'roles.eliminar': 'Permite eliminar o desactivar roles personalizados.',
    'roles.asignar_permisos': 'Permite asignar o quitar permisos a los roles.',
    'exportar.clientes': 'Permite descargar reportes de clientes.',
    'exportar.membresias': 'Permite descargar reportes de membresías.',
    'exportar.asistencias': 'Permite descargar reportes de asistencias.',
    'notificaciones.ver': 'Permite ver las notificaciones del sistema.',
    'notificaciones.marcar_leida': 'Permite marcar notificaciones como revisadas.',
    'notificaciones.eliminar': 'Permite eliminar notificaciones del panel.'
  };

  const state = {
    currentUser: null,
    usuarios: [],
    permisos: [],
    permisosAgrupados: {},
    permisosRol: new Set(),       // Para el modal de "Ver permisos" independiente
    modalPermisos: new Set(),     // Para el modal de crear/editar rol (permisos seleccionados)
    modalPermissionQuery: '',
    roles: BASE_ROLES,
    selectedRole: 'recepcion',
    permissionQuery: ''
  };

  const $ = (id) => document.getElementById(id);

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function roleLabel(role) {
    const found = state.roles.find(item => (item.codigo || item.id) === role);
    if (found) return found.nombre;
    if (role === 'admin') return 'Administrador';
    if (role === 'recepcion') return 'Recepcion';
    return role || 'Recepcion';
  }

  function hasPermission(codigo) {
    if (state.currentUser?.rol === 'admin') return true;
    return Array.isArray(state.currentUser?.permisos) && state.currentUser.permisos.includes(codigo);
  }

  function formatDate(value) {
    if (!value) return 'No registrado';
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

  function showMessage(prefix, type, text) {
    const success = $(`${prefix}Success`);
    const error = $(`${prefix}Error`);

    if (success) success.classList.remove('visible');
    if (error) error.classList.remove('visible');

    const target = type === 'success' ? success : error;
    if (!target) return;

    target.textContent = text;
    target.classList.add('visible');
  }

  function showErrorModal(title, message) {
    window.AdminAuth?.showError?.(title, message);
  }

  // Devuelve la descripción humana de un permiso.
  // Prioridad: descripción del backend → mapa local → ninguna
  function getPermisoDescripcion(permiso) {
    const fromBackend = String(permiso.descripcion || '').trim();
    // Si el backend trae una descripción real (no vacía y no igual al código), úsala
    if (fromBackend && fromBackend !== permiso.codigo) return fromBackend;
    // Fallback al mapa local
    return PERMISOS_DESCRIPCIONES[permiso.codigo] || '';
  }

  /**
   * Modal de confirmación personalizado (reemplaza window.confirm).
   * @param {Object} options
   * @param {string} options.title     Título del modal
   * @param {string} options.message   Mensaje descriptivo
   * @param {string} [options.confirmText]  Texto del botón de confirmar
   * @param {string} [options.type]    'danger' | 'warning' (afecta color del botón)
   * @returns {Promise<boolean>} true si confirma, false si cancela
   */
  function showConfirmModal({ title, message, confirmText = 'Confirmar', type = 'danger' }) {
    return new Promise((resolve) => {
      const overlay = $('confirmModal');
      if (!overlay) {
        // Fallback si el HTML no tiene el modal todavía
        resolve(window.confirm(`${title}\n\n${message}`));
        return;
      }

      // Rellenar contenido
      const titleEl = $('confirmModalTitle');
      const msgEl = $('confirmModalMessage');
      const confirmBtn = $('confirmModalConfirm');
      const cancelBtn = $('confirmModalCancel');

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (confirmBtn) {
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn btn-confirm-${type}`;
      }

      overlay.hidden = false;
      overlay.classList.add('open');

      // Accesibilidad: foco en botón cancelar
      cancelBtn?.focus();

      function cleanup() {
        overlay.classList.remove('open');
        overlay.hidden = true;
        confirmBtn?.removeEventListener('click', onConfirm);
        cancelBtn?.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKeydown);
        unlockBodyScroll();
      }

      function onConfirm() { cleanup(); resolve(true); }
      function onCancel() { cleanup(); resolve(false); }
      function onOverlay(e) { if (e.target === overlay) onCancel(); }
      function onKeydown(e) { if (e.key === 'Escape') onCancel(); }

      confirmBtn?.addEventListener('click', onConfirm);
      cancelBtn?.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKeydown);

      lockBodyScroll(); // bloquear scroll del fondo
    });
  }

  // =============================================
  // SCROLL LOCK — bloquea el fondo al abrir modales
  // =============================================

  function lockBodyScroll() {
    document.body.classList.add('modal-open');
  }

  function unlockBodyScroll() {
    // Solo desbloquea si no hay ningún modal visible abierto
    const stillOpen = document.querySelectorAll(
      '#roleModal.open, #permissionsModal.open, #confirmModal.open'
    );
    if (stillOpen.length === 0) {
      document.body.classList.remove('modal-open');
    }
  }

  function setHeaderDate() {
    const headerDate = $('headerDate');
    if (!headerDate) return;

    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    headerDate.textContent = new Date()
      .toLocaleDateString('es-PE', opts)
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  function updateAccount(user) {
    setText('adminNombre', user.nombre || 'Administrador');
    setText('adminUsuario', user.usuario || '-');
    setText('adminRol', roleLabel(user.rol));
    setText('adminUltimoLogin', formatDate(user.ultimo_login));
    setText('adminEstado', user.estado === 'activo' ? 'Activo' : 'Inactivo');
    setText('sidebarAdminName', user.nombre || 'Administrador');
    setText('sidebarAdminRole', roleLabel(user.rol));
  }

  async function loadMe() {
    const res = await fetch(`${API_URL}/admin/me`, { credentials: 'include' });

    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      return null;
    }

    if (!res.ok) throw new Error('No se pudo cargar la cuenta');

    state.currentUser = await res.json();
    updateAccount(state.currentUser);

    if (hasPermission('roles.ver') || hasPermission('usuarios.ver')) {
      await loadRoles();
      updateAccount(state.currentUser);
    }

    const usersSection = $('usuariosAdminSection');
    if (usersSection) {
      usersSection.hidden = !hasPermission('usuarios.ver') && !hasPermission('roles.ver');
    }

    if (hasPermission('usuarios.ver')) {
      await loadUsers();
    }

    if (hasPermission('roles.ver')) {
      await loadRolesModule();
    }

    return state.currentUser;
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    const submit = $('passwordSubmit');
    const passwordActual = $('passwordActual').value.trim();
    const passwordNueva = $('passwordNueva').value.trim();
    const confirmarPassword = $('confirmarPassword').value.trim();

    if (!passwordActual || !passwordNueva || !confirmarPassword) {
      showMessage('password', 'error', 'Completa todos los campos');
      return;
    }

    if (passwordNueva.length < 6) {
      showMessage('password', 'error', 'La nueva contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (passwordNueva !== confirmarPassword) {
      showMessage('password', 'error', 'Las contrasenas no coinciden');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Actualizando...';

    try {
      const res = await fetch(`${API_URL}/admin/me/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password_actual: passwordActual,
          password_nueva: passwordNueva,
          confirmar_password: confirmarPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al actualizar contrasena');

      $('passwordForm').reset();
      showMessage('password', 'success', 'Contrasena actualizada correctamente');
    } catch (error) {
      showMessage('password', 'error', error.message || 'Error al actualizar contrasena');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Actualizar contrasena';
    }
  }

  async function loadUsers() {
    const tbody = $('adminUsersTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-users-empty">Cargando usuarios...</td></tr>';
    }

    try {
      const res = await fetch(`${API_URL}/admin/usuarios`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al cargar usuarios');

      state.usuarios = data.usuarios || [];
      renderUsers();
    } catch (error) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="admin-users-empty">${escapeHtml(error.message)}</td></tr>`;
      }
    }
  }

  function renderUsers() {
    const tbody = $('adminUsersTableBody');
    if (!tbody) return;

    if (state.usuarios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-users-empty">No hay usuarios administrativos.</td></tr>';
      return;
    }

    tbody.innerHTML = state.usuarios.map((user) => {
      const isSelf = state.currentUser && Number(state.currentUser.id) === Number(user.id);
      const nextEstado = user.estado === 'activo' ? 'inactivo' : 'activo';
      const toggleText = user.estado === 'activo' ? 'Desactivar' : 'Activar';

      return `
        <tr>
          <td>${escapeHtml(user.nombre)}</td>
          <td>${escapeHtml(user.usuario)}</td>
          <td>${escapeHtml(roleLabel(user.rol))}</td>
          <td><span class="status-pill ${user.estado === 'activo' ? '' : 'is-inactive'}"><span class="status-dot"></span>${escapeHtml(user.estado === 'activo' ? 'Activo' : 'Inactivo')}</span></td>
          <td>${escapeHtml(formatDate(user.ultimo_login))}</td>
          <td>${escapeHtml(formatDate(user.fecha_creacion))}</td>
          <td>
            <div class="admin-users-actions">
              <button type="button" class="table-action-btn" data-action="edit" data-id="${user.id}" data-permission="usuarios.editar">Editar</button>
              <button type="button" class="table-action-btn ${user.estado === 'activo' ? 'danger' : ''}" data-action="toggle" data-id="${user.id}" data-estado="${nextEstado}" data-permission="usuarios.desactivar" ${isSelf && nextEstado === 'inactivo' ? 'disabled' : ''}>${toggleText}</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    window.AdminAuth?.applyPermissions?.(tbody);
  }

  function resetUserForm() {
    $('adminUserForm').reset();
    $('adminUserId').value = '';
    $('adminUserSubmit').textContent = 'Crear usuario';
    $('adminUserCancel').hidden = true;
  }

  function editUser(id) {
    const user = state.usuarios.find((item) => Number(item.id) === Number(id));
    if (!user) return;

    $('adminUserId').value = user.id;
    $('adminUserNombre').value = user.nombre || '';
    $('adminUserUsuario').value = user.usuario || '';
    $('adminUserRol').value = user.rol || 'recepcion';
    $('adminUserEstado').value = user.estado || 'activo';
    $('adminUserPassword').value = '';
    $('adminUserConfirmPassword').value = '';
    $('adminUserSubmit').textContent = 'Guardar cambios';
    $('adminUserCancel').hidden = false;
    $('adminUserNombre').focus();
  }

  async function toggleUserState(id, estado) {
    const user = state.usuarios.find((item) => Number(item.id) === Number(id));
    if (!user) return;

    const accion = estado === 'activo' ? 'Activar' : 'Desactivar';
    const ok = await showConfirmModal({
      title: `${accion} usuario`,
      message: `¿Seguro que deseas ${accion.toLowerCase()} a ${user.nombre}?`,
      confirmText: accion,
      type: estado === 'inactivo' ? 'danger' : 'warning'
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/usuarios/${id}/estado`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');

      showMessage('adminUser', 'success', 'Estado actualizado correctamente');
      await loadUsers();
      await loadRoles();
      renderRoles();
    } catch (error) {
      showMessage('adminUser', 'error', error.message || 'Error al cambiar estado');
    }
  }

  async function handleUserSubmit(event) {
    event.preventDefault();

    const id = $('adminUserId').value;
    const nombre = $('adminUserNombre').value.trim();
    const usuario = $('adminUserUsuario').value.trim();
    const rol = $('adminUserRol').value;
    const estado = $('adminUserEstado').value;
    const password = $('adminUserPassword').value;
    const confirmarPassword = $('adminUserConfirmPassword').value;

    if (!nombre || !usuario) {
      showMessage('adminUser', 'error', 'Nombre y usuario son obligatorios');
      return;
    }

    if (!id && !password) {
      showMessage('adminUser', 'error', 'La contrasena es obligatoria para usuarios nuevos');
      return;
    }

    if (password && password.length < 6) {
      showMessage('adminUser', 'error', 'La contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (password && password !== confirmarPassword) {
      showMessage('adminUser', 'error', 'La confirmacion de contrasena no coincide');
      return;
    }

    const submit = $('adminUserSubmit');
    submit.disabled = true;
    submit.textContent = id ? 'Guardando...' : 'Creando...';

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_URL}/admin/usuarios/${id}` : `${API_URL}/admin/usuarios`;
      const body = { nombre, usuario, rol, estado };

      if (password) {
        body.password = password;
        body.confirmar_password = confirmarPassword;
      }

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al guardar usuario');

      resetUserForm();
      showMessage('adminUser', 'success', id ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      await loadUsers();
      await loadRoles();
      renderRoles();
    } catch (error) {
      showMessage('adminUser', 'error', error.message || 'Error al guardar usuario');
      showErrorModal('Error al guardar usuario', error.message || 'No se pudo guardar el usuario.');
    } finally {
      submit.disabled = false;
      submit.textContent = $('adminUserId').value ? 'Guardar cambios' : 'Crear usuario';
    }
  }

  async function loadRoles() {
    try {
      const res = await fetch(`${API_URL}/admin/roles`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.roles)) {
        state.roles = data.roles;
      }
    } catch (error) {
      console.warn('No se pudieron cargar roles:', error);
    }

    renderRoleOptions();
  }

  function renderRoleOptions() {
    const userRoleSelect = $('adminUserRol');
    const basedOnSelect = $('roleBasedOn');

    // Solo roles activos, SIN opciones fijas hardcodeadas (fix del bug de duplicados)
    const activeRoles = state.roles.filter(role => (role.estado || 'activo') === 'activo');

    const options = activeRoles.map(role => {
      const codigo = role.codigo || role.id;
      return `<option value="${escapeHtml(codigo)}">${escapeHtml(role.nombre || roleLabel(codigo))}</option>`;
    }).join('');

    if (userRoleSelect) {
      const current = userRoleSelect.value || 'recepcion';
      userRoleSelect.innerHTML = options;
      userRoleSelect.value = activeRoles.some(role => (role.codigo || role.id) === current) ? current : (activeRoles[0]?.codigo || 'recepcion');
    }

    if (basedOnSelect) {
      const current = basedOnSelect.value || 'vacio';
      // FIX PRINCIPAL: solo opciones dinámicas, sin hardcodear "supervisor"
      const roleOptions = activeRoles
        .map(role => `<option value="${escapeHtml(role.codigo || role.id)}">${escapeHtml(role.nombre || roleLabel(role.codigo || role.id))}</option>`)
        .join('');
      basedOnSelect.innerHTML = `
        <option value="vacio">— Sin base (vacío) —</option>
        ${roleOptions}
      `;
      basedOnSelect.value = Array.from(basedOnSelect.options).some(opt => opt.value === current) ? current : 'vacio';
    }
  }

  async function loadPermissionsCatalog() {
    if (state.permisos.length > 0) return; // ya cargado

    try {
      const res = await fetch(`${API_URL}/admin/permisos`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al cargar permisos');

      state.permisos = data.permisos || [];
      state.permisosAgrupados = data.categorias || {};
    } catch (error) {
      console.warn('No se pudo cargar el catálogo de permisos:', error);
    }
  }

  async function loadRolesModule() {
    const section = $('rolesSystemSection');
    if (section) section.hidden = false;

    if (hasPermission('roles.asignar_permisos')) {
      await loadPermissionsCatalog();
    }

    // Cargar resumen de permisos para cada rol
    if (hasPermission('roles.asignar_permisos') && state.permisos.length > 0) {
      await loadRolesPermissionsSummary();
    }

    renderRoles();
    window.AdminAuth?.applyPermissions?.(document);
  }

  // Carga permisos de cada rol para mostrar en las cards
  async function loadRolesPermissionsSummary() {
    const promises = state.roles.map(async (role) => {
      const codigo = role.codigo || role.id;
      if (codigo === 'admin') {
        role._permisosCodigos = state.permisos.map(p => p.codigo);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(codigo)}/permisos`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          role._permisosCodigos = data.permisos || [];
        }
      } catch {
        role._permisosCodigos = [];
      }
    });

    await Promise.all(promises);
  }

  function getPermisosNombres(codigosList) {
    return (codigosList || [])
      .map(codigo => {
        const found = state.permisos.find(p => p.codigo === codigo);
        return found ? found.nombre : null;
      })
      .filter(Boolean);
  }

  function renderRoles() {
    const grid = $('rolesGrid');
    if (!grid) return;

    if (!state.roles.length) {
      grid.innerHTML = '<div class="admin-users-empty">No hay roles registrados.</div>';
      return;
    }

    grid.innerHTML = state.roles.map(role => {
      const codigo = role.codigo || role.id;
      const isAdmin = codigo === 'admin';
      const isBase = role.sistema || codigo === 'recepcion';
      const estado = role.estado || 'activo';

      // Resumen de permisos para la card
      const permisosNombres = getPermisosNombres(role._permisosCodigos || []);
      const totalPermisos = isAdmin ? state.permisos.length : Number(role.permisos || 0);
      const preview = permisosNombres.slice(0, 3);
      const resto = Math.max(0, (isAdmin ? state.permisos.length : permisosNombres.length) - 3);

      const permisosPreviewHtml = preview.length > 0
        ? `<div class="role-permisos-preview">
            ${preview.map(n => `<span class="role-permiso-item">✓ ${escapeHtml(n)}</span>`).join('')}
            ${resto > 0 ? `<span class="role-permiso-more">+ ${resto} más</span>` : ''}
          </div>`
        : `<div class="role-permisos-preview"><span class="role-permiso-none">Sin permisos asignados</span></div>`;

      return `
        <article class="role-card ${estado !== 'activo' ? 'is-inactive' : ''}" data-role="${escapeHtml(codigo)}">
          <div class="role-card-top">
            <div>
              <div class="role-card-title">${escapeHtml(role.nombre || roleLabel(codigo))}</div>
              <div class="role-card-description">${escapeHtml(role.descripcion || 'Rol administrativo personalizado.')}</div>
            </div>
            <span class="role-status ${estado !== 'activo' ? 'inactive' : ''}">${estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
          </div>
          <div class="role-card-metrics">
            <span>${Number(role.usuarios || 0)} usuarios</span>
            <span class="role-metric-permisos">${totalPermisos} permisos</span>
          </div>
          ${permisosPreviewHtml}
          <div class="role-card-actions">
            <button type="button" class="table-action-btn" data-role-action="edit" data-role="${escapeHtml(codigo)}" data-permission="roles.editar" ${isAdmin ? 'disabled' : ''}>Editar</button>
            <button type="button" class="table-action-btn" data-role-action="viewPerms" data-role="${escapeHtml(codigo)}" data-permission="roles.asignar_permisos">Ver permisos</button>
            <button type="button" class="table-action-btn" data-role-action="duplicate" data-role="${escapeHtml(codigo)}" data-permission="roles.crear">Duplicar</button>
            <button type="button" class="table-action-btn ${estado === 'activo' ? 'danger' : ''}" data-role-action="toggle" data-role="${escapeHtml(codigo)}" data-next="${estado === 'activo' ? 'inactivo' : 'activo'}" data-permission="roles.eliminar" ${isBase ? 'disabled' : ''}>${estado === 'activo' ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="table-action-btn danger" data-role-action="delete" data-role="${escapeHtml(codigo)}" data-permission="roles.eliminar" ${isBase ? 'disabled' : ''}>Eliminar</button>
          </div>
        </article>
      `;
    }).join('');

    window.AdminAuth?.applyPermissions?.(grid);
  }

  // =============================================
  // MODAL DE CREAR / EDITAR ROL (con permisos)
  // =============================================

  async function openRoleModal(role = null, duplicate = false) {
    const modal = $('roleModal');
    if (!modal) return;

    // Cargar catálogo de permisos si no está cargado
    if (hasPermission('roles.asignar_permisos')) {
      await loadPermissionsCatalog();
    }

    $('roleForm').reset();
    $('roleCodigo').value = duplicate ? '' : (role?.codigo || '');
    $('roleNombre').value = duplicate ? `${role?.nombre || roleLabel(role?.codigo)} copia` : (role?.nombre || '');
    $('roleDescripcion').value = role?.descripcion || '';
    $('roleEstado').value = duplicate ? 'activo' : (role?.estado || 'activo');
    $('roleEstadoGroup').hidden = Boolean(!role || duplicate);
    $('roleBasedOnGroup').hidden = Boolean(role && !duplicate);
    $('roleBasedOn').value = duplicate ? (role?.codigo || 'vacio') : 'vacio';
    $('roleModalTitle').textContent = role && !duplicate ? 'Editar rol' : duplicate ? 'Duplicar rol' : 'Crear rol';
    $('roleSubmitBtn').textContent = role && !duplicate ? 'Guardar cambios' : duplicate ? 'Crear copia' : 'Crear rol';

    // Resetear permisos en modal
    state.modalPermisos = new Set();
    state.modalPermissionQuery = '';

    const searchEl = $('roleModalPermSearch');
    if (searchEl) searchEl.value = '';

    // Renderizar panel de permisos en el modal
    if (hasPermission('roles.asignar_permisos') && state.permisos.length > 0) {
      const isAdmin = (role?.codigo || '') === 'admin';
      const panelWrap = $('roleModalPermsWrap');
      if (panelWrap) panelWrap.hidden = false;

      if (role && !duplicate) {
        // Editar: cargar permisos actuales del rol
        const codigo = role.codigo || role.id;
        try {
          const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(codigo)}/permisos`, { credentials: 'include' });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            state.modalPermisos = new Set(data.permisos || []);
          }
        } catch (e) {
          console.warn('No se pudieron cargar permisos del rol:', e);
        }
      } else if (duplicate && role) {
        // Duplicar: copiar permisos del rol origen
        const codigo = role.codigo || role.id;
        try {
          const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(codigo)}/permisos`, { credentials: 'include' });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            state.modalPermisos = new Set(data.permisos || []);
          }
        } catch (e) {
          state.modalPermisos = new Set();
        }
      }

      renderModalPermissionsGrid(isAdmin);
    } else {
      const panelWrap = $('roleModalPermsWrap');
      if (panelWrap) panelWrap.hidden = true;
    }

    modal.hidden = false;
    modal.classList.add('open');
    lockBodyScroll();
    $('roleNombre').focus();
  }

  function closeRoleModal() {
    const modal = $('roleModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.hidden = true;
    state.modalPermisos = new Set();
    unlockBodyScroll();
  }

  // Renderiza los checkboxes dentro del roleModal
  function renderModalPermissionsGrid(isAdminRole = false) {
    const grid = $('roleModalPermsGrid');
    const countEl = $('roleModalPermCount');
    if (!grid) return;

    const q = state.modalPermissionQuery.trim().toLowerCase();
    const grouped = Object.entries(state.permisosAgrupados);

    const filtered = q
      ? grouped
        .map(([cat, perms]) => [
          cat,
          (perms || []).filter(p =>
            p.codigo.toLowerCase().includes(q) ||
            p.nombre.toLowerCase().includes(q) ||
            String(p.descripcion || '').toLowerCase().includes(q)
          )
        ])
        .filter(([, perms]) => perms.length > 0)
      : grouped;

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="admin-users-empty">Sin permisos para esta búsqueda.</div>';
      updateModalPermCount();
      return;
    }

    grid.innerHTML = filtered.map(([categoria, permisos]) => `
      <div class="modal-perm-category">
        <div class="modal-perm-category-head">
          <span class="modal-perm-category-name">${escapeHtml(categoria)}</span>
          <div class="modal-perm-category-actions">
            <button type="button" class="modal-perm-cat-btn" data-cat-action="selectAll" data-cat="${escapeHtml(categoria)}" ${isAdminRole ? 'disabled' : ''}>Todos</button>
            <button type="button" class="modal-perm-cat-btn" data-cat-action="clearAll" data-cat="${escapeHtml(categoria)}" ${isAdminRole ? 'disabled' : ''}>Limpiar</button>
          </div>
        </div>
        <div class="modal-perm-list">
          ${(permisos || []).map(permiso => {
      const checked = isAdminRole || state.modalPermisos.has(permiso.codigo);
      const desc = getPermisoDescripcion(permiso);
      return `
              <label class="permission-option ${checked ? 'is-checked' : ''}">
                <input type="checkbox" data-modal-perm value="${escapeHtml(permiso.codigo)}" ${checked ? 'checked' : ''} ${isAdminRole ? 'disabled' : ''}>
                <span class="perm-text">
                  <strong>${escapeHtml(permiso.nombre)}</strong>
                  ${desc ? `<span class="perm-desc">${escapeHtml(desc)}</span>` : ''}
                </span>
              </label>
            `;
    }).join('')}
        </div>
      </div>
    `).join('');

    // Bind checkboxes
    grid.querySelectorAll('input[data-modal-perm]').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) {
          state.modalPermisos.add(input.value);
          input.closest('label')?.classList.add('is-checked');
        } else {
          state.modalPermisos.delete(input.value);
          input.closest('label')?.classList.remove('is-checked');
        }
        updateModalPermCount();
      });
    });

    // Bind botones por categoría
    grid.querySelectorAll('button[data-cat-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        const action = btn.dataset.catAction;
        const catPerms = (state.permisosAgrupados[cat] || []);

        catPerms.forEach(p => {
          if (action === 'selectAll') {
            state.modalPermisos.add(p.codigo);
          } else {
            state.modalPermisos.delete(p.codigo);
          }
        });
        renderModalPermissionsGrid(isAdminRole);
      });
    });

    updateModalPermCount();
  }

  function updateModalPermCount() {
    const countEl = $('roleModalPermCount');
    if (!countEl) return;
    const n = state.modalPermisos.size;
    countEl.textContent = `${n} permiso${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;
  }

  // Carga permisos del rol origen al cambiar "Crear basado en"
  async function onBasadoEnChange() {
    const select = $('roleBasedOn');
    if (!select) return;
    const value = select.value;

    if (!value || value === 'vacio') {
      state.modalPermisos = new Set();
      const isAdmin = false;
      renderModalPermissionsGrid(isAdmin);
      return;
    }

    // Mostrar loading
    const grid = $('roleModalPermsGrid');
    if (grid) {
      grid.innerHTML = '<div class="admin-users-empty">Cargando permisos...</div>';
    }

    try {
      const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(value)}/permisos`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        state.modalPermisos = new Set(data.permisos || []);
      } else {
        state.modalPermisos = new Set();
      }
    } catch {
      state.modalPermisos = new Set();
    }

    renderModalPermissionsGrid(false);
  }

  async function handleRoleSubmit(event) {
    event.preventDefault();

    const codigo = $('roleCodigo').value;
    const nombre = $('roleNombre').value.trim();
    const descripcion = $('roleDescripcion').value.trim();
    const estado = $('roleEstado')?.value || 'activo';
    const basadoEn = $('roleBasedOn').value;

    if (!nombre) {
      showMessage('role', 'error', 'Nombre del rol obligatorio');
      return;
    }

    const submit = $('roleSubmitBtn');
    submit.disabled = true;
    submit.textContent = 'Guardando...';

    try {
      // Si tiene permiso de asignar permisos, incluirlos en el body
      const canAssignPerms = hasPermission('roles.asignar_permisos') && state.permisos.length > 0;
      const permisosSeleccionados = canAssignPerms ? Array.from(state.modalPermisos) : undefined;

      let body;
      if (codigo) {
        // Editar rol: PUT incluye permisos si tiene permiso
        body = { nombre, descripcion, estado };
        if (permisosSeleccionados !== undefined) {
          body.permisos = permisosSeleccionados;
        }
      } else {
        // Crear rol: POST con basado_en
        body = { nombre, descripcion, basado_en: basadoEn };
        // El backend crea con basado_en, luego si hay permisos modificados hacemos PUT de permisos
      }

      const res = await fetch(
        codigo ? `${API_URL}/admin/roles/${encodeURIComponent(codigo)}` : `${API_URL}/admin/roles`,
        {
          method: codigo ? 'PUT' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al guardar rol');

      // Si es creación Y hay permisos modificados (diferente a basado_en), aplicar con PUT de permisos
      if (!codigo && canAssignPerms && permisosSeleccionados !== undefined) {
        const nuevoCodigo = data.rol?.codigo || data.rol?.id;
        if (nuevoCodigo && basadoEn !== 'vacio') {
          // Los permisos del basado_en ya los asignó el backend.
          // Si el usuario los modificó (diferente al set que cargó), actualizamos
          try {
            await fetch(`${API_URL}/admin/roles/${encodeURIComponent(nuevoCodigo)}/permisos`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ permisos: permisosSeleccionados })
            });
          } catch (e) {
            console.warn('No se pudieron actualizar permisos post-creacion:', e);
          }
        } else if (nuevoCodigo && basadoEn === 'vacio' && permisosSeleccionados.length > 0) {
          // Rol vacío pero usuario seleccionó permisos manualmente
          try {
            await fetch(`${API_URL}/admin/roles/${encodeURIComponent(nuevoCodigo)}/permisos`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ permisos: permisosSeleccionados })
            });
          } catch (e) {
            console.warn('No se pudieron asignar permisos al nuevo rol:', e);
          }
        }
      }

      closeRoleModal();
      showMessage('role', 'success', codigo ? 'Rol actualizado correctamente' : 'Rol creado correctamente');

      // Refrescar estado
      await loadRoles();
      if (hasPermission('roles.asignar_permisos') && state.permisos.length > 0) {
        await loadRolesPermissionsSummary();
      }
      renderRoles();
      renderUsers();
    } catch (error) {
      showMessage('role', 'error', error.message || 'Error al guardar rol');
      showErrorModal(codigo ? 'Error al editar rol' : 'Error al crear rol', error.message || 'No se pudo guardar el rol.');
    } finally {
      submit.disabled = false;
      submit.textContent = codigo ? 'Guardar cambios' : 'Crear rol';
    }
  }

  async function duplicateRole(codigo) {
    const role = state.roles.find(item => (item.codigo || item.id) === codigo);
    if (!role) return;
    openRoleModal(role, true);
  }

  async function toggleRole(codigo, estado) {
    const role = state.roles.find(item => (item.codigo || item.id) === codigo);
    if (!role) return;

    const accion = estado === 'activo' ? 'Activar' : 'Desactivar';
    const ok = await showConfirmModal({
      title: `${accion} rol`,
      message: `¿Seguro que deseas ${accion.toLowerCase()} el rol "${role.nombre}"?`,
      confirmText: accion,
      type: estado === 'inactivo' ? 'danger' : 'warning'
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(codigo)}/estado`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');

      showMessage('role', 'success', 'Estado del rol actualizado');
      await loadRoles();
      if (hasPermission('roles.asignar_permisos') && state.permisos.length > 0) {
        await loadRolesPermissionsSummary();
      }
      renderRoles();
      renderUsers();
    } catch (error) {
      showMessage('role', 'error', error.message || 'Error al cambiar estado');
    }
  }

  async function deleteRole(codigo) {
    const role = state.roles.find(item => (item.codigo || item.id) === codigo);
    if (!role) return;

    const ok = await showConfirmModal({
      title: 'Eliminar rol',
      message: `¿Seguro que deseas eliminar el rol "${role.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar rol',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(codigo)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al eliminar rol');

      showMessage('role', 'success', 'Rol eliminado correctamente');
      await loadRoles();
      if (hasPermission('roles.asignar_permisos') && state.permisos.length > 0) {
        await loadRolesPermissionsSummary();
      }
      renderRoles();
    } catch (error) {
      // Mostrar el error en un modal de información, no en alert()
      const msg = error.message === 'Este rol tiene usuarios asignados.'
        ? 'No puedes eliminar este rol porque tiene usuarios asignados. Reasigna esos usuarios a otro rol primero.'
        : error.message || 'Error al eliminar rol';
      showMessage('role', 'error', msg);
      await showConfirmModal({
        title: 'No se puede eliminar',
        message: msg,
        confirmText: 'Entendido',
        type: 'warning'
      });
    }
  }

  // =============================================
  // MODAL DE VER PERMISOS (independiente, desde card)
  // =============================================

  async function openPermissionsModal(codigo) {
    const role = state.roles.find(item => (item.codigo || item.id) === codigo);
    if (!role) return;

    state.selectedRole = codigo;
    state.permissionQuery = '';
    $('permissionSearch').value = '';
    $('permissionsModalTitle').textContent = role.nombre || roleLabel(codigo);
    $('permissionsModalSubtitle').textContent = role.descripcion || 'Permisos asignados a este rol.';

    const modal = $('permissionsModal');
    modal.hidden = false;
    modal.classList.add('open');
    lockBodyScroll();

    await loadRolePermissions(codigo);
  }

  function closePermissionsModal() {
    const modal = $('permissionsModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.hidden = true;
    unlockBodyScroll();
  }

  async function loadRolePermissions(role) {
    const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(role)}/permisos`, {
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al cargar permisos del rol');

    state.permisosRol = new Set(data.permisos || []);
    renderPermissionsGrid(role);
  }

  function filteredGroupedPermissions() {
    const q = state.permissionQuery.trim().toLowerCase();
    const grouped = Object.entries(state.permisosAgrupados);
    if (!q) return grouped;

    return grouped
      .map(([categoria, permisos]) => [
        categoria,
        (permisos || []).filter(permiso =>
          permiso.codigo.toLowerCase().includes(q) ||
          permiso.nombre.toLowerCase().includes(q) ||
          String(permiso.descripcion || '').toLowerCase().includes(q)
        )
      ])
      .filter(([, permisos]) => permisos.length > 0);
  }

  function renderPermissionsGrid(role) {
    const grid = $('permissionsGrid');
    if (!grid) return;

    const groupedEntries = filteredGroupedPermissions();
    const adminRole = role === 'admin';

    if (groupedEntries.length === 0) {
      grid.innerHTML = '<div class="admin-users-empty">Sin permisos para esta busqueda.</div>';
      renderRoleSummary();
      return;
    }

    grid.innerHTML = groupedEntries.map(([categoria, permisos]) => `
      <details class="permission-category" open>
        <summary class="permission-category-title">
          <span>${escapeHtml(categoria)}</span>
          <span>${permisos.length}</span>
        </summary>
        <div class="permission-list">
          ${(permisos || []).map(permiso => {
      const checked = adminRole || state.permisosRol.has(permiso.codigo);
      const desc = getPermisoDescripcion(permiso);
      return `
              <label class="permission-option ${checked ? 'is-checked' : 'is-unchecked'}">
                <input type="checkbox" value="${escapeHtml(permiso.codigo)}" ${checked ? 'checked' : ''} ${adminRole ? 'disabled' : ''}>
                <span class="perm-text">
                  <strong>${escapeHtml(permiso.nombre)}</strong>
                  ${desc ? `<span class="perm-desc">${escapeHtml(desc)}</span>` : ''}
                </span>
              </label>
            `;
    }).join('')}
        </div>
      </details>
    `).join('');

    grid.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) {
          state.permisosRol.add(input.value);
          input.closest('label')?.classList.add('is-checked');
          input.closest('label')?.classList.remove('is-unchecked');
        } else {
          state.permisosRol.delete(input.value);
          input.closest('label')?.classList.remove('is-checked');
          input.closest('label')?.classList.add('is-unchecked');
        }
        renderRoleSummary();
      });
    });

    const saveBtn = $('saveRolePermissions');
    if (saveBtn) {
      saveBtn.disabled = adminRole;
      saveBtn.textContent = adminRole ? 'Admin conserva todos los permisos' : 'Guardar permisos';
    }

    renderRoleSummary();
  }

  function renderRoleSummary() {
    const role = state.roles.find(item => (item.codigo || item.id) === state.selectedRole);
    const selected = state.selectedRole === 'admin'
      ? new Set(state.permisos.map(permiso => permiso.codigo))
      : state.permisosRol;
    const allowed = state.permisos.filter(permiso => selected.has(permiso.codigo));
    const denied = state.permisos.filter(permiso => !selected.has(permiso.codigo));

    setText('roleSummaryTitle', role?.nombre || 'Resumen');
    setText('roleSummaryCount', `${allowed.length} permisos`);
    setText('permissionCount', `${allowed.length} permisos seleccionados`);

    const canList = $('roleCanList');
    const cannotList = $('roleCannotList');
    if (canList) {
      canList.innerHTML = allowed.slice(0, 5).map(permiso => `<span>✓ ${escapeHtml(permiso.nombre)}</span>`).join('') || '<span>Sin permisos asignados</span>';
    }
    if (cannotList) {
      cannotList.innerHTML = denied.slice(0, 5).map(permiso => `<span>× ${escapeHtml(permiso.nombre)}</span>`).join('') || '<span>Acceso total</span>';
    }
  }

  async function saveRolePermissions() {
    const role = state.selectedRole;
    const permisos = role === 'admin'
      ? state.permisos.map(permiso => permiso.codigo)
      : Array.from(state.permisosRol);
    const btn = $('saveRolePermissions');

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const res = await fetch(`${API_URL}/admin/roles/${encodeURIComponent(role)}/permisos`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permisos })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al guardar permisos');

      state.permisosRol = new Set(data.permisos || permisos);
      showMessage('rolePermissions', 'success', 'Permisos guardados correctamente');

      // Actualizar resumen en la card
      const roleObj = state.roles.find(item => (item.codigo || item.id) === role);
      if (roleObj) {
        roleObj._permisosCodigos = Array.from(state.permisosRol);
        roleObj.permisos = state.permisosRol.size;
      }

      await loadRoles();
      if (hasPermission('roles.asignar_permisos') && state.permisos.length > 0) {
        await loadRolesPermissionsSummary();
      }
      renderRoles();
      renderUsers();
      closePermissionsModal();
    } catch (error) {
      showMessage('rolePermissions', 'error', error.message || 'Error al guardar permisos');
    } finally {
      btn.disabled = role === 'admin';
      btn.textContent = role === 'admin' ? 'Admin conserva todos los permisos' : 'Guardar permisos';
    }
  }

  function bindUserTable() {
    const tbody = $('adminUsersTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      if (button.dataset.action === 'edit') editUser(button.dataset.id);
      if (button.dataset.action === 'toggle') toggleUserState(button.dataset.id, button.dataset.estado);
    });
  }

  function bindRoleCards() {
    const grid = $('rolesGrid');
    if (!grid) return;

    grid.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-role-action]');
      if (!button) return;

      const codigo = button.dataset.role;
      const role = state.roles.find(item => (item.codigo || item.id) === codigo);
      const action = button.dataset.roleAction;

      if (action === 'edit') openRoleModal(role);
      if (action === 'duplicate') duplicateRole(codigo);
      if (action === 'viewPerms') openPermissionsModal(codigo);
      if (action === 'permissions') openPermissionsModal(codigo);
      if (action === 'toggle') toggleRole(codigo, button.dataset.next);
      if (action === 'delete') deleteRole(codigo);
    });
  }

  function bindForms() {
    const passwordForm = $('passwordForm');
    if (passwordForm) passwordForm.addEventListener('submit', handlePasswordSubmit);

    const userForm = $('adminUserForm');
    if (userForm) userForm.addEventListener('submit', handleUserSubmit);

    const cancel = $('adminUserCancel');
    if (cancel) cancel.addEventListener('click', resetUserForm);

    $('createRoleBtn')?.addEventListener('click', () => openRoleModal());
    $('roleForm')?.addEventListener('submit', handleRoleSubmit);
    $('roleModalClose')?.addEventListener('click', closeRoleModal);
    $('roleCancelBtn')?.addEventListener('click', closeRoleModal);
    $('permissionsModalClose')?.addEventListener('click', closePermissionsModal);
    $('permissionsCancelBtn')?.addEventListener('click', closePermissionsModal);
    $('saveRolePermissions')?.addEventListener('click', saveRolePermissions);

    // Buscador en modal de ver permisos
    $('permissionSearch')?.addEventListener('input', (event) => {
      state.permissionQuery = event.target.value;
      renderPermissionsGrid(state.selectedRole);
    });

    // Buscador en modal de crear/editar rol
    $('roleModalPermSearch')?.addEventListener('input', (event) => {
      state.modalPermissionQuery = event.target.value;
      const codigo = $('roleCodigo').value;
      const isAdmin = codigo === 'admin';
      renderModalPermissionsGrid(isAdmin);
    });

    // Al cambiar "Crear basado en": cargar permisos automáticamente
    $('roleBasedOn')?.addEventListener('change', onBasadoEnChange);

    // Cerrar modal al hacer clic en overlay
    $('roleModal')?.addEventListener('click', (e) => {
      if (e.target === $('roleModal')) closeRoleModal();
    });
    $('permissionsModal')?.addEventListener('click', (e) => {
      if (e.target === $('permissionsModal')) closePermissionsModal();
    });
  }

  async function init() {
    setHeaderDate();
    bindForms();
    bindUserTable();
    bindRoleCards();

    try {
      await loadMe();
    } catch (error) {
      console.error(error);
      setText('adminNombre', 'No disponible');
      setText('adminUsuario', '-');
      setText('adminRol', '-');
      setText('adminUltimoLogin', '-');
      setText('adminEstado', 'Error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
