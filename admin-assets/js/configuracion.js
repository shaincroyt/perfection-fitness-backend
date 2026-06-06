(function () {
  const API_URL = '/api';
  const BASE_ROLES = [
    { id: 'recepcion', codigo: 'recepcion', nombre: 'Recepcion', descripcion: 'Gestiona ingresos y atencion al cliente.', estado: 'activo', sistema: true, usuarios: 0, permisos: 0 },
    { id: 'admin', codigo: 'admin', nombre: 'Administrador', descripcion: 'Acceso total al sistema.', estado: 'activo', sistema: true, usuarios: 0, permisos: 0 }
  ];

  const state = {
    currentUser: null,
    usuarios: [],
    permisos: [],
    permisosAgrupados: {},
    permisosRol: new Set(),
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

    const ok = window.confirm(`${estado === 'activo' ? 'Activar' : 'Desactivar'} a ${user.nombre}?`);
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
    const activeRoles = state.roles.filter(role => (role.estado || 'activo') === 'activo');
    const options = activeRoles.map(role => {
      const codigo = role.codigo || role.id;
      return `<option value="${escapeHtml(codigo)}">${escapeHtml(role.nombre || roleLabel(codigo))}</option>`;
    }).join('');

    if (userRoleSelect) {
      const current = userRoleSelect.value || 'recepcion';
      userRoleSelect.innerHTML = options;
      userRoleSelect.value = activeRoles.some(role => (role.codigo || role.id) === current) ? current : 'recepcion';
    }

    if (basedOnSelect) {
      const current = basedOnSelect.value || 'vacio';
      const roleOptions = activeRoles
        .map(role => `<option value="${escapeHtml(role.codigo || role.id)}">${escapeHtml(role.nombre || roleLabel(role.codigo || role.id))}</option>`)
        .join('');
      basedOnSelect.innerHTML = `
        <option value="vacio">Vacio</option>
        <option value="supervisor">Supervisor</option>
        ${roleOptions}
      `;
      basedOnSelect.value = Array.from(basedOnSelect.options).some(option => option.value === current) ? current : 'vacio';
    }
  }

  async function loadPermissionsCatalog() {
    const res = await fetch(`${API_URL}/admin/permisos`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al cargar permisos');

    state.permisos = data.permisos || [];
    state.permisosAgrupados = data.categorias || {};
  }

  async function loadRolesModule() {
    const section = $('rolesSystemSection');
    if (section) section.hidden = false;

    if (hasPermission('roles.asignar_permisos')) {
      await loadPermissionsCatalog();
    }
    renderRoles();
    window.AdminAuth?.applyPermissions?.(document);
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
            <span>${Number(role.permisos || 0)} permisos asignados</span>
          </div>
          <div class="role-card-actions">
            <button type="button" class="table-action-btn" data-role-action="edit" data-role="${escapeHtml(codigo)}" data-permission="roles.editar" ${isAdmin ? 'disabled' : ''}>Editar</button>
            <button type="button" class="table-action-btn" data-role-action="duplicate" data-role="${escapeHtml(codigo)}" data-permission="roles.crear">Duplicar</button>
            <button type="button" class="table-action-btn" data-role-action="permissions" data-role="${escapeHtml(codigo)}" data-permission="roles.asignar_permisos">Permisos</button>
            <button type="button" class="table-action-btn ${estado === 'activo' ? 'danger' : ''}" data-role-action="toggle" data-role="${escapeHtml(codigo)}" data-next="${estado === 'activo' ? 'inactivo' : 'activo'}" data-permission="roles.eliminar" ${isBase ? 'disabled' : ''}>${estado === 'activo' ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="table-action-btn danger" data-role-action="delete" data-role="${escapeHtml(codigo)}" data-permission="roles.eliminar" ${isBase ? 'disabled' : ''}>Eliminar</button>
          </div>
        </article>
      `;
    }).join('');

    window.AdminAuth?.applyPermissions?.(grid);
  }

  function openRoleModal(role = null, duplicate = false) {
    const modal = $('roleModal');
    if (!modal) return;

    $('roleForm').reset();
    $('roleCodigo').value = duplicate ? '' : (role?.codigo || '');
    $('roleNombre').value = duplicate ? `${role?.nombre || roleLabel(role?.codigo)} copia` : (role?.nombre || '');
    $('roleDescripcion').value = role?.descripcion || '';
    $('roleBasedOnGroup').hidden = Boolean(role && !duplicate);
    $('roleBasedOn').value = duplicate ? (role?.codigo || 'recepcion') : 'vacio';
    $('roleModalTitle').textContent = role && !duplicate ? 'Editar rol' : duplicate ? 'Duplicar rol' : 'Crear rol';
    $('roleSubmitBtn').textContent = role && !duplicate ? 'Guardar rol' : duplicate ? 'Crear copia' : 'Crear rol';
    modal.hidden = false;
    modal.classList.add('open');
    $('roleNombre').focus();
  }

  function closeRoleModal() {
    const modal = $('roleModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.hidden = true;
  }

  async function handleRoleSubmit(event) {
    event.preventDefault();

    const codigo = $('roleCodigo').value;
    const nombre = $('roleNombre').value.trim();
    const descripcion = $('roleDescripcion').value.trim();
    const basadoEn = $('roleBasedOn').value;

    if (!nombre) {
      showMessage('role', 'error', 'Nombre del rol obligatorio');
      return;
    }

    const submit = $('roleSubmitBtn');
    submit.disabled = true;
    submit.textContent = 'Guardando...';

    try {
      const res = await fetch(codigo ? `${API_URL}/admin/roles/${encodeURIComponent(codigo)}` : `${API_URL}/admin/roles`, {
        method: codigo ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion, basado_en: basadoEn })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al guardar rol');

      closeRoleModal();
      showMessage('role', 'success', codigo ? 'Rol actualizado correctamente' : 'Rol creado correctamente');
      await loadRoles();
      renderRoles();
    } catch (error) {
      showMessage('role', 'error', error.message || 'Error al guardar rol');
    } finally {
      submit.disabled = false;
      submit.textContent = codigo ? 'Guardar rol' : 'Crear rol';
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

    if (state.permisos.length === 0) {
      await loadPermissionsCatalog();
    }

    const ok = window.confirm(`${estado === 'activo' ? 'Activar' : 'Desactivar'} el rol ${role.nombre}?`);
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
      renderRoles();
    } catch (error) {
      showMessage('role', 'error', error.message || 'Error al cambiar estado');
    }
  }

  async function deleteRole(codigo) {
    const role = state.roles.find(item => (item.codigo || item.id) === codigo);
    if (!role) return;

    const ok = window.confirm(`Eliminar el rol ${role.nombre}?`);
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
      renderRoles();
    } catch (error) {
      showMessage('role', 'error', error.message === 'Este rol tiene usuarios asignados.'
        ? 'Este rol tiene usuarios asignados. Reasigna esos usuarios a otro rol antes de eliminarlo.'
        : error.message || 'Error al eliminar rol');
    }
  }

  async function openPermissionsModal(codigo) {
    const role = state.roles.find(item => (item.codigo || item.id) === codigo);
    if (!role) return;

    state.selectedRole = codigo;
    state.permissionQuery = '';
    $('permissionSearch').value = '';
    $('permissionsModalTitle').textContent = role.nombre || roleLabel(codigo);
    $('permissionsModalSubtitle').textContent = role.descripcion || 'Selecciona permisos para este rol.';

    const modal = $('permissionsModal');
    modal.hidden = false;
    modal.classList.add('open');

    await loadRolePermissions(codigo);
  }

  function closePermissionsModal() {
    const modal = $('permissionsModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.hidden = true;
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
            return `
              <label class="permission-option">
                <input type="checkbox" value="${escapeHtml(permiso.codigo)}" ${checked ? 'checked' : ''} ${adminRole ? 'disabled' : ''}>
                <span>
                  <strong>${escapeHtml(permiso.nombre)}</strong>
                  <small>${escapeHtml(permiso.codigo)}</small>
                </span>
              </label>
            `;
          }).join('')}
        </div>
      </details>
    `).join('');

    grid.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.permisosRol.add(input.value);
        else state.permisosRol.delete(input.value);
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
      await loadRoles();
      renderRoles();
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
    $('permissionSearch')?.addEventListener('input', (event) => {
      state.permissionQuery = event.target.value;
      renderPermissionsGrid(state.selectedRole);
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
