(function () {
  const API_URL = '/api';
  const state = {
    currentUser: null,
    usuarios: [],
    permisos: [],
    permisosAgrupados: {},
    permisosRol: new Set(),
    roles: [
      { id: 'recepcion', codigo: 'recepcion', nombre: 'Recepcion' },
      { id: 'admin', codigo: 'admin', nombre: 'Admin' }
    ]
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
    return role === 'admin' ? 'Admin' : 'Recepcion';
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
    const res = await fetch(`${API_URL}/admin/me`, {
      credentials: 'include'
    });

    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      return null;
    }

    if (!res.ok) {
      throw new Error('No se pudo cargar la cuenta');
    }

    const user = await res.json();
    state.currentUser = user;
    updateAccount(user);

    const usersSection = $('usuariosAdminSection');
    if (usersSection) {
      usersSection.hidden = !hasPermission('usuarios.ver') && !hasPermission('roles.asignar_permisos');
    }

    if (hasPermission('usuarios.ver')) {
      await loadUsers();
    }

    if (hasPermission('roles.asignar_permisos')) {
      await loadRolePermissionsModule();
    }

    return user;
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
      const res = await fetch(`${API_URL}/admin/usuarios`, {
        credentials: 'include'
      });
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
    } catch (error) {
      showMessage('adminUser', 'error', error.message || 'Error al guardar usuario');
    } finally {
      submit.disabled = false;
      submit.textContent = $('adminUserId').value ? 'Guardar cambios' : 'Crear usuario';
    }
  }

  function bindUserTable() {
    const tbody = $('adminUsersTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      if (button.dataset.action === 'edit') {
        editUser(button.dataset.id);
      }

      if (button.dataset.action === 'toggle') {
        toggleUserState(button.dataset.id, button.dataset.estado);
      }
    });
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
    const permissionsRoleSelect = $('rolePermissionsSelect');
    const options = state.roles.map(role => {
      const codigo = role.codigo || role.id;
      return `<option value="${escapeHtml(codigo)}">${escapeHtml(role.nombre || roleLabel(codigo))}</option>`;
    }).join('');

    if (userRoleSelect) {
      const current = userRoleSelect.value || 'recepcion';
      userRoleSelect.innerHTML = options;
      userRoleSelect.value = state.roles.some(role => (role.codigo || role.id) === current) ? current : 'recepcion';
    }

    if (permissionsRoleSelect) {
      const current = permissionsRoleSelect.value || 'recepcion';
      permissionsRoleSelect.innerHTML = options;
      permissionsRoleSelect.value = state.roles.some(role => (role.codigo || role.id) === current) ? current : 'recepcion';
    }
  }

  async function loadPermissionsCatalog() {
    const res = await fetch(`${API_URL}/admin/permisos`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || 'Error al cargar permisos');

    state.permisos = data.permisos || [];
    state.permisosAgrupados = data.categorias || {};
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

  function renderPermissionsGrid(role) {
    const grid = $('permissionsGrid');
    if (!grid) return;

    const groupedEntries = Object.entries(state.permisosAgrupados);
    if (groupedEntries.length === 0) {
      grid.innerHTML = '<div class="admin-users-empty">No hay permisos registrados.</div>';
      return;
    }

    const adminRole = role === 'admin';

    grid.innerHTML = groupedEntries.map(([categoria, permisos]) => `
      <div class="permission-category">
        <div class="permission-category-title">${escapeHtml(categoria)}</div>
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
      </div>
    `).join('');

    const saveBtn = $('saveRolePermissions');
    if (saveBtn) {
      saveBtn.disabled = adminRole;
      saveBtn.textContent = adminRole ? 'Admin conserva todos los permisos' : 'Guardar permisos';
    }
  }

  async function loadRolePermissionsModule() {
    const panel = $('rolePermissionsPanel');
    if (panel) panel.hidden = false;

    await loadRoles();
    await loadPermissionsCatalog();
    await loadRolePermissions($('rolePermissionsSelect')?.value || 'recepcion');
    window.AdminAuth?.applyPermissions?.(document);
  }

  async function handleRoleChange() {
    try {
      await loadRolePermissions($('rolePermissionsSelect').value);
    } catch (error) {
      showMessage('rolePermissions', 'error', error.message || 'Error al cargar permisos');
    }
  }

  async function saveRolePermissions() {
    const select = $('rolePermissionsSelect');
    const grid = $('permissionsGrid');
    if (!select || !grid) return;

    const role = select.value;
    const permisos = Array.from(grid.querySelectorAll('input[type="checkbox"]:checked'))
      .map(input => input.value);
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
      renderPermissionsGrid(role);
    } catch (error) {
      showMessage('rolePermissions', 'error', error.message || 'Error al guardar permisos');
    } finally {
      btn.disabled = role === 'admin';
      btn.textContent = role === 'admin' ? 'Admin conserva todos los permisos' : 'Guardar permisos';
    }
  }

  function bindForms() {
    const passwordForm = $('passwordForm');
    if (passwordForm) passwordForm.addEventListener('submit', handlePasswordSubmit);

    const userForm = $('adminUserForm');
    if (userForm) userForm.addEventListener('submit', handleUserSubmit);

    const cancel = $('adminUserCancel');
    if (cancel) cancel.addEventListener('click', resetUserForm);

    const rolePermissionsSelect = $('rolePermissionsSelect');
    if (rolePermissionsSelect) rolePermissionsSelect.addEventListener('change', handleRoleChange);

    const savePermissions = $('saveRolePermissions');
    if (savePermissions) savePermissions.addEventListener('click', saveRolePermissions);
  }

  async function init() {
    setHeaderDate();
    bindForms();
    bindUserTable();

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
