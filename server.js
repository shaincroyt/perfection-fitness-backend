const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./database');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const publicDir = path.join(__dirname, '..', 'public');
const adminDir = path.join(__dirname, 'admin');
const adminAssetsDir = path.join(__dirname, 'admin-assets');
const privateAdminPages = new Set([
    'dashboard.html',
    'clientes.html',
    'membresias.html',
    'validar.html',
    'asistencias.html',
    'planes.html',
    'configuracion.html',
    'nueva-membresia.html'
]);
const ADMIN_PAGE_PERMISSIONS = {
    'dashboard.html': 'dashboard.ver',
    'clientes.html': 'clientes.ver',
    'membresias.html': 'membresias.ver',
    'nueva-membresia.html': 'membresias.crear',
    'validar.html': 'validacion.usar',
    'asistencias.html': 'asistencias.ver',
    'planes.html': 'planes.ver',
    'configuracion.html': 'configuracion.ver'
};

app.set('trust proxy', 1);

app.use(cors({
    origin: [
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'https://splendid-dolphin-88f54a.netlify.app'
    ],
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: 'perfection-fitness-clave-secreta-cambiala',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 4
    }
}));

const ROLES_ADMIN = new Set(['admin', 'recepcion']);
const ESTADOS_ADMIN = new Set(['activo', 'inactivo']);
const ROLES_SISTEMA = new Set(['admin', 'recepcion']);
const PERMISOS_BASE = [
    { codigo: 'clientes.ver', nombre: 'Ver clientes', categoria: 'Clientes', descripcion: 'Permite listar y consultar clientes' },
    { codigo: 'clientes.crear', nombre: 'Crear clientes', categoria: 'Clientes', descripcion: 'Permite registrar clientes' },
    { codigo: 'clientes.editar', nombre: 'Editar clientes', categoria: 'Clientes', descripcion: 'Permite actualizar clientes' },
    { codigo: 'clientes.eliminar', nombre: 'Eliminar clientes', categoria: 'Clientes', descripcion: 'Permite eliminar o desactivar clientes' },
    { codigo: 'clientes.notas.ver', nombre: 'Ver notas de clientes', categoria: 'Clientes', descripcion: 'Permite consultar notas internas de clientes' },
    { codigo: 'clientes.notas.crear', nombre: 'Crear notas de clientes', categoria: 'Clientes', descripcion: 'Permite agregar notas internas de clientes' },
    { codigo: 'clientes.notas.editar', nombre: 'Editar notas de clientes', categoria: 'Clientes', descripcion: 'Permite editar notas internas de clientes' },
    { codigo: 'clientes.notas.eliminar', nombre: 'Eliminar notas de clientes', categoria: 'Clientes', descripcion: 'Permite eliminar notas internas de clientes' },
    { codigo: 'membresias.ver', nombre: 'Ver membresias', categoria: 'Membresias', descripcion: 'Permite listar membresias' },
    { codigo: 'membresias.crear', nombre: 'Crear membresias', categoria: 'Membresias', descripcion: 'Permite crear membresias' },
    { codigo: 'membresias.editar', nombre: 'Editar membresias', categoria: 'Membresias', descripcion: 'Permite actualizar membresias' },
    { codigo: 'membresias.eliminar', nombre: 'Eliminar membresias', categoria: 'Membresias', descripcion: 'Permite eliminar membresias' },
    { codigo: 'membresias.renovar', nombre: 'Renovar membresias', categoria: 'Membresias', descripcion: 'Permite renovar membresias' },
    { codigo: 'membresias.congelar', nombre: 'Congelar membresias', categoria: 'Membresias', descripcion: 'Permite congelar membresias activas' },
    { codigo: 'planes.ver', nombre: 'Ver planes', categoria: 'Planes', descripcion: 'Permite listar planes' },
    { codigo: 'planes.crear', nombre: 'Crear planes', categoria: 'Planes', descripcion: 'Permite crear planes' },
    { codigo: 'planes.editar', nombre: 'Editar planes', categoria: 'Planes', descripcion: 'Permite actualizar planes' },
    { codigo: 'planes.eliminar', nombre: 'Eliminar planes', categoria: 'Planes', descripcion: 'Permite eliminar o desactivar planes' },
    { codigo: 'asistencias.ver', nombre: 'Ver asistencias', categoria: 'Asistencias', descripcion: 'Permite listar asistencias' },
    { codigo: 'asistencias.eliminar', nombre: 'Eliminar asistencias', categoria: 'Asistencias', descripcion: 'Permite eliminar asistencias' },
    { codigo: 'validacion.usar', nombre: 'Usar validacion', categoria: 'Validacion', descripcion: 'Permite validar ingresos' },
    { codigo: 'dashboard.ver', nombre: 'Ver dashboard', categoria: 'Dashboard', descripcion: 'Permite acceder al dashboard' },
    { codigo: 'configuracion.ver', nombre: 'Ver configuracion', categoria: 'Configuracion', descripcion: 'Permite acceder a configuracion' },
    { codigo: 'usuarios.ver', nombre: 'Ver usuarios', categoria: 'Usuarios', descripcion: 'Permite listar usuarios administrativos' },
    { codigo: 'usuarios.crear', nombre: 'Crear usuarios', categoria: 'Usuarios', descripcion: 'Permite crear usuarios administrativos' },
    { codigo: 'usuarios.editar', nombre: 'Editar usuarios', categoria: 'Usuarios', descripcion: 'Permite actualizar usuarios administrativos' },
    { codigo: 'usuarios.desactivar', nombre: 'Desactivar usuarios', categoria: 'Usuarios', descripcion: 'Permite activar o desactivar usuarios administrativos' },
    { codigo: 'roles.ver', nombre: 'Ver roles', categoria: 'Roles', descripcion: 'Permite consultar roles administrativos' },
    { codigo: 'roles.crear', nombre: 'Crear roles', categoria: 'Roles', descripcion: 'Permite crear roles administrativos' },
    { codigo: 'roles.editar', nombre: 'Editar roles', categoria: 'Roles', descripcion: 'Permite editar roles administrativos' },
    { codigo: 'roles.eliminar', nombre: 'Eliminar roles', categoria: 'Roles', descripcion: 'Permite eliminar o desactivar roles administrativos' },
    { codigo: 'roles.asignar_permisos', nombre: 'Asignar permisos', categoria: 'Roles', descripcion: 'Permite administrar permisos de roles' },
    { codigo: 'exportar.clientes', nombre: 'Exportar clientes', categoria: 'Exportaciones', descripcion: 'Permite exportar clientes' },
    { codigo: 'exportar.membresias', nombre: 'Exportar membresias', categoria: 'Exportaciones', descripcion: 'Permite exportar membresias' },
    { codigo: 'exportar.asistencias', nombre: 'Exportar asistencias', categoria: 'Exportaciones', descripcion: 'Permite exportar asistencias' },
    { codigo: 'notificaciones.ver', nombre: 'Ver notificaciones', categoria: 'Notificaciones', descripcion: 'Permite ver notificaciones' },
    { codigo: 'notificaciones.marcar_leida', nombre: 'Marcar notificacion como leida', categoria: 'Notificaciones', descripcion: 'Permite marcar notificaciones como leidas' },
    { codigo: 'notificaciones.eliminar', nombre: 'Eliminar notificaciones', categoria: 'Notificaciones', descripcion: 'Permite eliminar notificaciones' }
];
const TODOS_LOS_PERMISOS = PERMISOS_BASE.map(permiso => permiso.codigo);
const PERMISOS_RECEPCION_DEFAULT = [
    'dashboard.ver',
    'clientes.ver',
    'clientes.crear',
    'clientes.editar',
    'clientes.notas.ver',
    'clientes.notas.crear',
    'membresias.ver',
    'membresias.crear',
    'membresias.renovar',
    'membresias.congelar',
    'planes.ver',
    'asistencias.ver',
    'validacion.usar',
    'notificaciones.ver',
    'notificaciones.marcar_leida'
];

async function asegurarColumnasPlanes() {
    const [[columnaColorPrecio]] = await pool.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'planes'
           AND COLUMN_NAME = 'color_precio'`
    );

    if (!columnaColorPrecio) {
        await pool.query(
            `ALTER TABLE planes
             ADD COLUMN color_precio varchar(7) DEFAULT NULL`
        );
    }
}

async function asegurarPermisosBase() {
    try {
        for (const permiso of PERMISOS_BASE) {
            await pool.query(
                `INSERT IGNORE INTO permisos_admin (codigo, nombre, categoria, descripcion)
                 VALUES (?, ?, ?, ?)`,
                [permiso.codigo, permiso.nombre, permiso.categoria, permiso.descripcion]
            );
        }
    } catch (error) {
        if (!error || (error.code !== 'ER_NO_SUCH_TABLE' && error.code !== 'ER_BAD_FIELD_ERROR')) {
            throw error;
        }
    }
}

async function asegurarTablasClientePerfil() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS cliente_eventos (
            id INT NOT NULL AUTO_INCREMENT,
            empresa_id INT NOT NULL,
            cliente_id INT NOT NULL,
            usuario_id INT NULL,
            tipo_evento VARCHAR(60) NOT NULL,
            titulo VARCHAR(160) NOT NULL,
            descripcion TEXT NULL,
            metadata TEXT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_cliente_eventos_cliente (empresa_id, cliente_id, created_at),
            KEY idx_cliente_eventos_tipo (empresa_id, tipo_evento)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS cliente_notas (
            id INT NOT NULL AUTO_INCREMENT,
            empresa_id INT NOT NULL,
            cliente_id INT NOT NULL,
            usuario_id INT NULL,
            nota TEXT NOT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT NULL,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_cliente_notas_cliente (empresa_id, cliente_id, deleted_at, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS membresia_congelamientos (
            id INT NOT NULL AUTO_INCREMENT,
            empresa_id INT NOT NULL,
            membresia_id INT NOT NULL,
            cliente_id INT NOT NULL,
            usuario_id INT NULL,
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            dias_congelados INT NOT NULL,
            motivo TEXT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_congelamientos_membresia (empresa_id, membresia_id),
            KEY idx_congelamientos_cliente (empresa_id, cliente_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

function metadataEvento(valor) {
    if (valor === null || valor === undefined) return null;
    try {
        return JSON.stringify(valor);
    } catch (error) {
        return null;
    }
}

async function registrarEventoCliente({
    empresa_id,
    cliente_id,
    usuario_id = null,
    tipo_evento,
    titulo,
    descripcion = null,
    metadata = null
}, conn = pool) {
    try {
        if (!empresa_id || !cliente_id || !tipo_evento || !titulo) return;

        await conn.query(
            `INSERT INTO cliente_eventos
             (empresa_id, cliente_id, usuario_id, tipo_evento, titulo, descripcion, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                empresa_id,
                cliente_id,
                usuario_id,
                tipo_evento,
                titulo,
                descripcion,
                metadataEvento(metadata)
            ]
        );
    } catch (error) {
        console.error('Error registrando evento de cliente:', error);
    }
}

function adminEvento(req) {
    return {
        empresa_id: getEmpresaId(req),
        usuario_id: req.session && req.session.adminId ? req.session.adminId : null,
        usuario_nombre: req.session && req.session.adminNombre ? req.session.adminNombre : null
    };
}
const TEMA_EMPRESA_DEFAULT = {
    color_primario: '#7C3AED',
    color_secundario: '#A855F7',
    color_acento: '#A78BFA',
    bg_body: '#070A14',
    bg_card: '#161627',
    text_principal: '#F0EFFF',
    text_secundario: 'rgba(200,196,240,.72)',
    table_border: 'rgba(255,255,255,.09)',
    theme_glow: 'rgba(124, 58, 237, 0.32) 0px 11px 26px',
    validation_active_bg: 'var(--theme-bg)',
    validation_active_surface: 'var(--theme-surface)',
    validation_active_border: 'var(--theme-border)',
    validation_active_text: 'var(--theme-text)',
    validation_active_muted: 'var(--theme-muted)',
    validation_active_accent: 'var(--theme-primary)',
    validation_denied_bg: '#450A0A',
    validation_denied_surface: '#7F1D1D',
    validation_denied_border: 'rgba(248,113,113,.35)',
    validation_denied_text: '#FEE2E2',
    validation_denied_muted: '#FECACA',
    validation_denied_accent: '#EF4444'
};

function valorCssSeguro(valor, fallback) {
    const normalizado = String(valor || fallback || '').trim();
    if (!normalizado || /[{};]/.test(normalizado)) {
        return fallback;
    }

    return normalizado;
}

function generarCssTemaEmpresa(empresa = {}) {
    const tema = {
        color_primario: valorCssSeguro(empresa.color_primario, TEMA_EMPRESA_DEFAULT.color_primario),
        color_secundario: valorCssSeguro(empresa.color_secundario, TEMA_EMPRESA_DEFAULT.color_secundario),
        color_acento: valorCssSeguro(empresa.color_acento, TEMA_EMPRESA_DEFAULT.color_acento),
        bg_body: valorCssSeguro(empresa.bg_body, TEMA_EMPRESA_DEFAULT.bg_body),
        bg_card: valorCssSeguro(empresa.bg_card, TEMA_EMPRESA_DEFAULT.bg_card),
        text_principal: valorCssSeguro(empresa.text_principal, TEMA_EMPRESA_DEFAULT.text_principal),
        text_secundario: valorCssSeguro(empresa.text_secundario, TEMA_EMPRESA_DEFAULT.text_secundario),
        table_border: valorCssSeguro(empresa.table_border, TEMA_EMPRESA_DEFAULT.table_border),
        theme_glow: valorCssSeguro(empresa.theme_glow, TEMA_EMPRESA_DEFAULT.theme_glow),
        validation_active_bg: valorCssSeguro(empresa.validation_active_bg, TEMA_EMPRESA_DEFAULT.validation_active_bg),
        validation_active_surface: valorCssSeguro(empresa.validation_active_surface, TEMA_EMPRESA_DEFAULT.validation_active_surface),
        validation_active_border: valorCssSeguro(empresa.validation_active_border, TEMA_EMPRESA_DEFAULT.validation_active_border),
        validation_active_text: valorCssSeguro(empresa.validation_active_text, TEMA_EMPRESA_DEFAULT.validation_active_text),
        validation_active_muted: valorCssSeguro(empresa.validation_active_muted, TEMA_EMPRESA_DEFAULT.validation_active_muted),
        validation_active_accent: valorCssSeguro(empresa.validation_active_accent, TEMA_EMPRESA_DEFAULT.validation_active_accent),
        validation_denied_bg: valorCssSeguro(empresa.validation_denied_bg, TEMA_EMPRESA_DEFAULT.validation_denied_bg),
        validation_denied_surface: valorCssSeguro(empresa.validation_denied_surface, TEMA_EMPRESA_DEFAULT.validation_denied_surface),
        validation_denied_border: valorCssSeguro(empresa.validation_denied_border, TEMA_EMPRESA_DEFAULT.validation_denied_border),
        validation_denied_text: valorCssSeguro(empresa.validation_denied_text, TEMA_EMPRESA_DEFAULT.validation_denied_text),
        validation_denied_muted: valorCssSeguro(empresa.validation_denied_muted, TEMA_EMPRESA_DEFAULT.validation_denied_muted),
        validation_denied_accent: valorCssSeguro(empresa.validation_denied_accent, TEMA_EMPRESA_DEFAULT.validation_denied_accent)
    };

    return `:root {
  --theme-primary: ${tema.color_primario};
  --theme-secondary: ${tema.color_secundario};
  --theme-accent: ${tema.color_acento};
  --theme-bg: ${tema.bg_body};
  --theme-surface: ${tema.bg_card};
  --theme-text: ${tema.text_principal};
  --theme-muted: ${tema.text_secundario};
  --theme-border: ${tema.table_border};
  --theme-glow: ${tema.theme_glow};
  --validation-active-bg: ${tema.validation_active_bg};
  --validation-active-surface: ${tema.validation_active_surface};
  --validation-active-border: ${tema.validation_active_border};
  --validation-active-text: ${tema.validation_active_text};
  --validation-active-muted: ${tema.validation_active_muted};
  --validation-active-accent: ${tema.validation_active_accent};
  --validation-denied-bg: ${tema.validation_denied_bg};
  --validation-denied-surface: ${tema.validation_denied_surface};
  --validation-denied-border: ${tema.validation_denied_border};
  --validation-denied-text: ${tema.validation_denied_text};
  --validation-denied-muted: ${tema.validation_denied_muted};
  --validation-denied-accent: ${tema.validation_denied_accent};
}
`;
}

function responderSesionInvalida(req, res, mensaje = 'Sesion no activa') {
    if (req.originalUrl.startsWith('/admin')) {
        return res.redirect('/admin/index.html');
    }

    return res.status(401).json({
        ok: false,
        error: mensaje
    });
}

function destruirSesion(req) {
    return new Promise(resolve => {
        if (!req.session) return resolve();
        req.session.destroy(() => resolve());
    });
}

function regenerarSesion(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(error => {
            if (error) return reject(error);
            return resolve();
        });
    });
}

async function obtenerUsuarioSesion(req) {
    if (!req.session || !req.session.admin || !req.session.adminId) {
        return null;
    }

    const [rows] = await pool.query(
        `SELECT id, empresa_id, usuario, nombre, estado, rol, session_id, ultimo_login, fecha_creacion
        FROM usuarios_admin
        WHERE id = ?
        LIMIT 1`,
        [req.session.adminId]
    );

    return rows[0] || null;
}

async function rolSesionActivo(rol, empresaId = 1) {
    try {
        const registro = await obtenerRolAdmin(rol, empresaId);
        return !registro || registro.estado === 'activo';
    } catch (error) {
        if (tablaRolesNoExiste(error)) {
            return true;
        }
        throw error;
    }
}

async function rolAsignable(rol, empresaId) {
    const codigo = normalizarCodigoRol(rol);

    try {
        const registro = await obtenerRolAdmin(codigo, empresaId);
        return Boolean(registro && registro.estado === 'activo');
    } catch (error) {
        if (tablaRolesNoExiste(error)) {
            return ROLES_ADMIN.has(codigo);
        }
        throw error;
    }
}

async function requireAdminSession(req, res, next) {
    try {
        const admin = await obtenerUsuarioSesion(req);

        if (!admin || admin.estado !== 'activo') {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return responderSesionInvalida(req, res);
        }

        if (!await rolSesionActivo(admin.rol || 'recepcion', admin.empresa_id || 1)) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return responderSesionInvalida(req, res, 'Rol desactivado');
        }

        if (!admin.session_id || admin.session_id !== req.sessionID) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return responderSesionInvalida(req, res, 'Sesion invalidada por un nuevo inicio de sesion');
        }

        req.session.admin = true;
        req.session.adminId = admin.id;
        req.session.adminNombre = admin.nombre;
        req.session.adminUsuario = admin.usuario;

        req.session.adminRol = admin.rol || 'recepcion';
        req.session.empresa_id = admin.empresa_id || 1;
        
        req.adminUser = admin;

        req.empresaId = req.session.empresa_id;

        return next();
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al validar sesion'
        });
    }
}

function requireRole(rol) {
    return (req, res, next) => {
        const rolActual = req.adminUser && req.adminUser.rol
            ? req.adminUser.rol
            : req.session && req.session.adminRol;

        if (rolActual === rol) {
            return next();
        }

        return res.status(403).json({
            ok: false,
            code: 'permission_denied',
            title: 'Acceso denegado',
            error: 'No tienes permisos para realizar esta accion.'
        });
    };
}

function esAdminTotal(admin) {
    return Boolean(admin && (Number(admin.id) === 1 || admin.rol === 'admin'));
}

function permisosFallbackPorRol(rol) {
    return rol === 'admin' ? TODOS_LOS_PERMISOS : PERMISOS_RECEPCION_DEFAULT;
}

async function obtenerCodigosPermisosRol(rol, empresaId, conn = pool) {
    rol = normalizarCodigoRol(rol);

    if (rol === 'admin') {
        return TODOS_LOS_PERMISOS;
    }

    try {
        const [rows] = await conn.query(
            `SELECT p.codigo
             FROM roles_permisos rp
             INNER JOIN permisos_admin p ON p.id = rp.permiso_id
             WHERE rp.rol_codigo = ? AND rp.empresa_id = ?
             ORDER BY p.categoria ASC, p.codigo ASC`,
            [rol, empresaId]
        );

        return rows.map(row => row.codigo);
    } catch (error) {
        if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR')) {
            return permisosFallbackPorRol(rol);
        }

        throw error;
    }
}

async function obtenerCodigosPermisosUsuario(admin, conn = pool) {
    if (esAdminTotal(admin)) {
        return TODOS_LOS_PERMISOS;
    }

    return obtenerCodigosPermisosRol(admin && admin.rol ? admin.rol : 'recepcion', admin.empresa_id || 1, conn);
}

async function tienePermiso(admin, codigo) {
    if (esAdminTotal(admin)) {
        return true;
    }

    const permisos = await obtenerCodigosPermisosUsuario(admin);
    return permisos.includes(codigo);
}

async function protegerPaginasAdmin(req, res, next) {
    try {
        const page = path.basename(req.path || '');

        if (!page || !page.endsWith('.html')) {
            return next();
        }

        if (page === 'index.html') {
            return next();
        }

        if (!privateAdminPages.has(page)) {
            return next();
        }

        const admin = await obtenerUsuarioSesion(req);

        if (!admin || admin.estado !== 'activo') {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.redirect('/admin/index.html');
        }

        if (!await rolSesionActivo(admin.rol || 'recepcion', admin.empresa_id || 1)) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.redirect('/admin/index.html');
        }

        if (!admin.session_id || admin.session_id !== req.sessionID) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.redirect('/admin/index.html');
        }

        req.session.admin = true;
        req.session.adminId = admin.id;
        req.session.adminNombre = admin.nombre;
        req.session.adminUsuario = admin.usuario;
        req.session.adminRol = admin.rol || 'recepcion';
        req.session.empresa_id = admin.empresa_id || 1;

        req.adminUser = admin;
        req.empresaId = req.session.empresa_id;

        const permisoPagina = ADMIN_PAGE_PERMISSIONS[page];
        if (permisoPagina && !await tienePermiso(admin, permisoPagina)) {
            if (page === 'dashboard.html') {
                return res.status(403).send(htmlAccesoDenegado());
            }

            return res.redirect('/admin/dashboard.html?error=sin_permiso');
        }

        return next();
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error al validar acceso');
    }
}

function requirePermission(codigo) {
    return async (req, res, next) => {
        try {
            const permitido = await tienePermiso(req.adminUser, codigo);

            if (permitido) {
                return next();
            }

            return res.status(403).json({
                ok: false,
                code: 'permission_denied',
                title: 'Acceso denegado',
                error: 'No tienes permisos para realizar esta accion.'
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                ok: false,
                error: 'Error al validar permisos'
            });
        }
    };
}

function htmlAccesoDenegado() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso denegado</title>
  <link rel="stylesheet" href="/admin/styles/admin.css">
</head>
<body class="admin-page">
  <div class="admin-access-denied-overlay open" style="position:fixed;">
    <div class="admin-access-denied-modal">
      <div class="admin-access-denied-icon">!</div>
      <h2>Acceso denegado</h2>
      <p>No tienes permisos para acceder a esta sección.</p>
      <button type="button" onclick="window.location.href='/admin/dashboard.html'">Ir al dashboard</button>
    </div>
  </div>
</body>
</html>`;
}

function agruparPermisos(permisos) {
    return permisos.reduce((grupos, permiso) => {
        const categoria = permiso.categoria || 'General';
        if (!grupos[categoria]) {
            grupos[categoria] = [];
        }
        grupos[categoria].push(permiso);
        return grupos;
    }, {});
}

async function obtenerPermisosVersionRol(rol, empresaId) {
    rol = normalizarCodigoRol(rol);

    if (rol === 'admin') {
        return TODOS_LOS_PERMISOS.length;
    }

    try {
        const [[row]] = await pool.query(
            `SELECT COALESCE(CRC32(COALESCE(GROUP_CONCAT(p.codigo ORDER BY p.codigo SEPARATOR ','), '')), 0) AS version
             FROM roles_permisos rp
             INNER JOIN permisos_admin p ON p.id = rp.permiso_id
             WHERE rp.rol_codigo = ? AND rp.empresa_id = ?`,
            [rol, empresaId]
        );

        return Number(row.version || 0);
    } catch (error) {
        if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR')) {
            return 0;
        }

        throw error;
    }
}

function getSessionAdmin(req) {
    return {
        id: req.session.adminId,
        nombre: req.session.adminNombre,
        usuario: req.session.adminUsuario,
        rol: req.session.adminRol || 'recepcion'
    };
}
function getEmpresaId(req) {
    return Number(req.session?.empresa_id || req.adminUser?.empresa_id || 1);
}

function formatearMoneda(valor) {
    return `S/${Number(valor || 0).toFixed(2)}`;
}

function formatearFechaCorta(valor) {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor).slice(0, 10);
    return fecha.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

let notificacionesEventoKeyDisponible = null;

async function tieneColumnaEventoKey(conn = pool) {
    if (notificacionesEventoKeyDisponible !== null) {
        return notificacionesEventoKeyDisponible;
    }

    try {
        const [rows] = await conn.query(`
            SELECT COUNT(*) AS total
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'notificaciones'
            AND COLUMN_NAME = 'evento_key'
        `);

        notificacionesEventoKeyDisponible = Number(rows[0]?.total || 0) > 0;
        return notificacionesEventoKeyDisponible;
    } catch (error) {
        notificacionesEventoKeyDisponible = false;
        return false;
    }
}

async function crearNotificacion({
    tipo,
    titulo,
    mensaje,
    entidad,
    entidad_id,
    usuario_id = null,
    usuario_nombre = null,
    evento_key = 'default',
    empresa_id = 1
}, conn = pool) {
    try {
        const usarEventoKey = await tieneColumnaEventoKey(conn);

        if (usarEventoKey) {
            await conn.query(
                `INSERT IGNORE INTO notificaciones
                (empresa_id, tipo, titulo, mensaje, entidad, entidad_id, usuario_id, usuario_nombre, evento_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    empresa_id,
                    tipo,
                    titulo,
                    mensaje,
                    entidad,
                    entidad_id,
                    usuario_id,
                    usuario_nombre,
                    evento_key
                ]
            );
            return;
        }

        await conn.query(
            `INSERT IGNORE INTO notificaciones
             (tipo, titulo, mensaje, entidad, entidad_id, usuario_id, usuario_nombre)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                tipo,
                titulo,
                mensaje,
                entidad,
                evento_key === null ? Math.floor(Math.random() * 2147483647) : entidad_id,
                usuario_id,
                usuario_nombre
            ]
        );
    } catch (error) {
        console.error('Error creando notificacion:', error);
    }
}

function adminNotificacion(req) {
    return {

        empresa_id: getEmpresaId(req),
        usuario_id: req.session && req.session.adminId ? req.session.adminId : null,
        usuario_nombre: req.session && req.session.adminNombre ? req.session.adminNombre : null
    };
}

function nombreRol(rol) {
    return rol === 'admin' ? 'admin' : (rol || 'recepcion');
}

function roleLabelBackend(rol) {
    if (rol === 'admin') return 'Admin';
    if (rol === 'recepcion') return 'Recepcion';
    return String(rol || 'recepcion');
}

function normalizarCodigoRol(rol) {
    return limpiarTexto(rol || 'recepcion').toLowerCase();
}

function generarCodigoRol(nombre) {
    return limpiarTexto(nombre)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 45) || 'rol';
}

function tablaRolesNoExiste(error) {
    return error && error.code === 'ER_NO_SUCH_TABLE';
}

async function obtenerRolAdmin(codigo, empresaId, conn = pool) {
    const [rows] = await conn.query(
        `SELECT codigo, nombre, descripcion, estado, sistema
         FROM roles_admin
         WHERE codigo = ? AND empresa_id = ?
         LIMIT 1`,
        [normalizarCodigoRol(codigo), empresaId]
    );

    return rows[0] || null;
}

async function asegurarRolesBase(empresaId, conn = pool) {
    try {
        await conn.query(
            `INSERT INTO roles_admin (empresa_id, codigo, nombre, descripcion, estado, sistema)
             VALUES
             (?, 'admin', 'Administrador', 'Acceso total al sistema y configuracion del gimnasio.', 'activo', 1),
             (?, 'recepcion', 'Recepcion', 'Gestiona ingresos, clientes y atencion al cliente.', 'activo', 1)
             ON DUPLICATE KEY UPDATE
                sistema = 1,
                estado = CASE WHEN codigo IN ('admin', 'recepcion') THEN estado ELSE VALUES(estado) END`,
             [empresaId, empresaId]
        );
    } catch (error) {
        if (!tablaRolesNoExiste(error)) throw error;
    }
}

async function generarCodigoRolUnico(nombre, empresaId, conn = pool, excluir = null) {
    const base = generarCodigoRol(nombre);
    let codigo = base;
    let contador = 2;

    while (true) {
        const params = [codigo, empresaId];
        let filtro = '';
        if (excluir) {
            filtro = 'AND codigo <> ?';
            params.push(excluir);
        }

        const [[row]] = await conn.query(
            `SELECT COUNT(*) AS total
             FROM roles_admin
             WHERE codigo = ? AND empresa_id = ?
             ${filtro}`,
            params
        );

        if (Number(row.total || 0) === 0) {
            return codigo;
        }

        codigo = `${base}_${contador}`;
        contador += 1;
    }
}

async function asignarPermisosARol(conn, rol, empresaId, permisos) {
    const codigos = Array.from(new Set((permisos || []).map(limpiarTexto).filter(Boolean)));
    await conn.query('DELETE FROM roles_permisos WHERE rol_codigo = ? AND empresa_id = ?', [rol, empresaId]);

    if (codigos.length === 0) {
        return [];
    }

    const [permisosValidos] = await conn.query(
        `SELECT id, codigo
         FROM permisos_admin
         WHERE codigo IN (?)`,
        [codigos]
    );

    if (permisosValidos.length > 0) {
        await conn.query(
            `INSERT INTO roles_permisos (empresa_id, rol_codigo, permiso_id)
             VALUES ${permisosValidos.map(() => '(?, ?, ?)').join(', ')}`,
            permisosValidos.flatMap(permiso => [empresaId, rol, permiso.id])
        );
    }

    return permisosValidos.map(permiso => permiso.codigo);
}

async function permisosBaseParaNuevoRol(basadoEn, empresaId, conn = pool) {
    const base = normalizarCodigoRol(basadoEn || 'vacio');

    if (!base || base === 'vacio') {
        return [];
    }

    if (base === 'supervisor') {
        return Array.from(new Set([
            ...PERMISOS_RECEPCION_DEFAULT,
            'clientes.eliminar',
            'membresias.eliminar',
            'asistencias.eliminar',
            'exportar.clientes',
            'exportar.membresias',
            'exportar.asistencias'
        ]));
    }

    return obtenerCodigosPermisosRol(base, empresaId, conn);
}

async function crearNotificacionAuditoriaUsuario(req, {
    tipo,
    titulo,
    mensaje,
    entidad_id,
    evento_key = null
}) {
    await crearNotificacion({
        tipo,
        titulo,
        mensaje,
        entidad: 'usuario_admin',
        entidad_id,
        ...adminNotificacion(req),
        evento_key
    });
}

async function obtenerResumenMembresia(id, empresaId, conn = pool) {
    const [[membresia]] = await conn.query(
        `SELECT
            m.id,
            m.cliente_id,
            c.nombre AS cliente,
            p.nombre AS plan,
            m.precio_total,
            m.fecha_fin
         FROM membresias m
         INNER JOIN clientes c
            ON c.id = m.cliente_id
            AND c.empresa_id = m.empresa_id
         INNER JOIN planes p
            ON p.id = m.plan_id
            AND p.empresa_id = m.empresa_id
         WHERE m.id = ?
         AND m.empresa_id = ?
         LIMIT 1`,
        [id, empresaId]
    );

    return membresia;
}

async function sincronizarNotificacionesVencimiento() {
    await actualizarMembresiasVencidas();

    const [porVencer] = await pool.query(`
        SELECT
            m.id,
            m.empresa_id,
            c.nombre AS cliente,
            DATE_FORMAT(m.fecha_fin, '%Y-%m-%d') AS fecha_fin
        FROM membresias m
        INNER JOIN clientes c
ON c.id = m.cliente_id
AND c.empresa_id = m.empresa_id
        WHERE m.estado = 'activa'
        AND COALESCE(m.duracion_unidad, 'meses') != 'usos'
        AND DATE(m.fecha_fin) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
    `);

    for (const item of porVencer) {
    await crearNotificacion({
        empresa_id: item.empresa_id,
        evento_key: `${item.id}-vencimiento-${item.fecha_fin}`,

        tipo: 'membresia_por_vencer',
        titulo: 'Membresia por vencer',
        mensaje: `La membresia de ${item.cliente} vence el ${formatearFechaCorta(item.fecha_fin)}.`,

        entidad: 'membresia',
        entidad_id: item.id
    });
}

    const [vencidas] = await pool.query(`
        SELECT
            m.id,
            m.empresa_id,
            c.nombre AS cliente,
            DATE_FORMAT(m.fecha_fin, '%Y-%m-%d') AS fecha_fin
        FROM membresias m
        INNER JOIN clientes c
ON c.id = m.cliente_id
AND c.empresa_id = m.empresa_id
        WHERE m.estado = 'vencida'
        AND COALESCE(m.duracion_unidad, 'meses') != 'usos'
        AND DATE(m.fecha_fin) < CURDATE()
    `);

    for (const item of vencidas) {
    await crearNotificacion({
        empresa_id: item.empresa_id,
        evento_key: `${item.id}-vencida-${item.fecha_fin}`,

        tipo: 'membresia_vencida',
        titulo: 'Membresia vencida',
        mensaje: `La membresia de ${item.cliente} vencio el ${formatearFechaCorta(item.fecha_fin)}.`,

        entidad: 'membresia',
        entidad_id: item.id
    });
}
}

function generarHashPassword(password) {
    return bcrypt.hash(String(password), 10);
}

app.post('/api/admin/crear-inicial', async (req, res) => {
    try {
        const { usuario, password, nombre } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({
                ok: false,
                error: 'Usuario y password son obligatorios'
            });
        }

        const [[total]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM usuarios_admin
        `);

        if (total.total > 0) {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe un usuario administrador'
            });
        }

        await pool.query(`
            INSERT INTO empresas (id, nombre, estado)
            VALUES (1, 'Empresa Principal', 'activo')
            ON DUPLICATE KEY UPDATE estado = 'activo'
        `);

        const usuarioLimpio = String(usuario).trim();
        const nombreLimpio = String(nombre || 'Administrador').trim();
        const passwordHash = await generarHashPassword(password);

        const [result] = await pool.query(
            `INSERT INTO usuarios_admin (empresa_id, usuario, password_hash, nombre, estado, rol)
             VALUES (1, ?, ?, ?, 'activo', 'admin')`,
            [usuarioLimpio, passwordHash, nombreLimpio]
        );

        return res.json({
            ok: true,
            admin: {
                id: result.insertId,
                empresa_id: 1,
                usuario: usuarioLimpio,
                nombre: nombreLimpio,
                rol: 'admin'
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al crear usuario administrador'
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(401).json({
                ok: false,
                error: 'Usuario o contrasena incorrectos'
            });
        }

        const [rows] = await pool.query(
            `SELECT id, empresa_id, usuario, password_hash, nombre, estado, rol
            FROM usuarios_admin
            WHERE BINARY usuario = BINARY ?
            LIMIT 1`,
            [String(usuario).trim()]
        );

        const admin = rows[0];

        if (!admin || admin.estado !== 'activo') {
            return res.status(401).json({
                ok: false,
                error: 'Usuario o contrasena incorrectos'
            });
        }

        if (!await rolSesionActivo(admin.rol || 'recepcion', admin.empresa_id || 1)) {
            return res.status(401).json({
                ok: false,
                error: 'Rol desactivado'
            });
        }

        const passwordOk = await bcrypt.compare(
            String(password),
            admin.password_hash
        );

        if (!passwordOk) {
            return res.status(401).json({
                ok: false,
                error: 'Usuario o contrasena incorrectos'
            });
        }

        await regenerarSesion(req);

        req.session.admin = true;
        req.session.adminId = admin.id;
        req.session.adminNombre = admin.nombre;
        req.session.adminUsuario = admin.usuario;
        req.session.adminRol = admin.rol || 'recepcion';
        req.session.empresa_id = admin.empresa_id || 1;
        req.session.loginAt = new Date().toISOString();

        await pool.query(
            `UPDATE usuarios_admin
             SET session_id = ?, ultimo_login = NOW()
             WHERE id = ?`,
            [req.sessionID, admin.id]
        );

        await crearNotificacion({
            empresa_id: admin.empresa_id || 1,
            tipo: 'usuario_login',
            titulo: 'Inicio de sesion',
            mensaje: `${admin.nombre} inicio sesion como ${nombreRol(admin.rol)}.`,
            entidad: 'usuario_admin',
            entidad_id: admin.id,
            usuario_id: admin.id,
            usuario_nombre: admin.nombre,
            evento_key: null
        });

        return res.json({
            ok: true,
            admin: {
                id: admin.id,
                nombre: admin.nombre,
                usuario: admin.usuario,
                rol: admin.rol || 'recepcion'
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al iniciar sesion'
        });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        if (req.session && req.session.adminId) {
            await pool.query(
                `UPDATE usuarios_admin
                 SET session_id = NULL
                 WHERE id = ? AND session_id = ?`,
                [req.session.adminId, req.sessionID]
            );
        }
    } catch (error) {
        console.error('Error limpiando session_id:', error);
    }

    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                ok: false,
                error: 'Error al cerrar sesión'
            });
        }

        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

app.get('/api/verificar-sesion', async (req, res) => {
    try {
        const admin = await obtenerUsuarioSesion(req);

        if (!admin || admin.estado !== 'activo' || !admin.session_id || admin.session_id !== req.sessionID || !await rolSesionActivo(admin.rol || 'recepcion', admin.empresa_id || 1)) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.status(401).json({
                logueado: false
            });
        }

        req.session.adminRol = admin.rol || 'recepcion';
        req.session.empresa_id = admin.empresa_id || 1;

        return res.json({
            logueado: true,
            admin: {
                id: admin.id,
                nombre: admin.nombre,
                usuario: admin.usuario,
                rol: admin.rol || 'recepcion'
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            logueado: false,
            error: 'Error al verificar sesion'
        });
    }
});

app.get('/api/auth/session', async (req, res) => {
    try {
        const admin = await obtenerUsuarioSesion(req);

        if (!admin || admin.estado !== 'activo' || !admin.session_id || admin.session_id !== req.sessionID || !await rolSesionActivo(admin.rol || 'recepcion', admin.empresa_id || 1)) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.status(401).json({
                ok: false,
                error: 'Sesion no activa'
            });
        }

        req.session.adminRol = admin.rol || 'recepcion';
        req.empresaId = req.session.empresa_id;
        req.session.empresa_id = admin.empresa_id || 1;
        const permisos = await obtenerCodigosPermisosUsuario(admin);

        const adminSesion = {
            id: admin.id,
            nombre: admin.nombre,
            empresa_id: admin.empresa_id || 1,
            usuario: admin.usuario,
            rol: admin.rol || 'recepcion',
            rol_id: admin.rol || 'recepcion',
            permisos
        };

        return res.json({
            ok: true,
            ...adminSesion,
            admin: adminSesion
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al validar sesion'
        });
    }
});

app.get('/api/auth/heartbeat', async (req, res) => {
    try {
        const admin = await obtenerUsuarioSesion(req);

        if (!admin) {
            return res.status(401).json({ valid: false, reason: 'session_missing' });
        }

        if (admin.estado !== 'activo') {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.status(401).json({ valid: false, reason: 'user_disabled' });
        }

        if (!await rolSesionActivo(admin.rol || 'recepcion', admin.empresa_id || 1)) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.status(401).json({ valid: false, reason: 'role_disabled' });
        }

        if (!admin.session_id || admin.session_id !== req.sessionID) {
            await destruirSesion(req);
            res.clearCookie('connect.sid');
            return res.status(401).json({ valid: false, reason: 'session_replaced' });
        }

        req.session.adminRol = admin.rol || 'recepcion';

        req.session.empresa_id = admin.empresa_id || 1;

        return res.json({
            valid: true,
            session_id: req.sessionID,
            permissions_version: await obtenerPermisosVersionRol(admin.rol || 'recepcion', admin.empresa_id || 1)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            valid: false,
            reason: 'server_error'
        });
    }
});

app.get('/empresa-theme.css', async (req, res) => {
    res.type('text/css');
    res.set('Cache-Control', 'no-store');

    try {
        const empresaId = req.session && req.session.empresa_id
            ? Number(req.session.empresa_id)
            : null;

        if (!empresaId) {
            return res.send(generarCssTemaEmpresa());
        }

        const [[empresa]] = await pool.query(
            `SELECT
                color_primario,
                color_secundario,
                color_acento,
                bg_body,
                bg_card,
                text_principal,
                text_secundario,
                table_border,
                theme_glow,
                validation_active_bg,
                validation_active_surface,
                validation_active_border,
                validation_active_text,
                validation_active_muted,
                validation_active_accent,
                validation_denied_bg,
                validation_denied_surface,
                validation_denied_border,
                validation_denied_text,
                validation_denied_muted,
                validation_denied_accent
             FROM empresas
             WHERE id = ?
             LIMIT 1`,
            [empresaId]
        );

        return res.send(generarCssTemaEmpresa(empresa));
    } catch (error) {
        console.error('Error generando CSS de tema:', error);
        return res.send(generarCssTemaEmpresa());
    }
});

app.use('/api', requireAdminSession);

app.get('/api/empresa/tema', async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [[empresa]] = await pool.query(
    `SELECT
    id,
    nombre,
    slug,
    logo_url,
    color_primario,
    color_secundario,
    color_acento,
    fondo_login,

    bg_body,
    bg_card,

    text_principal,
    text_secundario,

    table_border,
    theme_glow,
    codigo_prefijo,
    codigo_longitud,
    validation_active_bg,
    validation_active_surface,
    validation_active_border,
    validation_active_text,
    validation_active_muted,
    validation_active_accent,
    validation_denied_bg,
    validation_denied_surface,
    validation_denied_border,
    validation_denied_text,
    validation_denied_muted,
    validation_denied_accent
 FROM empresas
 WHERE id = ?
 LIMIT 1`,
    [empresaId]
);

        if (!empresa) {
            return res.status(404).json({
                error: 'Empresa no encontrada'
            });
        }

        return res.json(empresa);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al cargar tema de empresa'
        });
    }
});

app.get('/api/admin/perfil', async (req, res) => {
    try {
        if (!req.session || !req.session.admin || !req.session.adminId) {
            return res.status(401).json({
                ok: false,
                error: 'Sesion no activa'
            });
        }

        const [columns] = await pool.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'usuarios_admin'
            AND COLUMN_NAME IN ('fecha_creacion', 'created_at', 'ultimo_login', 'ultimo_acceso', 'last_login', 'rol')
        `);

        const columnas = new Set(columns.map(col => col.COLUMN_NAME));

        const fechaCreacion = columnas.has('fecha_creacion')
            ? 'fecha_creacion'
            : columnas.has('created_at')
                ? 'created_at AS fecha_creacion'
                : 'NULL AS fecha_creacion';

        const ultimoAcceso = columnas.has('ultimo_login')
            ? 'ultimo_login AS ultimo_acceso'
            : columnas.has('ultimo_acceso')
                ? 'ultimo_acceso'
                : columnas.has('last_login')
                    ? 'last_login AS ultimo_acceso'
                    : 'NULL AS ultimo_acceso';

        const rol = columnas.has('rol')
            ? 'rol'
            : 'NULL AS rol';

        const [rows] = await pool.query(
            `SELECT
                id,
                empresa_id,
                usuario,
                nombre,
                estado,
                ${fechaCreacion},
                ${ultimoAcceso},
                ${rol}
             FROM usuarios_admin
             WHERE id = ?
             AND empresa_id = ?
             LIMIT 1`,
            [req.session.adminId, req.empresaId]
        );

        const admin = rows[0];

        if (!admin || admin.estado !== 'activo') {
            return res.status(401).json({
                ok: false,
                error: 'Sesion no activa'
            });
        }

        return res.json({
            id: admin.id,
            empresa_id: admin.empresa_id,
            usuario: admin.usuario,
            nombre: admin.nombre,
            estado: admin.estado,
            fecha_creacion: admin.fecha_creacion,
            ultimo_acceso: admin.ultimo_acceso,
            sesion_iniciada: req.session.loginAt || null,
            rol: admin.rol || 'recepcion'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al cargar perfil'
        });
    }
});
app.get('/api/admin/me', async (req, res) => {
    const admin = req.adminUser;
    const permisos = await obtenerCodigosPermisosUsuario(admin);

    return res.json({
        id: admin.id,
        nombre: admin.nombre,
        usuario: admin.usuario,
        rol: admin.rol || 'recepcion',
        rol_id: admin.rol || 'recepcion',
        permisos,
        estado: admin.estado,
        ultimo_login: admin.ultimo_login,
        fecha_creacion: admin.fecha_creacion,
        sesion_iniciada: req.session.loginAt || null
    });
});

app.get('/api/admin/permisos', requirePermission('roles.asignar_permisos'), async (req, res) => {
    try {
        let permisos = PERMISOS_BASE;

        try {
            const [rows] = await pool.query(
                `SELECT id, codigo, nombre, categoria, descripcion
                 FROM permisos_admin
                 ORDER BY categoria ASC, id ASC`
            );
            if (rows.length > 0) {
                permisos = rows;
            }
        } catch (error) {
            if (!error || (error.code !== 'ER_NO_SUCH_TABLE' && error.code !== 'ER_BAD_FIELD_ERROR')) {
                throw error;
            }
        }

        return res.json({
            ok: true,
            permisos,
            categorias: agruparPermisos(permisos)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al listar permisos'
        });
    }
});

app.get('/api/admin/roles', requirePermission('roles.ver'), async (req, res) => {
    try {
        await asegurarRolesBase(req.empresaId);

        const [columns] = await pool.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'roles_admin'
            AND COLUMN_NAME IN ('fecha_creacion', 'created_at')
        `);

        const columnas = new Set(columns.map(col => col.COLUMN_NAME));

        const fechaRol = columnas.has('fecha_creacion')
            ? 'r.fecha_creacion'
            : columnas.has('created_at')
                ? 'r.created_at'
                : 'NULL';

        const [rows] = await pool.query(`
            SELECT
                r.codigo,
                r.nombre,
                r.descripcion,
                r.estado,
                r.sistema,
                ${fechaRol} AS fecha_creacion,
                COUNT(DISTINCT u.id) AS usuarios,
                COUNT(DISTINCT rp.permiso_id) AS permisos
            FROM roles_admin r
            LEFT JOIN usuarios_admin u ON u.rol = r.codigo AND u.empresa_id = r.empresa_id
            LEFT JOIN roles_permisos rp ON rp.rol_codigo = r.codigo AND rp.empresa_id = r.empresa_id
            WHERE r.empresa_id = ?
            GROUP BY
                r.codigo,
                r.nombre,
                r.descripcion,
                r.estado,
                r.sistema,
                fecha_creacion
            ORDER BY r.sistema DESC, r.nombre ASC
        `, [req.empresaId]);

        return res.json({
            ok: true,
            roles: rows.map(row => ({
                id: row.codigo,
                codigo: row.codigo,
                nombre: row.nombre,
                descripcion: row.descripcion || '',
                estado: row.estado || 'activo',
                sistema: Number(row.sistema || 0) === 1,
                usuarios: Number(row.usuarios || 0),
                permisos: row.codigo === 'admin'
                    ? TODOS_LOS_PERMISOS.length
                    : Number(row.permisos || 0),
                editable: row.codigo !== 'admin',
                eliminable: Number(row.sistema || 0) !== 1 && Number(row.usuarios || 0) === 0
            }))
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al listar roles'
        });
    }
});

app.post('/api/admin/roles', requirePermission('roles.crear'), async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const nombre = limpiarTexto(req.body.nombre);
        const descripcion = limpiarTexto(req.body.descripcion);
        const basadoEn = normalizarCodigoRol(req.body.basado_en || req.body.basadoEn || 'vacio');

        if (!nombre) {
            return res.status(400).json({ ok: false, error: 'Nombre del rol obligatorio' });
        }

        await conn.beginTransaction();
        await asegurarRolesBase(req.empresaId, conn);

        const codigo = await generarCodigoRolUnico(nombre, req.empresaId, conn);
        await conn.query(
            `INSERT INTO roles_admin (empresa_id, codigo, nombre, descripcion, estado, sistema)
             VALUES (?, ?, ?, ?, 'activo', 0)`,
            [req.empresaId, codigo, nombre, descripcion || null]
        );

        const permisos = await permisosBaseParaNuevoRol(basadoEn, req.empresaId, conn);
        const permisosAsignados = await asignarPermisosARol(conn, codigo, req.empresaId, permisos);

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'rol_creado',
            titulo: 'Rol administrativo creado',
            mensaje: `${req.session.adminNombre} creo el rol ${nombre}.`,
            entidad_id: 0,
            evento_key: `${codigo}-${Date.now()}`
        });

        await conn.commit();

        return res.status(201).json({
            ok: true,
            rol: {
                id: codigo,
                codigo,
                nombre,
                descripcion,
                estado: 'activo',
                sistema: false,
                usuarios: 0,
                permisos: permisosAsignados.length
            }
        });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        return res.status(tablaRolesNoExiste(error) ? 400 : 500).json({
            ok: false,
            error: tablaRolesNoExiste(error)
                ? 'Ejecuta la migracion permisos-roles-admin.sql antes de crear roles'
                : 'Error al crear rol'
        });
    } finally {
        conn.release();
    }
});

app.post('/api/admin/roles/:id/duplicar', requirePermission('roles.crear'), async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const origenCodigo = normalizarCodigoRol(req.params.id);
        await asegurarRolesBase(req.empresaId, conn);
        const origen = await obtenerRolAdmin(origenCodigo, req.empresaId, conn);

        if (!origen && !validarRol(origenCodigo)) {
            return res.status(404).json({ ok: false, error: 'Rol no encontrado' });
        }

        const nombreBase = limpiarTexto(req.body.nombre) || `${origen?.nombre || roleLabelBackend(origenCodigo)} copia`;
        const descripcion = limpiarTexto(req.body.descripcion) || origen?.descripcion || '';

        await conn.beginTransaction();

        const codigo = await generarCodigoRolUnico(nombreBase, req.empresaId, conn);
        await conn.query(
            `INSERT INTO roles_admin (empresa_id, codigo, nombre, descripcion, estado, sistema)
VALUES (?, ?, ?, ?, 'activo', 0)`,
            [req.empresaId, codigo, nombreBase, descripcion || null]
        );

        const permisos = await obtenerCodigosPermisosRol(origenCodigo, req.empresaId, conn);
        const permisosAsignados = await asignarPermisosARol(conn, codigo, req.empresaId, permisos);

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'rol_duplicado',
            titulo: 'Rol administrativo duplicado',
            mensaje: `${req.session.adminNombre} duplico el rol ${origen?.nombre || origenCodigo}.`,
            entidad_id: 0,
            evento_key: `${codigo}-${Date.now()}`
        });

        await conn.commit();

        return res.status(201).json({
            ok: true,
            rol: {
                id: codigo,
                codigo,
                nombre: nombreBase,
                descripcion,
                estado: 'activo',
                sistema: false,
                usuarios: 0,
                permisos: permisosAsignados.length
            }
        });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        return res.status(500).json({ ok: false, error: 'Error al duplicar rol' });
    } finally {
        conn.release();
    }
});

app.put('/api/admin/roles/:id', requirePermission('roles.editar'), async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const codigo = normalizarCodigoRol(req.params.id);
        const nombre = limpiarTexto(req.body.nombre);
        const descripcion = limpiarTexto(req.body.descripcion);
        const estado = req.body.estado === undefined || req.body.estado === null || req.body.estado === ''
            ? null
            : limpiarTexto(req.body.estado);
        const permisos = Array.isArray(req.body.permisos)
            ? Array.from(new Set(req.body.permisos.map(limpiarTexto).filter(Boolean)))
            : null;

        if (!validarRol(codigo) || !nombre) {
            return res.status(400).json({ ok: false, error: 'Rol no valido' });
        }

        if (estado !== null && !validarEstado(estado)) {
            return res.status(400).json({ ok: false, error: 'Estado no valido' });
        }

        if (ROLES_SISTEMA.has(codigo) && estado && estado !== 'activo') {
            return res.status(400).json({ ok: false, error: 'No puedes desactivar roles base del sistema' });
        }

        if (codigo === 'admin' && permisos !== null) {
            return res.status(400).json({ ok: false, error: 'No se pueden modificar permisos del rol admin' });
        }

        await asegurarRolesBase(req.empresaId, conn);
        const rol = await obtenerRolAdmin(codigo, req.empresaId, conn);
        if (!rol) {
            return res.status(404).json({ ok: false, error: 'Rol no encontrado' });
        }

        await conn.beginTransaction();

        await conn.query(
            `UPDATE roles_admin
             SET nombre = ?, descripcion = ?, estado = COALESCE(?, estado)
             WHERE codigo = ? AND empresa_id = ?`,
             [nombre, descripcion || null, estado, codigo, req.empresaId]
        );

        let permisosAsignados = null;
        if (permisos !== null) {
            const [permisosValidos] = await conn.query(
                `SELECT id, codigo
                 FROM permisos_admin
                 WHERE codigo IN (?)`,
                [permisos.length > 0 ? permisos : ['__sin_permisos__']]
            );
            const codigosValidos = new Set(permisosValidos.map(permiso => permiso.codigo));
            const codigosInvalidos = permisos.filter(permiso => !codigosValidos.has(permiso));

            if (codigosInvalidos.length > 0) {
                await conn.rollback();
                return res.status(400).json({
                    ok: false,
                    error: `Permisos no validos: ${codigosInvalidos.join(', ')}`
                });
            }

            permisosAsignados = await asignarPermisosARol(conn, codigo, req.empresaId, permisos);
        }

        if (estado && estado !== 'activo') {
            await conn.query(
                `UPDATE usuarios_admin
                 SET session_id = NULL
                 WHERE rol = ? AND empresa_id = ?`,
                [codigo, req.empresaId]
            );
        }

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'rol_editado',
            titulo: 'Rol administrativo editado',
            mensaje: `${req.session.adminNombre} edito el rol ${nombre}.`,
            entidad_id: 0,
            evento_key: `${codigo}-${Date.now()}`
        });

        await conn.commit();

        return res.json({
            ok: true,
            rol: {
                id: codigo,
                codigo,
                nombre,
                descripcion,
                estado: estado || rol.estado,
                sistema: Number(rol.sistema || 0) === 1,
                permisos: permisosAsignados
            }
        });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        return res.status(500).json({ ok: false, error: 'Error al editar rol' });
    } finally {
        conn.release();
    }
});

app.patch('/api/admin/roles/:id/estado', requirePermission('roles.eliminar'), async (req, res) => {
    try {
        const codigo = normalizarCodigoRol(req.params.id);
        const estado = limpiarTexto(req.body.estado);

        if (!validarRol(codigo) || !validarEstado(estado)) {
            return res.status(400).json({ ok: false, error: 'Estado no valido' });
        }

        if (ROLES_SISTEMA.has(codigo) && estado !== 'activo') {
            return res.status(400).json({ ok: false, error: 'No puedes desactivar roles base del sistema' });
        }

        if (estado !== 'activo') {
            const permisos = await obtenerCodigosPermisosRol(codigo, req.empresaId);
            const tieneControlTotal = TODOS_LOS_PERMISOS.every(permiso => permisos.includes(permiso));

            if (tieneControlTotal) {
                const [[row]] = await pool.query(
                    `SELECT COUNT(*) AS total
                     FROM roles_admin r
                     WHERE r.codigo <> ?
                       AND r.empresa_id = ?
                       AND r.estado = 'activo'
                       AND NOT EXISTS (
                         SELECT 1
                         FROM permisos_admin p
                         WHERE NOT EXISTS (
                           SELECT 1
                           FROM roles_permisos rp
                           WHERE rp.rol_codigo = r.codigo
                             AND rp.empresa_id = r.empresa_id
                             AND rp.permiso_id = p.id
                         )
                       )`,
                    [codigo, req.empresaId]
                );

                if (Number(row.total || 0) === 0) {
                    return res.status(400).json({ ok: false, error: 'No puedes desactivar el ultimo rol con control total' });
                }
            }
        }

        const [result] = await pool.query(
            `UPDATE roles_admin
             SET estado = ?
             WHERE codigo = ? AND empresa_id = ?`,
            [estado, codigo, req.empresaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: 'Rol no encontrado' });
        }

        if (estado !== 'activo') {
            await pool.query(
                `UPDATE usuarios_admin
                 SET session_id = NULL
                 WHERE rol = ? AND empresa_id = ?`,
                [codigo, req.empresaId]
            );
        }

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: estado === 'activo' ? 'rol_activado' : 'rol_desactivado',
            titulo: estado === 'activo' ? 'Rol activado' : 'Rol desactivado',
            mensaje: `${req.session.adminNombre} ${estado === 'activo' ? 'activo' : 'desactivo'} el rol ${codigo}.`,
            entidad_id: 0,
            evento_key: `${codigo}-${estado}-${Date.now()}`
        });

        return res.json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, error: 'Error al cambiar estado del rol' });
    }
});

app.delete('/api/admin/roles/:id', requirePermission('roles.eliminar'), async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const codigo = normalizarCodigoRol(req.params.id);

        if (ROLES_SISTEMA.has(codigo)) {
            return res.status(400).json({ ok: false, error: 'No puedes eliminar roles base del sistema' });
        }

        const [[usuarios]] = await conn.query(
            `SELECT COUNT(*) AS total
             FROM usuarios_admin
             WHERE rol = ? AND empresa_id = ?`,
            [codigo, req.empresaId]
        );

        if (Number(usuarios.total || 0) > 0) {
            return res.status(400).json({
                ok: false,
                error: 'Este rol tiene usuarios asignados.',
                requiere_reasignacion: true
            });
        }

        await conn.beginTransaction();
        await conn.query('DELETE FROM roles_permisos WHERE rol_codigo = ? AND empresa_id = ?', [codigo, req.empresaId]);
        const [result] = await conn.query('DELETE FROM roles_admin WHERE codigo = ? AND empresa_id = ? AND sistema = 0', [codigo, req.empresaId]);

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ ok: false, error: 'Rol no encontrado' });
        }

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'rol_eliminado',
            titulo: 'Rol administrativo eliminado',
            mensaje: `${req.session.adminNombre} elimino el rol ${codigo}.`,
            entidad_id: 0,
            evento_key: `${codigo}-${Date.now()}`
        });

        await conn.commit();
        return res.json({ ok: true });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        return res.status(500).json({ ok: false, error: 'Error al eliminar rol' });
    } finally {
        conn.release();
    }
});

app.get('/api/admin/roles/:id/permisos', requirePermission('roles.asignar_permisos'), async (req, res) => {
    try {
        const rol = normalizarCodigoRol(req.params.id);
        if (!validarRol(rol)) {
            return res.status(400).json({ ok: false, error: 'Rol no valido' });
        }

        return res.json({
            ok: true,
            rol,
            permisos: await obtenerCodigosPermisosRol(rol, req.empresaId)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al obtener permisos del rol'
        });
    }
});

app.put('/api/admin/roles/:id/permisos', requirePermission('roles.asignar_permisos'), async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const rol = normalizarCodigoRol(req.params.id);
        const permisos = Array.isArray(req.body.permisos)
            ? Array.from(new Set(req.body.permisos.map(limpiarTexto).filter(Boolean)))
            : [];

        if (!validarRol(rol)) {
            return res.status(400).json({ ok: false, error: 'Rol no valido' });
        }

        if (rol === 'admin') {
            return res.status(400).json({
                ok: false,
                error: 'No se pueden modificar permisos del rol admin'
            });
        }

        await conn.beginTransaction();

        const [permisosValidos] = await conn.query(
            `SELECT id, codigo
             FROM permisos_admin
             WHERE codigo IN (?)`,
            [permisos.length > 0 ? permisos : ['__sin_permisos__']]
        );

        const codigosValidos = new Set(permisosValidos.map(permiso => permiso.codigo));
        const codigosInvalidos = permisos.filter(codigo => !codigosValidos.has(codigo));

        if (codigosInvalidos.length > 0) {
            await conn.rollback();
            return res.status(400).json({
                ok: false,
                error: `Permisos no validos: ${codigosInvalidos.join(', ')}`
            });
        }

        const permisosAntes = await obtenerCodigosPermisosRol(rol, req.empresaId, conn);

        await conn.query('DELETE FROM roles_permisos WHERE rol_codigo = ? AND empresa_id = ?', [rol, req.empresaId]);

        if (permisosValidos.length > 0) {
            await conn.query(
                `INSERT INTO roles_permisos (empresa_id, rol_codigo, permiso_id)
             VALUES ${permisosValidos.map(() => '(?, ?, ?)').join(', ')}`,
            permisosValidos.flatMap(permiso => [req.empresaId, rol, permiso.id])
            );
        }

        await conn.query(
            `UPDATE roles_admin
             SET fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE codigo = ? AND empresa_id = ?`,
            [rol, req.empresaId]
        );

        const anteriores = new Set(permisosAntes);
        const nuevos = new Set(permisos);
        const agregados = permisos.filter(codigo => !anteriores.has(codigo));
        const quitados = permisosAntes.filter(codigo => !nuevos.has(codigo));

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'rol_permisos_actualizados',
            titulo: 'Permisos de rol actualizados',
            mensaje: `${req.session.adminNombre} actualizo permisos de ${nombreRol(rol)}. Agregados: ${agregados.length}. Quitados: ${quitados.length}.`,
            entidad_id: 0,
            evento_key: `${rol}-${Date.now()}`
        });

        await conn.commit();

        return res.json({
            ok: true,
            rol,
            permisos,
            agregados,
            quitados
        });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al actualizar permisos del rol'
        });
    } finally {
        conn.release();
    }
});

async function cambiarPasswordPropia(req, res) {
    try {
        if (!req.session || !req.session.admin || !req.session.adminId) {
            return res.status(401).json({
                ok: false,
                error: 'Sesion no activa'
            });
        }

        const {
            password_actual,
            password_nueva,
            confirmar_password
        } = req.body;

        if (!password_actual || !password_nueva || !confirmar_password) {
            return res.status(400).json({
                ok: false,
                error: 'Completa todos los campos'
            });
        }

        if (password_nueva !== confirmar_password) {
            return res.status(400).json({
                ok: false,
                error: 'Las contrasenas no coinciden'
            });
        }

        if (String(password_nueva).length < 6) {
            return res.status(400).json({
                ok: false,
                error: 'La nueva contrasena debe tener al menos 6 caracteres'
            });
        }

        const [rows] = await pool.query(
    `SELECT id, password_hash, estado
     FROM usuarios_admin
     WHERE id = ?
     AND empresa_id = ?
     LIMIT 1`,
    [req.session.adminId, req.empresaId]
);

        const admin = rows[0];

        if (!admin || admin.estado !== 'activo') {
            return res.status(401).json({
                ok: false,
                error: 'Sesion no activa'
            });
        }

        const passwordActualOk = await bcrypt.compare(
            String(password_actual),
            admin.password_hash
        );

        if (!passwordActualOk) {
            return res.status(400).json({
                ok: false,
                error: 'La contrasena actual no es correcta'
            });
        }

        const nuevoHash = await generarHashPassword(password_nueva);

        await pool.query(
    `UPDATE usuarios_admin
     SET password_hash = ?
     WHERE id = ?
     AND empresa_id = ?`,
    [nuevoHash, admin.id, req.empresaId]
);

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'usuario_password_cambiada',
            titulo: 'Cambio de contrasena',
            mensaje: `${req.session.adminNombre} cambio su contrasena.`,
            entidad_id: admin.id
        });

        return res.json({
            ok: true,
            mensaje: 'Contrasena actualizada correctamente'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al actualizar contrasena'
        });
    }
}

app.put('/api/admin/cambiar-password', cambiarPasswordPropia);
app.put('/api/admin/me/password', cambiarPasswordPropia);

function limpiarTexto(valor) {
    return String(valor || '').trim();
}

function normalizarDni(valor) {
    return String(valor || '').trim();
}

function dniValido(valor) {
    return /^[0-9]{8}$/.test(normalizarDni(valor));
}

function normalizarCorreo(valor) {
    return String(valor || '').trim().toLowerCase();
}

function correoValido(valor) {
    const correo = normalizarCorreo(valor);
    return !correo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function validarPayloadCliente({ nombre, dni, correo }) {
    if (!limpiarTexto(nombre)) {
        return 'Nombre es obligatorio';
    }

    if (!dniValido(dni)) {
        return 'El DNI debe tener exactamente 8 digitos.';
    }

    if (!correoValido(correo)) {
        return 'El correo no tiene un formato valido.';
    }

    return null;
}

async function existeDniCliente(dni, empresaId, excluirId = null, conn = pool) {
    const params = [normalizarDni(dni), empresaId];
    let filtroId = '';

    if (excluirId) {
        filtroId = 'AND id <> ?';
        params.push(excluirId);
    }

    const [[row]] = await conn.query(
        `SELECT COUNT(*) AS total
         FROM clientes
         WHERE dni = ?
         AND empresa_id = ?
         ${filtroId}`,
        params
    );

    return Number(row.total || 0) > 0;
}

async function existeCorreoCliente(correo, empresaId, excluirId = null, conn = pool) {
    const correoNormalizado = normalizarCorreo(correo);
    if (!correoNormalizado) return false;

    const params = [correoNormalizado, empresaId];
    let filtroId = '';

    if (excluirId) {
        filtroId = 'AND id <> ?';
        params.push(excluirId);
    }

    const [[row]] = await conn.query(
        `SELECT COUNT(*) AS total
         FROM clientes
         WHERE LOWER(TRIM(correo)) = ?
         AND empresa_id = ?
         ${filtroId}`,
        params
    );

    return Number(row.total || 0) > 0;
}

function validarRol(rol) {
    return /^[a-z0-9_.-]{2,50}$/i.test(String(rol || ''));
}

function validarEstado(estado) {
    return ESTADOS_ADMIN.has(estado);
}

async function existeOtroUsuarioConNombre(usuario, empresaId, id = null) {
    const params = [usuario, empresaId];
    let filtroId = '';

    if (id) {
        filtroId = 'AND id <> ?';
        params.push(id);
    }

    const [[row]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM usuarios_admin
         WHERE usuario = ?
         AND empresa_id = ?
         ${filtroId}`,
        params
    );

    return Number(row.total || 0) > 0;
}

async function quedariaSinAdminActivo(id, nuevoRol, nuevoEstado, empresaId) {
    if (nuevoRol === 'admin' && nuevoEstado === 'activo') {
        return false;
    }

    const [[row]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM usuarios_admin
         WHERE rol = 'admin'
         AND estado = 'activo'
         AND empresa_id = ?
         AND id <> ?`,
        [empresaId, id]
    );

    return Number(row.total || 0) === 0;
}

app.get('/api/admin/usuarios', requirePermission('usuarios.ver'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                nombre,
                usuario,
                rol,
                estado,
                ultimo_login,
                fecha_creacion,
                fecha_actualizacion
            FROM usuarios_admin
            WHERE empresa_id = ?
            ORDER BY fecha_creacion DESC, id DESC
        `, [req.empresaId]);

        return res.json({
            ok: true,
            usuarios: rows
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al listar usuarios'
        });
    }
});

app.post('/api/admin/usuarios', requirePermission('usuarios.crear'), async (req, res) => {
    try {
        const nombre = limpiarTexto(req.body.nombre) || 'Usuario administrativo';
        const usuario = limpiarTexto(req.body.usuario);
        const password = String(req.body.password || '');
        const confirmarPassword = String(req.body.confirmar_password || req.body.confirmarPassword || '');
        const rol = normalizarCodigoRol(req.body.rol);
        const estado = limpiarTexto(req.body.estado) || 'activo';

        if (!usuario) {
            return res.status(400).json({ ok: false, error: 'Usuario obligatorio' });
        }

        if (!password) {
            return res.status(400).json({ ok: false, error: 'Contrasena obligatoria' });
        }

        if (password.length < 6) {
            return res.status(400).json({ ok: false, error: 'La contrasena debe tener al menos 6 caracteres' });
        }

        if (!confirmarPassword || password !== confirmarPassword) {
            return res.status(400).json({ ok: false, error: 'La confirmacion de contrasena no coincide' });
        }

        if (!validarRol(rol)) {
            return res.status(400).json({ ok: false, error: 'Rol no valido' });
        }

        if (!await rolAsignable(rol, req.empresaId)) {
            return res.status(400).json({ ok: false, error: 'Rol no disponible o inactivo' });
        }

        if (!validarEstado(estado)) {
            return res.status(400).json({ ok: false, error: 'Estado no valido' });
        }

        if (await existeOtroUsuarioConNombre(usuario, req.empresaId)) {
            return res.status(409).json({ ok: false, error: 'El usuario ya existe' });
        }

        const passwordHash = await generarHashPassword(password);
        const [result] = await pool.query(
            `INSERT INTO usuarios_admin (empresa_id, nombre, usuario, password_hash, rol, estado)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.empresaId, nombre, usuario, passwordHash, rol, estado]
        );

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'usuario_creado',
            titulo: 'Usuario administrativo creado',
            mensaje: `${req.session.adminNombre} creo el usuario ${nombre} con rol ${nombreRol(rol)}.`,
            entidad_id: result.insertId
        });

        return res.status(201).json({
            ok: true,
            usuario: {
                id: result.insertId,
                nombre,
                usuario,
                rol,
                estado
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al crear usuario'
        });
    }
});

app.put('/api/admin/usuarios/:id', requirePermission('usuarios.editar'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const nombre = limpiarTexto(req.body.nombre);
        const usuario = limpiarTexto(req.body.usuario);
        const rol = normalizarCodigoRol(req.body.rol);
        const estado = limpiarTexto(req.body.estado);
        const password = req.body.password ? String(req.body.password) : '';
        const confirmarPassword = String(req.body.confirmar_password || req.body.confirmarPassword || '');

        if (!id) {
            return res.status(400).json({ ok: false, error: 'Usuario no valido' });
        }

        if (!nombre || !usuario) {
            return res.status(400).json({ ok: false, error: 'Nombre y usuario son obligatorios' });
        }

        if (!validarRol(rol)) {
            return res.status(400).json({ ok: false, error: 'Rol no valido' });
        }

        if (!await rolAsignable(rol, req.empresaId)) {
            return res.status(400).json({ ok: false, error: 'Rol no disponible o inactivo' });
        }

        if (!validarEstado(estado)) {
            return res.status(400).json({ ok: false, error: 'Estado no valido' });
        }

        const [[actual]] = await pool.query(
            `SELECT id, nombre, usuario, rol, estado
             FROM usuarios_admin
             WHERE id = ? AND empresa_id = ?
             LIMIT 1`,
            [id, req.empresaId]
        );

        if (!actual) {
            return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
        }

        if (id === req.session.adminId && estado !== 'activo') {
            return res.status(400).json({ ok: false, error: 'No puedes desactivar tu propio usuario' });
        }

        if (actual.rol === 'admin' && actual.estado === 'activo' && await quedariaSinAdminActivo(id, rol, estado, req.empresaId)) {
            return res.status(400).json({ ok: false, error: 'No puedes dejar el sistema sin un admin activo' });
        }

        if (await existeOtroUsuarioConNombre(usuario, req.empresaId, id)) {
            return res.status(409).json({ ok: false, error: 'El usuario ya existe' });
        }

        const campos = ['nombre = ?', 'usuario = ?', 'rol = ?', 'estado = ?'];
        const valores = [nombre, usuario, rol, estado];
        let passwordActualizado = false;

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ ok: false, error: 'La contrasena debe tener al menos 6 caracteres' });
            }

            if (!confirmarPassword || password !== confirmarPassword) {
                return res.status(400).json({ ok: false, error: 'La confirmacion de contrasena no coincide' });
            }

            campos.push('password_hash = ?');
            valores.push(await generarHashPassword(password));
            passwordActualizado = true;
        }

        valores.push(id);

        await pool.query(
            `UPDATE usuarios_admin
             SET ${campos.join(', ')}
             WHERE id = ? AND empresa_id = ?`,
            [...valores, req.empresaId]
        );

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: 'usuario_editado',
            titulo: 'Usuario administrativo editado',
            mensaje: `${req.session.adminNombre} edito el usuario ${nombre}.`,
            entidad_id: id
        });

        if (passwordActualizado) {
            await crearNotificacionAuditoriaUsuario(req, {
                tipo: 'usuario_password_cambiada',
                titulo: 'Cambio de contrasena',
                mensaje: `${req.session.adminNombre} actualizo la contrasena de ${nombre}.`,
                entidad_id: id
            });
        }

        return res.json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al editar usuario'
        });
    }
});

app.patch('/api/admin/usuarios/:id/estado', requirePermission('usuarios.desactivar'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const estado = limpiarTexto(req.body.estado);

        if (!id || !validarEstado(estado)) {
            return res.status(400).json({ ok: false, error: 'Estado no valido' });
        }

        const [[actual]] = await pool.query(
            `SELECT id, nombre, rol, estado
             FROM usuarios_admin
             WHERE id = ? AND empresa_id = ?
             LIMIT 1`,
            [id, req.empresaId]
        );

        if (!actual) {
            return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
        }

        if (id === req.session.adminId && estado !== 'activo') {
            return res.status(400).json({ ok: false, error: 'No puedes desactivar tu propio usuario' });
        }

        if (actual.rol === 'admin' && actual.estado === 'activo' && estado !== 'activo' && await quedariaSinAdminActivo(id, actual.rol, estado, req.empresaId)) {
            return res.status(400).json({ ok: false, error: 'No puedes dejar el sistema sin un admin activo' });
        }

        await pool.query(
            `UPDATE usuarios_admin
             SET estado = ?,
                 session_id = CASE WHEN ? = 'inactivo' THEN NULL ELSE session_id END
             WHERE id = ? AND empresa_id = ?`,
            [estado, estado, id, req.empresaId]
        );

        await crearNotificacionAuditoriaUsuario(req, {
            tipo: estado === 'activo' ? 'usuario_activado' : 'usuario_desactivado',
            titulo: estado === 'activo' ? 'Usuario activado' : 'Usuario desactivado',
            mensaje: `${req.session.adminNombre} ${estado === 'activo' ? 'activo' : 'desactivo'} el usuario ${actual.nombre}.`,
            entidad_id: id
        });

        return res.json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al cambiar estado'
        });
    }
});

app.get('/', (req, res) => {
    res.redirect('/admin/');
});

app.get(['/admin', '/admin/'], (req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'));
});

app.get('/admin/index.html', (req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'));
});

app.get('/admin/login.html', (req, res) => {
    res.redirect('/admin/index.html');
});

app.use('/admin/styles', express.static(path.join(adminDir, 'styles')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/admin', protegerPaginasAdmin);

app.get('/admin/:page', (req, res, next) => {
    const { page } = req.params;

    if (!privateAdminPages.has(page)) {
        return next();
    }

    return res.sendFile(path.join(adminDir, page));
});

app.use('/assets', express.static(adminAssetsDir));

app.use(express.static(publicDir));

// GET CLIENTES
app.get('/api/clientes', requirePermission('clientes.ver'), async (req, res) => {
    try {
        //await sincronizarEstadosClientes();
        const empresaId = getEmpresaId(req);
        const [rows] = await pool.query(`
            SELECT
                c.*,
                m.fecha_fin,
                m.estado AS estado_membresia,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN m.id IS NULL THEN 'inactiva'
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual
            FROM clientes c
            LEFT JOIN membresias m ON m.id = (
                SELECT mm.id
                FROM membresias mm
                WHERE mm.cliente_id = c.id
                AND mm.empresa_id = c.empresa_id
                ORDER BY (mm.estado = 'activa') DESC, mm.fecha_fin DESC, mm.id DESC
                LIMIT 1
            )
            WHERE c.empresa_id = ?
            ORDER BY c.id DESC
        `, [empresaId]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error del servidor'
        });
    }
});

app.get('/api/clientes/:id/perfil', requirePermission('clientes.ver'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const clienteId = Number(req.params.id);

        if (!clienteId) {
            return res.status(400).json({ error: 'Cliente no valido' });
        }

        const [[cliente]] = await pool.query(
            `SELECT id, nombre, dni, telefono, correo, estado, fecha_registro
             FROM clientes
             WHERE id = ? AND empresa_id = ?
             LIMIT 1`,
            [clienteId, empresaId]
        );

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const [membresias] = await pool.query(
            `SELECT
                m.id,
                m.codigo,
                m.precio_total,
                m.promocion,
                m.estado,
                m.origen,
                DATE_FORMAT(m.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
                DATE_FORMAT(m.fecha_fin, '%Y-%m-%d') AS fecha_fin,
                m.fecha_creacion,
                COALESCE(m.duracion_unidad, 'meses') AS duracion_unidad,
                m.usos_totales,
                m.usos_restantes,
                m.asistencias_totales,
                COALESCE(m.asistencias_usadas, 0) AS asistencias_usadas,
                p.nombre AS plan,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes
             FROM membresias m
             INNER JOIN planes p ON p.id = m.plan_id AND p.empresa_id = m.empresa_id
             WHERE m.cliente_id = ? AND m.empresa_id = ?
             ORDER BY (m.estado = 'activa') DESC, m.fecha_fin DESC, m.id DESC`,
            [clienteId, empresaId]
        );

        const membresiaActual = membresias.find(m => {
            const vigente = m.duracion_unidad === 'usos' || Number(m.dias_restantes) >= 0;
            const tieneUsos = m.asistencias_totales === null || Number(m.asistencias_usadas || 0) < Number(m.asistencias_totales || 0);
            return m.estado === 'activa' && vigente && tieneUsos;
        }) || null;

        const [asistencias] = await pool.query(
            `SELECT
                a.id,
                a.codigo_usado,
                a.estado,
                a.motivo,
                a.cuenta_como_uso,
                a.fecha_hora,
                m.codigo AS codigo_membresia,
                p.nombre AS plan
             FROM asistencias a
             LEFT JOIN membresias m ON m.id = a.membresia_id AND m.empresa_id = a.empresa_id
             LEFT JOIN planes p ON p.id = m.plan_id AND p.empresa_id = a.empresa_id
             WHERE a.cliente_id = ? AND a.empresa_id = ?
             ORDER BY a.fecha_hora DESC
             LIMIT 20`,
            [clienteId, empresaId]
        );

        const puedeVerNotas = await tienePermiso(req.adminUser, 'clientes.notas.ver');
        const puedeCrearNotas = await tienePermiso(req.adminUser, 'clientes.notas.crear');
        const puedeEditarNotas = await tienePermiso(req.adminUser, 'clientes.notas.editar');
        const puedeEliminarNotas = await tienePermiso(req.adminUser, 'clientes.notas.eliminar');
        const puedeCongelar = await tienePermiso(req.adminUser, 'membresias.congelar');

        let notas = [];
        if (puedeVerNotas) {
            const [notasRows] = await pool.query(
                `SELECT
                    n.id,
                    n.nota,
                    n.created_at,
                    n.updated_at,
                    u.nombre AS autor
                 FROM cliente_notas n
                 LEFT JOIN usuarios_admin u ON u.id = n.usuario_id AND u.empresa_id = n.empresa_id
                 WHERE n.cliente_id = ? AND n.empresa_id = ? AND n.deleted_at IS NULL
                 ORDER BY n.created_at DESC`,
                [clienteId, empresaId]
            );
            notas = notasRows;
        }

        const [timeline] = await pool.query(
            `SELECT
                e.id,
                e.tipo_evento,
                e.titulo,
                e.descripcion,
                e.metadata,
                e.created_at,
                u.nombre AS usuario
             FROM cliente_eventos e
             LEFT JOIN usuarios_admin u ON u.id = e.usuario_id AND u.empresa_id = e.empresa_id
             WHERE e.cliente_id = ? AND e.empresa_id = ?
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT 50`,
            [clienteId, empresaId]
        );

        const [congelamientos] = await pool.query(
            `SELECT
                id,
                membresia_id,
                DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
                DATE_FORMAT(fecha_fin, '%Y-%m-%d') AS fecha_fin,
                dias_congelados,
                motivo,
                created_at
             FROM membresia_congelamientos
             WHERE cliente_id = ? AND empresa_id = ?
             ORDER BY created_at DESC`,
            [clienteId, empresaId]
        );

        return res.json({
            cliente,
            membresia_actual: membresiaActual,
            historial_membresias: membresias,
            asistencias,
            notas,
            timeline,
            congelamientos,
            permisos: {
                notas_ver: puedeVerNotas,
                notas_crear: puedeCrearNotas,
                notas_editar: puedeEditarNotas,
                notas_eliminar: puedeEliminarNotas,
                membresias_congelar: puedeCongelar
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al obtener perfil del cliente' });
    }
});

app.post('/api/clientes', requirePermission('clientes.crear'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const nombre = limpiarTexto(req.body.nombre);
        const dni = normalizarDni(req.body.dni);
        const telefono = limpiarTexto(req.body.telefono);
        const correo = normalizarCorreo(req.body.correo);
        const estado = validarEstado(limpiarTexto(req.body.estado)) ? limpiarTexto(req.body.estado) : 'activo';

        const errorCliente = validarPayloadCliente({ nombre, dni, correo });
        if (errorCliente) {
            return res.status(400).json({ error: errorCliente });
        }

        if (await existeDniCliente(dni, empresaId)) {
            return res.status(409).json({ error: 'Ya existe un cliente registrado con este DNI.' });
        }

        if (await existeCorreoCliente(correo, empresaId)) {
            return res.status(409).json({ error: 'Ya existe un cliente registrado con este correo.' });
        }

        const [result] = await pool.query(
            `INSERT INTO clientes (empresa_id, nombre, dni, telefono, correo, estado)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [empresaId, nombre, dni, telefono, correo || null, estado]
        );

        await crearNotificacion({
            tipo: 'cliente_creado',
            titulo: 'Nuevo cliente registrado',
            mensaje: `Se registró a ${nombre} con DNI ${dni}.`,
            entidad: 'cliente',
            entidad_id: result.insertId,
            ...adminNotificacion(req)
        });

        await registrarEventoCliente({
            ...adminEvento(req),
            cliente_id: result.insertId,
            tipo_evento: 'cliente_creado',
            titulo: 'Cliente registrado',
            descripcion: `Se registro el cliente ${nombre}.`,
            metadata: { dni, telefono, correo }
        });

        res.json({
            id: result.insertId,
            nombre,
            dni,
            telefono,
            correo,
            creado: true
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar cliente' });
    }
});

app.put('/api/clientes/:id', requirePermission('clientes.editar'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);
        const nombre = limpiarTexto(req.body.nombre);
        const dni = normalizarDni(req.body.dni);
        const telefono = limpiarTexto(req.body.telefono);
        const correo = normalizarCorreo(req.body.correo);

        if (!id) {
            return res.status(400).json({ error: 'Cliente no valido' });
        }

        const errorCliente = validarPayloadCliente({ nombre, dni, correo });
        if (errorCliente) {
            return res.status(400).json({ error: errorCliente });
        }

        if (await existeDniCliente(dni, empresaId, id)) {
            return res.status(409).json({ error: 'Ya existe otro cliente con ese DNI.' });
        }

        if (await existeCorreoCliente(correo, empresaId, id)) {
            return res.status(409).json({ error: 'Ya existe un cliente registrado con este correo.' });
        }

        const [result] = await pool.query(
            `UPDATE clientes
            SET nombre = ?, dni = ?, telefono = ?, correo = ?
            WHERE id = ? AND empresa_id = ?`,
            [
                nombre,
                dni,
                telefono,
                correo || null,
                id,
                empresaId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Cliente no encontrado'
            });
        }

        await registrarEventoCliente({
            ...adminEvento(req),
            cliente_id: id,
            tipo_evento: 'cliente_actualizado',
            titulo: 'Datos actualizados',
            descripcion: `Se actualizaron los datos de ${nombre}.`,
            metadata: { dni, telefono, correo }
        });

        res.json({
            mensaje: 'Cliente actualizado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al actualizar cliente'
        });
    }
});

app.post('/api/clientes/:id/notas', requirePermission('clientes.notas.crear'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const clienteId = Number(req.params.id);
        const nota = limpiarTexto(req.body.nota);

        if (!clienteId || !nota) {
            return res.status(400).json({ error: 'La nota es obligatoria' });
        }

        const [[cliente]] = await pool.query(
            `SELECT id, nombre FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1`,
            [clienteId, empresaId]
        );

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const [result] = await pool.query(
            `INSERT INTO cliente_notas (empresa_id, cliente_id, usuario_id, nota)
             VALUES (?, ?, ?, ?)`,
            [empresaId, clienteId, req.session.adminId || null, nota]
        );

        await registrarEventoCliente({
            ...adminEvento(req),
            cliente_id: clienteId,
            tipo_evento: 'nota_creada',
            titulo: 'Nota interna agregada',
            descripcion: `Se agrego una nota interna para ${cliente.nombre}.`,
            metadata: { nota_id: result.insertId }
        });

        return res.json({ id: result.insertId, mensaje: 'Nota agregada correctamente' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al agregar nota' });
    }
});

app.put('/api/clientes/:id/notas/:notaId', requirePermission('clientes.notas.editar'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const clienteId = Number(req.params.id);
        const notaId = Number(req.params.notaId);
        const nota = limpiarTexto(req.body.nota);

        if (!clienteId || !notaId || !nota) {
            return res.status(400).json({ error: 'La nota es obligatoria' });
        }

        const [result] = await pool.query(
            `UPDATE cliente_notas
             SET nota = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND cliente_id = ? AND empresa_id = ? AND deleted_at IS NULL`,
            [nota, notaId, clienteId, empresaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        await registrarEventoCliente({
            ...adminEvento(req),
            cliente_id: clienteId,
            tipo_evento: 'nota_actualizada',
            titulo: 'Nota interna editada',
            descripcion: 'Se edito una nota interna del cliente.',
            metadata: { nota_id: notaId }
        });

        return res.json({ mensaje: 'Nota actualizada correctamente' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al actualizar nota' });
    }
});

app.delete('/api/clientes/:id/notas/:notaId', requirePermission('clientes.notas.eliminar'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const clienteId = Number(req.params.id);
        const notaId = Number(req.params.notaId);

        if (!clienteId || !notaId) {
            return res.status(400).json({ error: 'Nota no valida' });
        }

        const [result] = await pool.query(
            `UPDATE cliente_notas
             SET deleted_at = CURRENT_TIMESTAMP
             WHERE id = ? AND cliente_id = ? AND empresa_id = ? AND deleted_at IS NULL`,
            [notaId, clienteId, empresaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        await registrarEventoCliente({
            ...adminEvento(req),
            cliente_id: clienteId,
            tipo_evento: 'nota_eliminada',
            titulo: 'Nota interna eliminada',
            descripcion: 'Se elimino una nota interna del cliente.',
            metadata: { nota_id: notaId }
        });

        return res.json({ mensaje: 'Nota eliminada correctamente' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al eliminar nota' });
    }
});

app.delete('/api/clientes/:id', requirePermission('clientes.eliminar'), async (req, res) => {
    try {
        const { id } = req.params;

        const [[cliente]] = await pool.query(
            `SELECT nombre
             FROM clientes
             WHERE id = ?
             AND empresa_id = ?
             LIMIT 1`,
            [id, req.empresaId]
        );

        if (!cliente) {
            return res.status(404).json({
                error: 'Cliente no encontrado'
            });
        }

        await pool.query(
            `DELETE FROM clientes
             WHERE id = ?
             AND empresa_id = ?`,
            [id, req.empresaId]
        );

        await crearNotificacion({
            tipo: 'cliente_eliminado',
            titulo: 'Cliente eliminado',
            mensaje: `Se elimino o desactivo a ${cliente.nombre}.`,
            entidad: 'cliente',
            entidad_id: id,
            ...adminNotificacion(req)
        });

        res.json({ mensaje: 'Cliente eliminado correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});

function normalizarCodigoPrefijo(valor) {
    const prefijo = String(valor || '')
        .replace(/\s+/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '');

    return prefijo || 'PFS';
}

function normalizarCodigoLongitud(valor) {
    const longitud = Number.parseInt(valor, 10);
    if (!Number.isFinite(longitud)) return 4;
    return Math.min(Math.max(longitud, 3), 8);
}

async function obtenerConfigCodigoEmpresa(empresaId, conn = pool) {
    try {
        const [[empresa]] = await conn.query(
            `SELECT codigo_prefijo, codigo_longitud
             FROM empresas
             WHERE id = ?
             LIMIT 1`,
            [empresaId]
        );

        return {
            prefijo: normalizarCodigoPrefijo(empresa && empresa.codigo_prefijo),
            longitud: normalizarCodigoLongitud(empresa && empresa.codigo_longitud)
        };
    } catch (error) {
        if (error && error.code === 'ER_BAD_FIELD_ERROR') {
            return {
                prefijo: 'PFS',
                longitud: 4
            };
        }

        throw error;
    }
}

async function generarCodigoUnico(empresaId, conn = pool) {
    const { prefijo, longitud } = await obtenerConfigCodigoEmpresa(empresaId, conn);
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo;
    let existe = true;
    let intentos = 0;

    while (existe) {
        let sufijo = '';
        for (let i = 0; i < longitud; i += 1) {
            sufijo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }

        codigo = `${prefijo}-${sufijo}`;

        const [rows] = await conn.query(
            `SELECT id
             FROM membresias
             WHERE empresa_id = ?
             AND codigo = ?
             LIMIT 1`,
            [empresaId, codigo]
        );

        existe = rows.length > 0;
        intentos += 1;

        if (intentos > 200) {
            throw new Error('No se pudo generar un codigo unico de membresia para esta empresa');
        }
    }

    return codigo;
}

function calcularDiasRestantes(fechaFinValue) {
    const hoy = new Date();
    const fechaFin = new Date(fechaFinValue);

    hoy.setHours(0, 0, 0, 0);
    fechaFin.setHours(0, 0, 0, 0);

    return Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
}

function fechaPeruISO(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(fecha);

    const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}

function sumarDiasISO(fechaISO, dias) {
    const fecha = new Date(`${fechaISO}T00:00:00-05:00`);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
}

function diasInclusivos(fechaInicio, fechaFin) {
    const inicio = new Date(`${fechaInicio}T00:00:00-05:00`);
    const fin = new Date(`${fechaFin}T00:00:00-05:00`);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;

    const diferencia = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24));
    return diferencia >= 0 ? diferencia + 1 : 0;
}

function fechaSoloISO(valor) {
    if (!valor) return '';

    if (typeof valor === 'string') {
        const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        const y = valor.getUTCFullYear();
        const m = String(valor.getUTCMonth() + 1).padStart(2, '0');
        const d = String(valor.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) {
        return fecha.toISOString().slice(0, 10);
    }

    return String(valor).slice(0, 10);
}

function fechaHoraMysqlUTC(fecha) {
    return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

function limitesDiaPeruMysqlUTC(fechaISO = fechaPeruISO()) {
    const inicio = new Date(`${fechaISO}T00:00:00-05:00`);
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + 1);

    return {
        inicio: fechaHoraMysqlUTC(inicio),
        fin: fechaHoraMysqlUTC(fin)
    };
}

function calcularDiasRestantesPeru(fechaFinValue) {
    if (!fechaFinValue) return 0;
    const fechaFin = fechaSoloISO(fechaFinValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) return 0;

    const hoy = fechaPeruISO();
    const fin = new Date(`${fechaFin}T00:00:00-05:00`);
    const actual = new Date(`${hoy}T00:00:00-05:00`);

    return Math.ceil((fin - actual) / (1000 * 60 * 60 * 24));
}

function normalizarDuracionUnidad(unidad) {
    return ['dias', 'meses', 'usos'].includes(unidad) ? unidad : 'meses';
}

function normalizarDuracionValor(valor) {
    const numero = Number.parseInt(valor, 10);
    return Number.isFinite(numero) && numero > 0 ? numero : 1;
}

function mesesCompatibles(cantidad, unidad) {
    return normalizarDuracionValor(cantidad);
}

function extraerDescuentoPorcentaje(promocion) {
    const texto = String(promocion || '');
    const match = texto.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return match ? Number(match[1].replace(',', '.')) : null;
}

function calcularFechaFin(fechaInicio, cantidad, unidad) {
    const inicio = new Date(`${fechaInicio}T00:00:00`);
    const valor = normalizarDuracionValor(cantidad);
    const tipo = normalizarDuracionUnidad(unidad);

    if (tipo === 'meses') {
        inicio.setMonth(inicio.getMonth() + valor);
    } else {
        inicio.setDate(inicio.getDate() + valor);
    }

    return inicio.toISOString().slice(0, 10);
}

function normalizarAsistencias(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number.parseInt(valor, 10);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function esPlanIlimitado(plan) {
    return Number(plan && plan.es_ilimitado) === 1 || plan?.asistencias_incluidas === null;
}

async function obtenerPlanParaMembresia(planId, empresaId, conn = pool) {
    const [[plan]] = await conn.query(
        `SELECT
            id,
            nombre,
            COALESCE(duracion_valor, 1) AS duracion_valor,
            COALESCE(duracion_unidad, 'meses') AS duracion_unidad,
            asistencias_incluidas,
            COALESCE(es_ilimitado, 0) AS es_ilimitado
         FROM planes
         WHERE id = ? AND empresa_id = ?
         LIMIT 1`,
        [planId, empresaId]
    );

    return plan || null;
}

function asistenciasDesdePlan(plan, fallback = null) {
    if (!plan || esPlanIlimitado(plan)) return null;

    return normalizarAsistencias(plan.asistencias_incluidas)
        ?? normalizarAsistencias(fallback)
        ?? 1;
}

function resumenAsistencias(membresia) {
    const total = membresia.asistencias_totales === null || membresia.asistencias_totales === undefined
        ? null
        : Number(membresia.asistencias_totales);
    const usadas = Math.max(Number(membresia.asistencias_usadas || 0), 0);

    if (!Number.isFinite(total) || total <= 0) {
        return {
            ilimitada: true,
            total: null,
            usadas,
            restantes: null,
            etiqueta_restantes: 'Ilimitadas',
            etiqueta_usadas: `${usadas}`
        };
    }

    const restantes = Math.max(total - usadas, 0);

    return {
        ilimitada: false,
        total,
        usadas,
        restantes,
        etiqueta_restantes: `${restantes}/${total}`,
        etiqueta_usadas: `${usadas}/${total}`
    };
}

function payloadAsistencias(membresia) {
    const resumen = resumenAsistencias(membresia);

    return {
        asistencias_totales: resumen.total,
        asistencias_usadas: resumen.usadas,
        asistencias_restantes: resumen.restantes,
        asistencias_ilimitadas: resumen.ilimitada,
        asistencias_restantes_texto: resumen.etiqueta_restantes,
        asistencias_usadas_texto: resumen.etiqueta_usadas
    };
}

function estadoVisualMembresia(estado, diasRestantes, unidad = 'meses', usosRestantes = null) {
    if (estado === 'vencida' || diasRestantes < 0) return 'vencida';
    if (diasRestantes === 0) return 'vence_hoy';
    if (diasRestantes === 1) return 'vence_manana';
    if (diasRestantes === 3) return 'vence_3_dias';
    if (estado === 'activa') return 'activa';
    return 'inactiva';
}

async function desactivarClienteSiSinMembresiaActiva(clienteId, membresiaId, empresaId, conn = pool) {
    await conn.query(
        `UPDATE clientes
         SET estado = 'inactivo'
         WHERE id = ?
         AND empresa_id = ?
         AND NOT EXISTS (
            SELECT 1
            FROM membresias m
            WHERE m.cliente_id = clientes.id
            AND m.empresa_id = clientes.empresa_id
            AND m.estado = 'activa'
            AND m.id != ?
            AND (
                m.asistencias_totales IS NULL
                OR COALESCE(m.asistencias_usadas, 0) < m.asistencias_totales
            )
         )`,
        [clienteId, empresaId, membresiaId]
    );
}
async function obtenerMembresiaActivaCliente(clienteId, empresaId, conn = pool) {
    const [[membresia]] = await conn.query(
        `SELECT id, codigo, fecha_fin
         FROM membresias
         WHERE cliente_id = ?
         AND empresa_id = ?
         AND estado = 'activa'
         AND (
            COALESCE(duracion_unidad, 'meses') = 'usos'
            OR DATE(fecha_fin) >= CURDATE()
         )
         AND (
            asistencias_totales IS NULL
            OR COALESCE(asistencias_usadas, 0) < asistencias_totales
         )
         ORDER BY fecha_fin DESC, id DESC
         LIMIT 1`,
        [clienteId, empresaId]
    );

    return membresia || null;
}

async function validarMembresiaYRegistrar(membresia, empresaId) {
    const unidad = normalizarDuracionUnidad(membresia.duracion_unidad);
    const diasRestantes = calcularDiasRestantesPeru(membresia.fecha_fin);
    const estadoVisual = estadoVisualMembresia(membresia.estado_membresia, diasRestantes, unidad);
    const asistencias = resumenAsistencias(membresia);

    const payloadBase = {
        cliente: membresia.cliente,
        dni: membresia.dni,
        plan: membresia.plan,
        plan_nombre: membresia.plan,
        codigo: membresia.codigo,
        fecha_inicio: membresia.fecha_inicio,
        fecha_fin: membresia.fecha_fin,
        promocion: membresia.promocion,
        promocion_id: membresia.promocion_id,
        promocion_vinculada_con: membresia.promocion_vinculada_con || null,
        descuento_porcentaje: extraerDescuentoPorcentaje(membresia.promocion),
        duracion_unidad: unidad,
        meses: membresia.meses,
        dias_restantes: diasRestantes,
        usos_totales: asistencias.total,
        usos_restantes: asistencias.restantes,
        ...payloadAsistencias(membresia)
    };

    if (membresia.estado_membresia !== 'activa' || diasRestantes < 0) {
        await pool.query(
            `UPDATE membresias
             SET estado = 'vencida'
             WHERE id = ?
             AND empresa_id = ?`,
            [membresia.membresia_id, empresaId]
        );

        await desactivarClienteSiSinMembresiaActiva(
            membresia.cliente_id,
            membresia.membresia_id,
            empresaId
        );

        await pool.query(
            `INSERT INTO asistencias
            (empresa_id, cliente_id, membresia_id, codigo_usado, estado, motivo, cuenta_como_uso)
            VALUES (?, ?, ?, ?, 'denegado', 'Membresia vencida', 0)`,
            [
                empresaId,
                membresia.cliente_id,
                membresia.membresia_id,
                membresia.codigo
            ]
        );

        return {
            ...payloadBase,
            valido: false,
            estado: 'vencida',
            mensaje: 'Membresia vencida',
            estado_visual: 'vencida',
            dias_vencido: Math.abs(diasRestantes)
        };
    }

    if (!asistencias.ilimitada && asistencias.usadas >= asistencias.total) {
        await pool.query(
            `INSERT INTO asistencias
            (empresa_id, cliente_id, membresia_id, codigo_usado, estado, motivo, cuenta_como_uso)
            VALUES (?, ?, ?, ?, 'denegado', 'Membresia sin asistencias disponibles', 0)`,
            [
                empresaId,
                membresia.cliente_id,
                membresia.membresia_id,
                membresia.codigo
            ]
        );

        await crearNotificacion({
            empresa_id: empresaId,
            tipo: 'asistencias_agotadas',
            titulo: 'Asistencias agotadas',
            mensaje: `${membresia.cliente} ya no tiene asistencias disponibles.`,
            entidad: 'membresia',
            entidad_id: membresia.membresia_id,
            evento_key: `${membresia.membresia_id}-asistencias-agotadas`
        });

        return {
            ...payloadBase,
            valido: false,
            estado: 'sin_asistencias',
            mensaje: 'Membresia sin asistencias disponibles',
            mensaje_secundario: 'La membresia ya no tiene asistencias disponibles.',
            estado_visual: 'sin_asistencias'
        };
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [[actual]] = await conn.query(
            `SELECT
                id AS membresia_id,
                asistencias_totales,
                asistencias_usadas
             FROM membresias
             WHERE id = ?
             AND empresa_id = ?
             FOR UPDATE`,
            [membresia.membresia_id, empresaId]
        );

        const asistenciasActuales = resumenAsistencias(actual || {});

        if (!asistenciasActuales.ilimitada && asistenciasActuales.usadas >= asistenciasActuales.total) {
            await conn.query(
                `INSERT INTO asistencias
                (empresa_id, cliente_id, membresia_id, codigo_usado, estado, motivo, cuenta_como_uso)
                VALUES (?, ?, ?, ?, 'denegado', 'Membresia sin asistencias disponibles', 0)`,
                [
                    empresaId,
                    membresia.cliente_id,
                    membresia.membresia_id,
                    membresia.codigo
                ]
            );

            await crearNotificacion({
                empresa_id: empresaId,
                tipo: 'asistencias_agotadas',
                titulo: 'Asistencias agotadas',
                mensaje: `${membresia.cliente} ya no tiene asistencias disponibles.`,
                entidad: 'membresia',
                entidad_id: membresia.membresia_id,
                evento_key: `${membresia.membresia_id}-asistencias-agotadas`
            }, conn);

            await conn.commit();

            return {
                ...payloadBase,
                ...payloadAsistencias(actual || {}),
                valido: false,
                estado: 'sin_asistencias',
                mensaje: 'Membresia sin asistencias disponibles',
                mensaje_secundario: 'La membresia ya no tiene asistencias disponibles.',
                estado_visual: 'sin_asistencias'
            };
        }

        const limites = limitesDiaPeruMysqlUTC();

        const [[asistenciaHoy]] = await conn.query(
            `SELECT id
             FROM asistencias
             WHERE membresia_id = ?
             AND empresa_id = ?
             AND estado = 'permitido'
             AND cuenta_como_uso = 1
             AND fecha_hora >= ?
             AND fecha_hora < ?
             LIMIT 1`,
            [membresia.membresia_id, empresaId, limites.inicio, limites.fin]
        );

        const cuentaComoUso = asistenciaHoy ? 0 : 1;

        let actualizada = {
            asistencias_totales: actual?.asistencias_totales ?? null,
            asistencias_usadas: actual?.asistencias_usadas ?? 0
        };

        if (cuentaComoUso === 1 && !asistenciasActuales.ilimitada) {
            await conn.query(
                `UPDATE membresias
                 SET asistencias_usadas = LEAST(COALESCE(asistencias_usadas, 0) + 1, asistencias_totales),
                     usos_totales = asistencias_totales,
                     usos_restantes = GREATEST(asistencias_totales - LEAST(COALESCE(asistencias_usadas, 0) + 1, asistencias_totales), 0)
                 WHERE id = ?
                 AND empresa_id = ?`,
                [membresia.membresia_id, empresaId]
            );

            [[actualizada]] = await conn.query(
                `SELECT asistencias_totales, asistencias_usadas
                 FROM membresias
                 WHERE id = ?
                 AND empresa_id = ?`,
                [membresia.membresia_id, empresaId]
            );
        }

        await conn.query(
            `INSERT INTO asistencias
            (empresa_id, cliente_id, membresia_id, codigo_usado, estado, motivo, cuenta_como_uso)
            VALUES (?, ?, ?, ?, 'permitido', ?, ?)`,
            [
                empresaId,
                membresia.cliente_id,
                membresia.membresia_id,
                membresia.codigo,
                cuentaComoUso
                    ? 'Ingreso permitido'
                    : 'Este cliente ya registro asistencia hoy. No se desconto otra asistencia.',
                cuentaComoUso
            ]
        );

        if (cuentaComoUso === 1) {
            await crearNotificacion({
                empresa_id: empresaId,
                tipo: 'ingreso_registrado',
                titulo: 'Nuevo ingreso registrado',
                mensaje: `${membresia.cliente} ingresó correctamente con el plan ${membresia.plan}.`,
                entidad: 'asistencia',
                entidad_id: membresia.membresia_id,
                evento_key: null
            }, conn);

            await registrarEventoCliente({
                empresa_id: empresaId,
                cliente_id: membresia.cliente_id,
                tipo_evento: 'asistencia_registrada',
                titulo: 'Ingreso registrado',
                descripcion: `${membresia.cliente} ingreso correctamente con el plan ${membresia.plan}.`,
                metadata: {
                    membresia_id: membresia.membresia_id,
                    codigo: membresia.codigo
                }
            }, conn);
        }

        await conn.commit();

        const payloadFinal = payloadAsistencias(actualizada);

        return {
            ...payloadBase,
            ...payloadFinal,
            usos_totales: payloadFinal.asistencias_totales,
            usos_restantes: payloadFinal.asistencias_restantes,
            valido: true,
            estado: 'activa',
            mensaje: cuentaComoUso
                ? 'Membresia activa'
                : 'Este cliente ya registro asistencia hoy.',
            mensaje_secundario: cuentaComoUso
                ? 'Ingreso permitido'
                : 'No se desconto otra asistencia.',
            cuenta_como_uso: cuentaComoUso,
            estado_visual: estadoVisual
        };

    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}
async function obtenerMembresiasPorCodigo(codigo, empresaId) {
    const hoyPeru = fechaPeruISO();
    const [rows] = await pool.query(`
        SELECT
            m.id AS membresia_id,
            m.codigo,
            m.meses,
            DATE_FORMAT(m.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
            DATE_FORMAT(m.fecha_fin, '%Y-%m-%d') AS fecha_fin,
            m.estado AS estado_membresia,
            m.promocion,
            m.promocion_id,
            COALESCE(m.duracion_unidad, 'meses') AS duracion_unidad,
            m.usos_totales,
            m.usos_restantes,
            m.asistencias_totales,
            COALESCE(m.asistencias_usadas, 0) AS asistencias_usadas,
            DATEDIFF(DATE(m.fecha_fin), ?) AS dias_restantes,
            CASE
                WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), ?) < 0 THEN 'vencida'
                WHEN m.asistencias_totales IS NOT NULL AND COALESCE(m.asistencias_usadas, 0) >= m.asistencias_totales THEN 'sin_asistencias'
                WHEN DATEDIFF(DATE(m.fecha_fin), ?) = 0 THEN 'vence_hoy'
                WHEN DATEDIFF(DATE(m.fecha_fin), ?) = 1 THEN 'vence_manana'
                WHEN DATEDIFF(DATE(m.fecha_fin), ?) = 3 THEN 'vence_3_dias'
                WHEN m.estado = 'activa' THEN 'activa'
                ELSE 'inactiva'
            END AS estado_visual,
            (
                SELECT GROUP_CONCAT(c2.nombre ORDER BY m2.id SEPARATOR ', ')
                FROM membresias m2
                INNER JOIN clientes c2 ON c2.id = m2.cliente_id
                WHERE m2.promocion_id = m.promocion_id
                AND m.promocion_id IS NOT NULL
                AND m2.id != m.id
            ) AS promocion_vinculada_con,
            c.id AS cliente_id,
            c.nombre AS cliente,
            c.dni,
            c.estado AS estado_cliente,
            p.nombre AS plan
        FROM membresias m
        INNER JOIN clientes c ON m.cliente_id = c.id AND m.empresa_id = c.empresa_id
        INNER JOIN planes p ON m.plan_id = p.id AND m.empresa_id = p.empresa_id
        WHERE m.codigo = ? AND m.empresa_id = ?
        ORDER BY m.id ASC
    `, [hoyPeru, hoyPeru, hoyPeru, hoyPeru, hoyPeru, codigo, empresaId]);

    return rows;
}

app.get('/api/membresias', requirePermission('membresias.ver'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                m.id,
                m.cliente_id,
                c.nombre AS cliente,
                c.dni,
                c.correo,
                p.nombre AS plan,
                m.codigo,
                m.meses,
                COALESCE(m.duracion_unidad, 'meses') AS duracion_unidad,
                m.usos_totales,
                m.usos_restantes,
                m.asistencias_totales,
                COALESCE(m.asistencias_usadas, 0) AS asistencias_usadas,
                m.promocion_id,
                m.precio_total,
                m.promocion,
                m.fecha_inicio,
                m.fecha_fin,
                m.estado,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN m.asistencias_totales IS NOT NULL AND COALESCE(m.asistencias_usadas, 0) >= m.asistencias_totales THEN 'sin_asistencias'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual
            FROM membresias m
            INNER JOIN clientes c ON m.cliente_id = c.id AND m.empresa_id = c.empresa_id
            INNER JOIN planes p ON m.plan_id = p.id AND m.empresa_id = p.empresa_id
            WHERE m.empresa_id = ?
            ORDER BY m.id DESC
        `, [req.empresaId]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener membresías'
        });
    }
});

app.post('/api/membresias', requirePermission('membresias.crear'), async (req, res) => {
    try {
        const {
            cliente_id,
            plan_id,
            meses,
            precio_total,
            promocion,
            fecha_inicio,
            fecha_fin,
            duracion_unidad,
            usos_totales,
            usos_restantes,
            origen
        } = req.body;

        const [[cliente]] = await pool.query(
            `SELECT id, nombre
             FROM clientes
WHERE id = ?
AND empresa_id = ?`,
            [cliente_id, req.empresaId]
        );

        if (!cliente) {
            return res.status(400).json({ error: 'Debes seleccionar un cliente registrado.' });
        }

        const membresiaActiva = await obtenerMembresiaActivaCliente(cliente_id, req.empresaId);
        if (membresiaActiva) {
            return res.status(409).json({
                error: 'Este cliente ya tiene una membresia activa. Si deseas extender su acceso, borra su membresia y haz una nueva.',
                code: 'cliente_membresia_activa'
            });
        }

        const plan = await obtenerPlanParaMembresia(plan_id, req.empresaId);
        if (!plan) {
            return res.status(400).json({ error: 'Plan no valido' });
        }

        const unidad = normalizarDuracionUnidad(duracion_unidad || plan.duracion_unidad);
        const cantidad = normalizarDuracionValor(meses);
        const mesesGuardados = mesesCompatibles(cantidad, unidad);
        const fechaFinFinal = fecha_fin || calcularFechaFin(fecha_inicio, cantidad, unidad);
        const asistenciasTotalesFinal = asistenciasDesdePlan(plan, usos_totales ?? cantidad);
        const asistenciasUsadasFinal = 0;
        const usosTotalesFinal = asistenciasTotalesFinal;
        const usosRestantesFinal = asistenciasTotalesFinal;

        const codigo = await generarCodigoUnico(req.empresaId);

        const [membresiaExistente] = await pool.query(
            `SELECT *
             FROM membresias
             WHERE cliente_id = ? AND empresa_id = ?
             AND (
                estado <> 'activa'
                OR DATE(fecha_fin) < CURDATE()
                OR (asistencias_totales IS NOT NULL AND COALESCE(asistencias_usadas, 0) >= asistencias_totales)
             )
             ORDER BY id DESC
             LIMIT 1`,
            [cliente_id, req.empresaId]
        );

if (membresiaExistente.length > 0) {
    const membresia = membresiaExistente[0];

    await pool.query(
        `UPDATE membresias
         SET plan_id = ?,
             codigo = ?,
             meses = ?,
             precio_total = ?,
             promocion = ?,
             fecha_inicio = ?,
             fecha_fin = ?,
             duracion_unidad = ?,
             usos_totales = ?,
             usos_restantes = ?,
             asistencias_totales = ?,
             asistencias_usadas = ?,
             promocion_id = NULL,
             estado = 'activa',
             origen = ?
         WHERE id = ? AND empresa_id = ?`,
        [
            plan_id,
            codigo,
            mesesGuardados,
            precio_total,
            promocion || null,
            fecha_inicio,
            fechaFinFinal,
            unidad,
            usosTotalesFinal,
            usosRestantesFinal,
            asistenciasTotalesFinal,
            asistenciasUsadasFinal,
            origen || 'presencial',
            membresia.id,
            req.empresaId
        ]
    );

    await pool.query(
        `UPDATE clientes
SET estado = 'activo'
WHERE id = ? AND empresa_id = ?`,
        [cliente_id, req.empresaId]
    );

    const resumen = await obtenerResumenMembresia(membresia.id, req.empresaId);
    if (resumen) {
        await crearNotificacion({
            tipo: 'membresia_creada',
            titulo: 'Nueva membresia creada',
            mensaje: `${resumen.cliente} adquirio el plan ${resumen.plan} por ${formatearMoneda(resumen.precio_total)}.`,
            entidad: 'membresia',
            entidad_id: membresia.id,
            ...adminNotificacion(req)
        });
    }

    await registrarEventoCliente({
        ...adminEvento(req),
        cliente_id,
        tipo_evento: 'membresia_renovada',
        titulo: 'Membresia renovada',
        descripcion: `Se asigno el plan ${plan.nombre} al cliente.`,
        metadata: { membresia_id: membresia.id, plan_id, codigo }
    });

    return res.json({
        id: membresia.id,
        codigo,
        actualizado: true
    });
}

        const [result] = await pool.query(
            `INSERT INTO membresias
            (empresa_id, cliente_id, plan_id, codigo, meses, precio_total, promocion, fecha_inicio, fecha_fin, duracion_unidad, usos_totales, usos_restantes, asistencias_totales, asistencias_usadas, estado, origen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?)`,
            [
                req.empresaId,
                cliente_id,
                plan_id,
                codigo,
                mesesGuardados,
                precio_total,
                promocion || null,
                fecha_inicio,
                fechaFinFinal,
                unidad,
                usosTotalesFinal,
                usosRestantesFinal,
                asistenciasTotalesFinal,
                asistenciasUsadasFinal,
                origen || 'presencial'
            ]
        );
        await pool.query(
    `UPDATE clientes
     SET estado = 'activo'
     WHERE id = ? AND empresa_id = ?`,
    [cliente_id, req.empresaId]
);

        const resumen = await obtenerResumenMembresia(result.insertId, req.empresaId);
        if (resumen) {
            await crearNotificacion({
                tipo: 'membresia_creada',
                titulo: 'Nueva membresia creada',
                mensaje: `${resumen.cliente} adquirio el plan ${resumen.plan} por ${formatearMoneda(resumen.precio_total)}.`,
                entidad: 'membresia',
                entidad_id: result.insertId,
                ...adminNotificacion(req)
            });
        }

        await registrarEventoCliente({
            ...adminEvento(req),
            cliente_id,
            tipo_evento: 'membresia_creada',
            titulo: 'Membresia asignada',
            descripcion: `Se asigno el plan ${plan.nombre} al cliente.`,
            metadata: { membresia_id: result.insertId, plan_id, codigo }
        });

        res.json({
            id: result.insertId,
            codigo
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al crear membresía'
        });
    }
});

app.post('/api/membresias/:id/congelar', requirePermission('membresias.congelar'), async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const empresaId = getEmpresaId(req);
        const membresiaId = Number(req.params.id);
        const fechaInicio = fechaSoloISO(req.body.fecha_inicio);
        const fechaFin = fechaSoloISO(req.body.fecha_fin);
        const motivo = limpiarTexto(req.body.motivo);
        const dias = diasInclusivos(fechaInicio, fechaFin);

        if (!membresiaId || !fechaInicio || !fechaFin || dias <= 0) {
            return res.status(400).json({ error: 'Selecciona un rango valido para congelar la membresia.' });
        }

        await conn.beginTransaction();

        const [[membresia]] = await conn.query(
            `SELECT
                m.id,
                m.cliente_id,
                m.codigo,
                m.estado,
                DATE_FORMAT(m.fecha_fin, '%Y-%m-%d') AS fecha_fin,
                COALESCE(m.duracion_unidad, 'meses') AS duracion_unidad,
                c.nombre AS cliente,
                p.nombre AS plan
             FROM membresias m
             INNER JOIN clientes c ON c.id = m.cliente_id AND c.empresa_id = m.empresa_id
             INNER JOIN planes p ON p.id = m.plan_id AND p.empresa_id = m.empresa_id
             WHERE m.id = ? AND m.empresa_id = ?
             FOR UPDATE`,
            [membresiaId, empresaId]
        );

        if (!membresia) {
            await conn.rollback();
            return res.status(404).json({ error: 'Membresia no encontrada' });
        }

        if (membresia.estado !== 'activa' || (membresia.duracion_unidad !== 'usos' && membresia.fecha_fin < fechaPeruISO())) {
            await conn.rollback();
            return res.status(409).json({ error: 'Solo se pueden congelar membresias activas.' });
        }

        const [[duplicado]] = await conn.query(
            `SELECT id
             FROM membresia_congelamientos
             WHERE membresia_id = ? AND empresa_id = ?
             AND NOT (fecha_fin < ? OR fecha_inicio > ?)
             LIMIT 1`,
            [membresiaId, empresaId, fechaInicio, fechaFin]
        );

        if (duplicado) {
            await conn.rollback();
            return res.status(409).json({ error: 'Ya existe un congelamiento registrado en ese rango.' });
        }

        const nuevaFechaFin = sumarDiasISO(membresia.fecha_fin, dias);

        const [result] = await conn.query(
            `INSERT INTO membresia_congelamientos
             (empresa_id, membresia_id, cliente_id, usuario_id, fecha_inicio, fecha_fin, dias_congelados, motivo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                empresaId,
                membresiaId,
                membresia.cliente_id,
                req.session.adminId || null,
                fechaInicio,
                fechaFin,
                dias,
                motivo || null
            ]
        );

        await conn.query(
            `UPDATE membresias
             SET fecha_fin = ?
             WHERE id = ? AND empresa_id = ?`,
            [nuevaFechaFin, membresiaId, empresaId]
        );

        await registrarEventoCliente({
            ...adminEvento(req),
            cliente_id: membresia.cliente_id,
            tipo_evento: 'membresia_congelada',
            titulo: 'Membresia congelada',
            descripcion: `Se congelo la membresia por ${dias} dias.${motivo ? ` Motivo: ${motivo}.` : ''}`,
            metadata: {
                membresia_id: membresiaId,
                congelamiento_id: result.insertId,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                dias_congelados: dias,
                nueva_fecha_fin: nuevaFechaFin
            }
        }, conn);

        await conn.commit();

        return res.json({
            mensaje: 'Membresia congelada correctamente',
            dias_congelados: dias,
            nueva_fecha_fin: nuevaFechaFin
        });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        return res.status(500).json({ error: 'Error al congelar membresia' });
    } finally {
        conn.release();
    }
});

app.post('/api/membresias/grupal', requirePermission('membresias.crear'), async (req, res) => {
    const conn = await pool.getConnection();

    try {

        const empresaId = getEmpresaId(req);
        const {
            plan_id,
            meses,
            promocion_etiqueta,
            fecha_inicio,
            fecha_fin,
            precio_total,
            duracion_unidad,
            usos_totales,
            usos_restantes,
            personas,
            origen
        } = req.body;

        if (!plan_id || !fecha_inicio || !fecha_fin || !Array.isArray(personas) || personas.length === 0) {
            return res.status(400).json({
                error: 'Selecciona un plan, define fecha de inicio y fecha fin, y agrega al menos una persona.'
            });
        }

        if (promocion_etiqueta === 'Promoción 2x1' && personas.length > 2) {
            return res.status(400).json({
                error: 'La promoción 2x1 solo permite registrar hasta 2 integrantes.'
            });
        }

        const dnis = personas
            .map(p => String(p.dni || '').replace(/\D/g, ''))
            .filter(Boolean);
        const dnisUnicos = new Set(dnis);

        if (dnis.length !== dnisUnicos.size) {
            return res.status(400).json({
                error: 'No se permiten DNI duplicados entre personas'
            });
        }

        for (const persona of personas) {
            const errorCliente = persona.cliente_id
                ? null
                : validarPayloadCliente({
                    nombre: persona.nombre,
                    dni: persona.dni,
                    correo: persona.correo
                });

            if (errorCliente) {
                return res.status(400).json({ error: errorCliente });
            }
        }

        const correos = personas
            .map(p => normalizarCorreo(p.correo))
            .filter(Boolean);
        if (correos.length !== new Set(correos).size) {
            return res.status(400).json({
                error: 'Hay personas con el mismo correo. Cada integrante debe tener un correo diferente.'
            });
        }

        await conn.beginTransaction();

        const plan = await obtenerPlanParaMembresia(plan_id, empresaId, conn);
        if (!plan) {
            throw new Error('El plan seleccionado no existe, está inactivo o no pertenece a esta empresa.');
        }

        const unidad = normalizarDuracionUnidad(duracion_unidad || plan.duracion_unidad);
        const cantidad = normalizarDuracionValor(meses);
        const mesesGuardados = mesesCompatibles(cantidad, unidad);
        const fechaFinFinal = fecha_fin || calcularFechaFin(fecha_inicio, cantidad, unidad);
        const asistenciasTotalesFinal = asistenciasDesdePlan(plan, usos_totales ?? cantidad);
        const asistenciasUsadasFinal = 0;
        const usosTotalesFinal = asistenciasTotalesFinal;
        const usosRestantesFinal = asistenciasTotalesFinal;

        let promocionId = null;
        if (promocion_etiqueta) {
            const [promocionCreada] = await conn.query(
                `INSERT INTO promociones (empresa_id, tipo)
VALUES (?, ?)`,
                [empresaId, promocion_etiqueta]
            );
            promocionId = promocionCreada.insertId;
        }

        const membresiasCreadas = [];

        for (let i = 0; i < personas.length; i++) {
            const persona = personas[i];
            let clienteId = persona.cliente_id || null;
            let clienteNuevo = null;
            let nombreCliente = String(persona.nombre || '').trim();

            if (clienteId) {
                const [[cliente]] = await conn.query(
                    'SELECT id, nombre FROM clientes WHERE id = ? AND empresa_id = ?',
                    [clienteId, empresaId]
                );

                if (!cliente) {
                    throw new Error('Uno de los clientes seleccionados no existe o no pertenece a esta empresa.');
                }

                if (await obtenerMembresiaActivaCliente(clienteId, empresaId, conn)) {
                    const error = new Error(`El cliente ${cliente.nombre} ya tiene una membresía activa. Para continuar, usa la opción renovar membresía.`);
                    error.statusCode = 409;
                    throw error;
                }

                nombreCliente = cliente.nombre;
            } else {
                const nombre = String(persona.nombre || '').trim();
                const dni = normalizarDni(persona.dni);
                const telefono = String(persona.telefono || '').trim();
                const correo = normalizarCorreo(persona.correo);

                if (!nombre || !dni) {
                    throw new Error('Para registrar una persona nueva, debes ingresar nombre y DNI.');
                }

                if (await existeDniCliente(dni, empresaId, null, conn)) {
                    const error = new Error('Ya existe un cliente registrado con este DNI. Selecciónalo como cliente existente en lugar de crearlo nuevamente.');
                    error.statusCode = 409;
                    throw error;
                }

                if (await existeCorreoCliente(correo, empresaId, null, conn)) {
                    const error = new Error('Ya existe un cliente registrado con este correo. Usa ese cliente existente o ingresa otro correo.');
                    error.statusCode = 409;
                    throw error;
                }

                const [clienteCreado] = await conn.query(
                    `INSERT INTO clientes (empresa_id, nombre, dni, telefono, correo, estado)
VALUES (?, ?, ?, ?, ?, 'activo')`,
                    [empresaId, nombre, dni, telefono, correo || null]
                );

                clienteId = clienteCreado.insertId;
                clienteNuevo = { id: clienteId, nombre, dni };
                nombreCliente = nombre;
            }

            const precioRegistro = i === 0 ? Number(precio_total || 0) : 0;
            const codigoPersona = await generarCodigoUnico(empresaId, conn);

            const [membresiaCreada] = await conn.query(
                `INSERT INTO membresias
(empresa_id, cliente_id, plan_id, codigo, meses, precio_total, promocion, fecha_inicio, fecha_fin, duracion_unidad, usos_totales, usos_restantes, asistencias_totales, asistencias_usadas, promocion_id, estado, origen)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?)`,
                [
                    empresaId,
                    clienteId,
                    plan_id,
                    codigoPersona,
                    mesesGuardados,
                    precioRegistro,
                    promocion_etiqueta || null,
                    fecha_inicio,
                    fechaFinFinal,
                    unidad,
                    usosTotalesFinal,
                    usosRestantesFinal,
                    asistenciasTotalesFinal,
                    asistenciasUsadasFinal,
                    promocionId,
                    origen || 'presencial'
                ]
            );

            await conn.query(
                `UPDATE clientes
SET estado = 'activo'
WHERE id = ? AND empresa_id = ?`,
                [clienteId, empresaId]
            );

            if (clienteNuevo) {
                await crearNotificacion({
                    tipo: 'cliente_creado',
                    titulo: 'Nuevo cliente registrado',
                    mensaje: `Se registro a ${clienteNuevo.nombre} con DNI ${clienteNuevo.dni}.`,
                    entidad: 'cliente',
                    entidad_id: clienteNuevo.id,
                    ...adminNotificacion(req)
                }, conn);
            }

            const resumen = await obtenerResumenMembresia(membresiaCreada.insertId, empresaId, conn);
            if (resumen) {
                await crearNotificacion({
                    tipo: 'membresia_creada',
                    titulo: 'Nueva membresia creada',
                    mensaje: `${resumen.cliente} adquirio el plan ${resumen.plan} por ${formatearMoneda(resumen.precio_total)}.`,
                    entidad: 'membresia',
                    entidad_id: membresiaCreada.insertId,
                    ...adminNotificacion(req)
                }, conn);
            }

            membresiasCreadas.push({
                id: membresiaCreada.insertId,
                cliente_id: clienteId,
                cliente: nombreCliente,
                codigo: codigoPersona,
                precio_total: precioRegistro
            });
        }
        await crearNotificacion({
    tipo: 'membresia_grupal_creada',
    titulo: 'Nueva membresía grupal creada',
    mensaje: `Se creó una membresía grupal para ${membresiasCreadas.length} integrantes: ${membresiasCreadas.map(item => item.cliente).join(', ')}.`,
    entidad: 'membresia_grupal',
    entidad_id: membresiasCreadas[0]?.id || 0,
    ...adminNotificacion(req),
    evento_key: `membresia-grupal-${membresiasCreadas.map(item => item.id).join('-')}`
}, conn);
        await conn.commit();

        res.json({
            codigo: membresiasCreadas[0]?.codigo || null,
            cliente: membresiasCreadas[0]?.cliente || null,
            codigos: membresiasCreadas.map(item => ({
                cliente: item.cliente,
                codigo: item.codigo
            })),
            membresias: membresiasCreadas,
            promocion_id: promocionId,
            promocion: promocion_etiqueta || null
        });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(error.statusCode || 500).json({
            error: error.message || 'No se pudo crear la membresía grupal. Inténtalo nuevamente o revisa los datos ingresados.'
        });
    } finally {
        conn.release();
    }
});

function obtenerDatosPlan(body) {
    const nombre = String(body.nombre || '').trim();
    const precioRaw = body.precio ?? body.precio_mensual;
    const precio = precioRaw === undefined || precioRaw === null ? '' : String(precioRaw).trim();
    const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    const estado = body.estado === 'inactivo' ? 'inactivo' : 'activo';
    const tipo = body.tipo ? String(body.tipo).trim() : 'mensual';
    const duracion_valor = normalizarDuracionValor(body.duracion_valor);
    const duracion_unidad = normalizarDuracionUnidad(body.duracion_unidad);
    const es_ilimitado = body.es_ilimitado === true
        || body.es_ilimitado === 'true'
        || body.es_ilimitado === 1
        || body.es_ilimitado === '1';
    const asistencias_incluidas = es_ilimitado
        ? null
        : normalizarAsistencias(body.asistencias_incluidas ?? body.usos_totales ?? body.limite_usos);
    const color_precio = normalizarColorPrecioPlan(body.color_precio);

    return { nombre, precio, descripcion, estado, tipo, duracion_valor, duracion_unidad, asistencias_incluidas, es_ilimitado, color_precio };
}

function normalizarColorPrecioPlan(color) {
    const valor = String(color || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor.toUpperCase() : null;
}

function validarDatosPlan(datos) {
    if (!datos.nombre || datos.precio === '' || Number.isNaN(Number(datos.precio))) {
        return 'Nombre y precio son obligatorios';
    }

    if (!datos.es_ilimitado && !datos.asistencias_incluidas) {
        return 'Asistencias incluidas es obligatorio para planes no ilimitados';
    }

    return null;
}

app.get('/api/planes', requirePermission('planes.ver'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

const [rows] = await pool.query(`
            SELECT
                id,
                nombre,
                precio_mensual,
                precio_mensual AS precio,
                tipo,
                descripcion,
                estado,
                COALESCE(duracion_valor, 1) AS duracion_valor,
                COALESCE(duracion_unidad, 'meses') AS duracion_unidad,
                asistencias_incluidas,
                COALESCE(es_ilimitado, 0) AS es_ilimitado,
                color_precio
            FROM planes
            WHERE estado = 'activo' AND empresa_id = ?
            ORDER BY id ASC
        `, [empresaId]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener planes'
        });
    }
});

app.get('/api/validar/:codigo', requirePermission('validacion.usar'), async (req, res) => {
    try {
        const { codigo } = req.params;
        const rows = await obtenerMembresiasPorCodigo(codigo, req.empresaId);

        if (rows.length === 0) {
            await pool.query(
                `INSERT INTO asistencias
(empresa_id, cliente_id, membresia_id, codigo_usado, estado, motivo, cuenta_como_uso)
VALUES (?, NULL, NULL, ?, 'denegado', 'Codigo inexistente', 0)`,
                [req.empresaId, codigo]
            );

            return res.status(404).json({
                valido: false,
                estado: 'inexistente',
                mensaje: 'Código no existe o fue reemplazado'
            });
        }

        if (rows.length > 1) {
            return res.json({
                requiereSeleccion: true,
                codigo,
                promocion: rows.find(r => r.promocion)?.promocion || null,
                personas: rows.map(r => ({
                    membresia_id: r.membresia_id,
                    cliente_id: r.cliente_id,
                    nombre: r.cliente,
                    dni: r.dni,
                    plan: r.plan,
                    estado: r.estado_membresia,
                    fecha_fin: r.fecha_fin,
                    duracion_unidad: r.duracion_unidad,
                    usos_totales: r.usos_totales,
                    usos_restantes: r.usos_restantes,
                    asistencias_totales: r.asistencias_totales,
                    asistencias_usadas: r.asistencias_usadas,
                    asistencias_restantes: r.asistencias_totales === null ? null : Math.max(Number(r.asistencias_totales) - Number(r.asistencias_usadas || 0), 0),
                    asistencias_ilimitadas: r.asistencias_totales === null,
                    promocion_vinculada_con: r.promocion_vinculada_con,
                    dias_restantes: r.dias_restantes,
                    estado_visual: r.estado_visual,
                    promocion: r.promocion
                }))
            });
        }

        return res.json(await validarMembresiaYRegistrar(rows[0], req.empresaId));

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al validar código'
        });
    }
});

app.post('/api/validar', requirePermission('validacion.usar'), async (req, res) => {
    try {
        const { codigo, membresia_id } = req.body;

        if (!codigo || !membresia_id) {
            return res.status(400).json({
                error: 'Código y membresía son obligatorios'
            });
        }

        const membresias = await obtenerMembresiasPorCodigo(codigo, req.empresaId);
        const membresia = membresias.find(m => String(m.membresia_id) === String(membresia_id));

        if (!membresia) {
            return res.status(404).json({
                valido: false,
                estado: 'inexistente',
                mensaje: 'Membresía no encontrada para este código'
            });
        }

        return res.json(await validarMembresiaYRegistrar(membresia, req.empresaId));

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al validar membresía'
        });
    }
});

app.get('/api/validar-legacy/:codigo', requirePermission('validacion.usar'), async (req, res) => {
    try {
        const { codigo } = req.params;
        const membresias = await obtenerMembresiasPorCodigo(codigo, req.empresaId);

        if (membresias.length === 0) {
            await pool.query(
                `INSERT INTO asistencias
                (empresa_id, cliente_id, membresia_id, codigo_usado, estado, motivo, cuenta_como_uso)
                VALUES (?, NULL, NULL, ?, 'denegado', 'Codigo inexistente', 0)`,
                [req.empresaId, codigo]
            );

            return res.status(404).json({
                valido: false,
                estado: 'inexistente',
                mensaje: 'Código no existe o fue reemplazado'
            });
        }

        return res.json(
            await validarMembresiaYRegistrar(membresias[0], req.empresaId)
        );

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al validar código'
        });
    }
});

app.get('/api/asistencias', requirePermission('asistencias.ver'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [rows] = await pool.query(`
            SELECT
                a.id,
                a.codigo_usado,
                a.estado,
                a.motivo,
                a.cuenta_como_uso,
                a.fecha_hora,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan
            FROM asistencias a
            LEFT JOIN clientes c 
                ON a.cliente_id = c.id
                AND c.empresa_id = a.empresa_id
            LEFT JOIN membresias m 
                ON a.membresia_id = m.id
                AND m.empresa_id = a.empresa_id
            LEFT JOIN planes p 
                ON m.plan_id = p.id
                AND p.empresa_id = a.empresa_id
            WHERE a.empresa_id = ?
            ORDER BY a.fecha_hora DESC
        `, [empresaId]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener asistencias'
        });
    }
});

app.get('/api/asistencias/:id', requirePermission('asistencias.ver'), async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(`
            SELECT
                a.id,
                a.codigo_usado,
                a.estado,
                a.motivo,
                a.cuenta_como_uso,
                a.fecha_hora,
                a.membresia_id,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan
            FROM asistencias a
            LEFT JOIN clientes c
                ON a.cliente_id = c.id
                AND c.empresa_id = a.empresa_id
            LEFT JOIN membresias m
                ON a.membresia_id = m.id
                AND m.empresa_id = a.empresa_id
            LEFT JOIN planes p
                ON m.plan_id = p.id
                AND p.empresa_id = a.empresa_id
            WHERE a.id = ?
            AND a.empresa_id = ?
            LIMIT 1
        `, [id, req.empresaId]);

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Asistencia no encontrada'
            });
        }

        return res.json(rows[0]);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al obtener asistencia'
        });
    }
});

app.delete('/api/asistencias/:id', requirePermission('asistencias.eliminar'), async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const { id } = req.params;
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT id, membresia_id, cuenta_como_uso
             FROM asistencias
             WHERE id = ?
             AND empresa_id = ?
             LIMIT 1`,
            [id, req.empresaId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                error: 'Asistencia no encontrada'
            });
        }

        const asistencia = rows[0];

        if (Number(asistencia.cuenta_como_uso) === 1 && asistencia.membresia_id) {
            await conn.query(
                `UPDATE membresias
                 SET asistencias_usadas = GREATEST(COALESCE(asistencias_usadas, 0) - 1, 0),
                     usos_restantes = CASE
                        WHEN asistencias_totales IS NULL THEN NULL
                        ELSE LEAST(COALESCE(usos_restantes, 0) + 1, asistencias_totales)
                     END
                 WHERE id = ?
                 AND empresa_id = ?`,
                [asistencia.membresia_id, req.empresaId]
            );
        }

        await conn.query(
            `DELETE FROM asistencias
             WHERE id = ?
             AND empresa_id = ?`,
            [id, req.empresaId]
        );

        await conn.commit();

        return res.json({
            mensaje: 'Asistencia eliminada correctamente'
        });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        return res.status(500).json({
            error: 'Error al eliminar asistencia'
        });
    } finally {
        conn.release();
    }
});

app.get('/api/exportar/clientes', requirePermission('exportar.clientes'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [rows] = await pool.query(`
            SELECT
                id,
                nombre,
                dni,
                telefono,
                correo,
                estado,
                fecha_registro
            FROM clientes
            WHERE empresa_id = ?
            ORDER BY id ASC
        `, [empresaId]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al exportar clientes'
        });
    }
});

app.get('/api/exportar/membresias', requirePermission('exportar.membresias'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                m.id,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan,
                m.codigo,
                m.meses,
                COALESCE(m.duracion_unidad, 'meses') AS duracion_unidad,
                m.usos_totales,
                m.usos_restantes,
                m.asistencias_totales,
                COALESCE(m.asistencias_usadas, 0) AS asistencias_usadas,
                m.promocion_id,
                m.precio_total,
                m.promocion,
                m.fecha_inicio,
                m.fecha_fin,
                m.estado
            FROM membresias m
            LEFT JOIN clientes c ON m.cliente_id = c.id AND m.empresa_id = c.empresa_id
            LEFT JOIN planes p ON m.plan_id = p.id AND m.empresa_id = p.empresa_id
            WHERE m.empresa_id = ?
            ORDER BY m.id ASC
        `, [req.empresaId]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al exportar membresias'
        });
    }
});

app.get('/api/exportar/asistencias', requirePermission('exportar.asistencias'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [rows] = await pool.query(`
            SELECT
                a.id,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan,
                a.codigo_usado,
                a.estado,
                a.motivo,
                a.cuenta_como_uso,
                a.fecha_hora
            FROM asistencias a
            LEFT JOIN clientes c
                ON a.cliente_id = c.id
                AND c.empresa_id = a.empresa_id
            LEFT JOIN membresias m
                ON a.membresia_id = m.id
                AND m.empresa_id = a.empresa_id
            LEFT JOIN planes p
                ON m.plan_id = p.id
                AND p.empresa_id = a.empresa_id
            WHERE a.empresa_id = ?
            ORDER BY a.fecha_hora ASC, a.id ASC
        `, [empresaId]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al exportar asistencias'
        });
    }
});

async function actualizarMembresiasVencidas() {
    await pool.query(`
        UPDATE membresias
        SET estado = 'vencida'
        WHERE fecha_fin < CURDATE()
        AND estado = 'activa'
        AND COALESCE(duracion_unidad, 'meses') != 'usos'
    `);

    await pool.query(`
        UPDATE clientes c
        SET c.estado = 'inactivo'
        WHERE NOT EXISTS (
            SELECT 1
            FROM membresias m
            WHERE m.cliente_id = c.id
            AND m.empresa_id = c.empresa_id
            AND m.estado = 'activa'
            AND (
                m.asistencias_totales IS NULL
                OR COALESCE(m.asistencias_usadas, 0) < m.asistencias_totales
            )
        )
    `);
}

function calcularPorcentajeComparacion(actual, anterior) {
    const valorActual = Number(actual) || 0;
    const valorAnterior = Number(anterior);

    if (!valorAnterior) return null;

    return Math.round(((valorActual - valorAnterior) / valorAnterior) * 100);
}


app.get('/api/dashboard', requirePermission('dashboard.ver'), async (req, res) => {
    console.time('dashboard');

    try {
        const empresaId = getEmpresaId(req);

        const [
            [[clientesActivos]],
            [[membresiasActivas]],
            [[porVencer]]
        ] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) AS total
                 FROM clientes
                 WHERE estado = 'activo'
                 AND empresa_id = ?`,
                [empresaId]
            ),
            pool.query(
                `SELECT COUNT(*) AS total
                 FROM membresias
                 WHERE estado = 'activa'
                 AND empresa_id = ?
                 AND (
                    asistencias_totales IS NULL
                    OR COALESCE(asistencias_usadas, 0) < asistencias_totales
                 )`,
                [empresaId]
            ),
            pool.query(
                `SELECT COUNT(*) AS total
                 FROM membresias
                 WHERE estado = 'activa'
                 AND empresa_id = ?
                 AND fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
                [empresaId]
            )
        ]);

        const [[clientesComparacion]] = await pool.query(`
            SELECT
                COALESCE(SUM(CASE
                    WHEN fecha_registro >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    AND fecha_registro < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    THEN 1 ELSE 0
                END), 0) AS actual,
                COALESCE(SUM(CASE
                    WHEN fecha_registro >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    AND fecha_registro < DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    THEN 1 ELSE 0
                END), 0) AS anterior
            FROM clientes
            WHERE empresa_id = ?
        `, [empresaId]);

        const [[membresiasComparacion]] = await pool.query(`
            SELECT
                COALESCE(SUM(CASE
                    WHEN fecha_inicio >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    AND fecha_inicio < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    THEN 1 ELSE 0
                END), 0) AS actual,
                COALESCE(SUM(CASE
                    WHEN fecha_inicio >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    AND fecha_inicio < DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    THEN 1 ELSE 0
                END), 0) AS anterior
            FROM membresias
            WHERE empresa_id = ?
        `, [empresaId]);

        const [[ingresosComparacion]] = await pool.query(`
            SELECT
                COALESCE(SUM(CASE
                    WHEN fecha_inicio >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    AND fecha_inicio < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    THEN precio_total ELSE 0
                END), 0) AS actual,
                COALESCE(SUM(CASE
                    WHEN fecha_inicio >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    AND fecha_inicio < DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    THEN precio_total ELSE 0
                END), 0) AS anterior
            FROM membresias
            WHERE empresa_id = ?
        `, [empresaId]);

        const clientesMesActual = Number(clientesComparacion.actual) || 0;
        const clientesMesAnterior = Number(clientesComparacion.anterior) || 0;
        const membresiasMesActual = Number(membresiasComparacion.actual) || 0;
        const membresiasMesAnterior = Number(membresiasComparacion.anterior) || 0;
        const ingresosMesActual = Number(ingresosComparacion.actual) || 0;
        const ingresosMesAnterior = Number(ingresosComparacion.anterior) || 0;

        const [[totalClientes]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM clientes
            WHERE empresa_id = ?
        `, [empresaId]);

        console.time('vencimientos');

        const [vencimientos] = await pool.query(`
            SELECT
                c.nombre,
                c.correo,
                p.nombre AS plan,
                m.fecha_fin,
                m.estado,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN m.asistencias_totales IS NOT NULL AND COALESCE(m.asistencias_usadas, 0) >= m.asistencias_totales THEN 'sin_asistencias'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual
            FROM membresias m
            INNER JOIN clientes c
                ON m.cliente_id = c.id
                AND c.empresa_id = m.empresa_id
            INNER JOIN planes p
                ON m.plan_id = p.id
                AND p.empresa_id = m.empresa_id
            WHERE m.empresa_id = ?
            AND m.fecha_fin <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            AND COALESCE(m.duracion_unidad, 'meses') != 'usos'
            ORDER BY m.fecha_fin ASC
            LIMIT 5
        `, [empresaId]);

        console.timeEnd('vencimientos');
        console.time('ultimosClientes');

        const [ultimosClientes] = await pool.query(`
            SELECT
                c.nombre,
                c.correo,
                c.estado,
                c.fecha_registro,
                p.nombre AS plan,
                m.fecha_fin,
                m.estado AS estado_membresia,
                COALESCE(m.duracion_unidad, 'meses') AS duracion_unidad,
                m.usos_totales,
                m.usos_restantes,
                m.asistencias_totales,
                COALESCE(m.asistencias_usadas, 0) AS asistencias_usadas,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN m.id IS NULL THEN 'inactiva'
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN m.asistencias_totales IS NOT NULL AND COALESCE(m.asistencias_usadas, 0) >= m.asistencias_totales THEN 'sin_asistencias'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual
            FROM clientes c
            LEFT JOIN membresias m ON m.id = (
                SELECT mm.id
                FROM membresias mm
                WHERE mm.cliente_id = c.id
                AND mm.empresa_id = c.empresa_id
                ORDER BY (mm.estado = 'activa') DESC, mm.fecha_fin DESC, mm.id DESC
                LIMIT 1
            )
            LEFT JOIN planes p
                ON m.plan_id = p.id
                AND p.empresa_id = c.empresa_id
            WHERE c.empresa_id = ?
            ORDER BY c.fecha_registro DESC
            LIMIT 5
        `, [empresaId]);

        console.timeEnd('ultimosClientes');
        console.timeEnd('dashboard');

        res.json({
            clientes_activos: clientesActivos.total,
            membresias_activas: membresiasActivas.total,
            por_vencer: porVencer.total,
            ingresos_mes: ingresosMesActual,

            clientes_mes: clientesMesActual,
            total_clientes: totalClientes.total,

            clientes_mes_actual: clientesMesActual,
            clientes_mes_anterior: clientesMesAnterior,
            membresias_mes_actual: membresiasMesActual,
            membresias_mes_anterior: membresiasMesAnterior,
            ingresos_mes_actual: ingresosMesActual,
            ingresos_mes_anterior: ingresosMesAnterior,

            porcentaje_clientes_mes: calcularPorcentajeComparacion(clientesMesActual, clientesMesAnterior),
            porcentaje_membresias_mes: calcularPorcentajeComparacion(membresiasMesActual, membresiasMesAnterior),
            porcentaje_ingresos_mes: calcularPorcentajeComparacion(ingresosMesActual, ingresosMesAnterior),

            vencimientos,
            ultimos_clientes: ultimosClientes
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al cargar dashboard'
        });
    }
});

app.get('/api/notificaciones', requirePermission('notificaciones.ver'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [rows] = await pool.query(`
            SELECT
                id,
                tipo,
                titulo,
                mensaje,
                entidad,
                entidad_id,
                usuario_id,
                usuario_nombre,
                leida,
                fecha_creacion
            FROM notificaciones
            WHERE empresa_id = ?
            ORDER BY fecha_creacion DESC
            LIMIT 50
        `, [empresaId]);

        const [[contador]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM notificaciones
            WHERE leida = 0
            AND empresa_id = ?
        `, [empresaId]);

        return res.json({
            notificaciones: rows,
            total_no_leidas: contador.total
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al obtener notificaciones'
        });
    }
});

app.put('/api/notificaciones/:id/leida', requirePermission('notificaciones.marcar_leida'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { id } = req.params;

        const [result] = await pool.query(
            `UPDATE notificaciones
             SET leida = 1
             WHERE id = ?
             AND empresa_id = ?`,
            [id, empresaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Notificacion no encontrada'
            });
        }

        return res.json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al marcar notificacion'
        });
    }
});

app.put('/api/notificaciones/leidas', requirePermission('notificaciones.marcar_leida'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        await pool.query(`
            UPDATE notificaciones
            SET leida = 1
            WHERE leida = 0
            AND empresa_id = ?
        `, [empresaId]);

        return res.json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al marcar notificaciones'
        });
    }
});

app.delete('/api/notificaciones/:id', requirePermission('notificaciones.eliminar'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { id } = req.params;

        const [result] = await pool.query(
            `DELETE FROM notificaciones
             WHERE id = ?
             AND empresa_id = ?`,
            [id, empresaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Notificacion no encontrada'
            });
        }

        return res.json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al eliminar notificacion'
        });
    }
});







app.delete('/api/membresias/:id', requirePermission('membresias.eliminar'), async (req, res) => {
    try {
        const { id } = req.params;

        const [[membresia]] = await pool.query(
            `SELECT
                m.cliente_id,
                c.nombre AS cliente
             FROM membresias m
             INNER JOIN clientes c ON c.id = m.cliente_id AND m.empresa_id = c.empresa_id
             WHERE m.id = ? AND m.empresa_id = ?`,
            [id, req.empresaId]
        );

        if (!membresia) {
            return res.status(404).json({
                error: 'Membresía no encontrada'
            });
        }

        const clienteId = membresia.cliente_id;

        await pool.query(
    `UPDATE asistencias
     SET membresia_id = NULL
     WHERE membresia_id = ?
     AND empresa_id = ?`,
    [id, req.empresaId]
);

        await pool.query(
            `DELETE FROM membresias WHERE id = ? AND empresa_id = ?`,
            [id, req.empresaId]
        );

        await crearNotificacion({
            tipo: 'membresia_eliminada',
            titulo: 'Membresia eliminada',
            mensaje: `Se elimino la membresia de ${membresia.cliente}.`,
            entidad: 'membresia',
            entidad_id: id,
            ...adminNotificacion(req)
        });

        const [[activas]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM membresias
     WHERE cliente_id = ?
     AND empresa_id = ?
     AND estado = 'activa'`,
    [clienteId, req.empresaId]
);

        if (activas.total === 0) {
            await pool.query(
    `UPDATE clientes
     SET estado = 'inactivo'
     WHERE id = ?
     AND empresa_id = ?`,
    [clienteId, req.empresaId]
);
        }

        res.json({
            mensaje: 'Membresía eliminada correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al eliminar membresía'
        });
    }
});

app.put('/api/clientes/:id/desactivar', requirePermission('clientes.eliminar'), async (req, res) => {
    try {
        const { id } = req.params;

        const [[cliente]] = await pool.query(
            `SELECT nombre
             FROM clientes
             WHERE id = ?
             AND empresa_id = ?
             LIMIT 1`,
            [id, req.empresaId]
        );

        if (!cliente) {
            return res.status(404).json({
                error: 'Cliente no encontrado'
            });
        }

        await pool.query(
            `UPDATE clientes
             SET estado = 'inactivo'
             WHERE id = ?
             AND empresa_id = ?`,
            [id, req.empresaId]
        );

        await pool.query(
            `UPDATE membresias
             SET estado = 'vencida'
             WHERE cliente_id = ?
             AND empresa_id = ?
             AND estado = 'activa'`,
            [id, req.empresaId]
        );

        await crearNotificacion({
            tipo: 'cliente_eliminado',
            titulo: 'Cliente eliminado',
            mensaje: `Se elimino o desactivo a ${cliente.nombre}.`,
            entidad: 'cliente',
            entidad_id: id,
            ...adminNotificacion(req)
        });

        res.json({
            mensaje: 'Cliente desactivado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al desactivar cliente'
        });
    }
});

app.get('/api/sidebar', requireAdminSession, async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [[clientes]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM clientes
            WHERE empresa_id = ?
        `, [empresaId]);

        const [[membresias]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM membresias
            WHERE empresa_id = ?
            AND estado = 'activa'
            AND (
                asistencias_totales IS NULL
                OR COALESCE(asistencias_usadas, 0) < asistencias_totales
            )
        `, [empresaId]);

        const [[porVencer]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM membresias
            WHERE empresa_id = ?
            AND estado = 'activa'
            AND COALESCE(duracion_unidad, 'meses') != 'usos'
            AND fecha_fin BETWEEN CURDATE()
            AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        `, [empresaId]);

        res.json({
            clientes: clientes.total,
            membresias: membresias.total,
            por_vencer: porVencer.total
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener sidebar'
        });
    }
});

async function sincronizarEstadosClientes() {
    await pool.query(`
        UPDATE clientes c
        SET c.estado = 'activo'
        WHERE EXISTS (
            SELECT 1
            FROM membresias m
            WHERE m.cliente_id = c.id
            AND m.empresa_id = c.empresa_id
            AND m.estado = 'activa'
            AND (
                m.asistencias_totales IS NULL
                OR COALESCE(m.asistencias_usadas, 0) < m.asistencias_totales
            )
        )
    `);

    await pool.query(`
        UPDATE clientes c
        SET c.estado = 'inactivo'
        WHERE NOT EXISTS (
            SELECT 1
            FROM membresias m
            WHERE m.cliente_id = c.id
            AND m.empresa_id = c.empresa_id
            AND m.estado = 'activa'
            AND (
                m.asistencias_totales IS NULL
                OR COALESCE(m.asistencias_usadas, 0) < m.asistencias_totales
            )
        )
    `);
}

app.get('/api/planes/todos', requirePermission('planes.ver'), async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

const [rows] = await pool.query(`
            SELECT
                id,
                nombre,
                precio_mensual,
                precio_mensual AS precio,
                tipo,
                descripcion,
                estado,
                COALESCE(duracion_valor, 1) AS duracion_valor,
                COALESCE(duracion_unidad, 'meses') AS duracion_unidad,
                asistencias_incluidas,
                COALESCE(es_ilimitado, 0) AS es_ilimitado,
                color_precio
            FROM planes
            WHERE empresa_id = ?
            ORDER BY id ASC
        `, [empresaId]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener planes'
        });
    }
});

app.post('/api/planes', requirePermission('planes.crear'), async (req, res) => {
    try {
        const datos = obtenerDatosPlan(req.body);
        const errorValidacion = validarDatosPlan(datos);

        if (errorValidacion) {
            return res.status(400).json({ error: errorValidacion });
        }

        const [result] = await pool.query(
            `INSERT INTO planes (empresa_id, nombre, precio_mensual, tipo, descripcion, estado, duracion_valor, duracion_unidad, asistencias_incluidas, es_ilimitado, color_precio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.empresaId,
                datos.nombre,
                datos.precio,
                datos.tipo,
                datos.descripcion,
                datos.estado,
                datos.duracion_valor,
                datos.duracion_unidad,
                datos.asistencias_incluidas,
                datos.es_ilimitado ? 1 : 0,
                datos.color_precio
            ]
        );

        await crearNotificacion({
    tipo: 'plan_creado',
    titulo: 'Plan creado',
    mensaje: `Se creó el plan ${datos.nombre}.`,
    entidad: 'plan',
    entidad_id: result.insertId,
    ...adminNotificacion(req),
    evento_key: `plan-creado-${result.insertId}`
});

        res.json({
            id: result.insertId,
            mensaje: 'Plan creado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al crear plan'
        });
    }
});

app.put('/api/planes/:id', requirePermission('planes.editar'), async (req, res) => {
    try {
        const { id } = req.params;
        const datos = obtenerDatosPlan(req.body);
        const errorValidacion = validarDatosPlan(datos);

        if (errorValidacion) {
            return res.status(400).json({ error: errorValidacion });
        }

        await pool.query(
            `UPDATE planes
             SET nombre = ?, precio_mensual = ?, descripcion = ?, estado = ?, duracion_valor = ?, duracion_unidad = ?, asistencias_incluidas = ?, es_ilimitado = ?, color_precio = ?
             WHERE id = ? AND empresa_id = ?`,
            [
                datos.nombre,
                datos.precio,
                datos.descripcion,
                datos.estado,
                datos.duracion_valor,
                datos.duracion_unidad,
                datos.asistencias_incluidas,
                datos.es_ilimitado ? 1 : 0,
                datos.color_precio,
                id,
                req.empresaId
            ]
        );

        res.json({
            mensaje: 'Plan actualizado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al actualizar plan'
        });
    }
});

app.put('/api/planes/:id/desactivar', requirePermission('planes.eliminar'), async (req, res) => {
    try {
        const { id } = req.params;

        const [[plan]] = await pool.query(
            `SELECT nombre
             FROM planes
             WHERE id = ? AND empresa_id = ?`,
            [id, req.empresaId]
        );

        if (!plan) {
            return res.status(404).json({
                error: 'Plan no encontrado'
            });
        }

        const [result] = await pool.query(
            `UPDATE planes
             SET estado = 'inactivo'
             WHERE id = ? AND empresa_id = ?`,
            [id, req.empresaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Plan no encontrado'
            });
        }

        res.json({
            mensaje: 'Plan desactivado correctamente'
        });

        await crearNotificacion({
    tipo: 'plan_eliminado',
    titulo: 'Plan eliminado',
    mensaje: `Se eliminó o desactivó el plan ${plan.nombre}.`,
    entidad: 'plan',
    entidad_id: id,
    ...adminNotificacion(req),
    evento_key: `plan-eliminado-${id}-${Date.now()}`
});

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al desactivar plan'
        });
    }
});

app.delete('/api/planes/:id', requirePermission('planes.eliminar'), async (req, res) => {
    try {
        const { id } = req.params;

        const [[plan]] = await pool.query(
            `SELECT nombre
             FROM planes
             WHERE id = ? AND empresa_id = ?`,
            [id, req.empresaId]
        );

        if (!plan) {
            return res.status(404).json({
                error: 'Plan no encontrado'
            });
        }

        const [[uso]] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM membresias
             WHERE plan_id = ? AND empresa_id = ?`,
            [id, req.empresaId]
        );

        if (Number(uso.total) > 0) {
            return res.status(409).json({
                error: 'No se puede borrar este plan porque tiene membresias asociadas. Puedes desactivarlo para conservar el historial.'
            });
        }

        await pool.query(
            `DELETE FROM planes
             WHERE id = ? AND empresa_id = ?`,
            [id, req.empresaId]
        );

        res.json({
            mensaje: 'Plan borrado correctamente'
        });

        await crearNotificacion({
            tipo: 'plan_eliminado',
            titulo: 'Plan eliminado',
            mensaje: `Se elimino el plan ${plan.nombre}.`,
            entidad: 'plan',
            entidad_id: id,
            ...adminNotificacion(req),
            evento_key: `plan-borrado-${id}-${Date.now()}`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al borrar plan'
        });
    }
});

app.get('/api/test', (req, res) => {
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    try {
        await asegurarColumnasPlanes();
        await asegurarTablasClientePerfil();
        await asegurarPermisosBase();
    } catch (error) {
        console.error('Error verificando estructura inicial:', error);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}

iniciarServidor();
