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

function requireAdminSession(req, res, next) {
    if (req.session && req.session.admin && req.session.adminId) {
        return next();
    }

    if (req.originalUrl.startsWith('/admin')) {
        return res.redirect('/admin/login.html');
    }

    return res.status(401).json({
        ok: false,
        error: 'Sesion no activa'
    });
}

function getSessionAdmin(req) {
    return {
        id: req.session.adminId,
        nombre: req.session.adminNombre,
        usuario: req.session.adminUsuario
    };
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

        const usuarioLimpio = String(usuario).trim();
        const nombreLimpio = String(nombre || 'Recepción').trim();
        const passwordHash = await generarHashPassword(password);

        const [result] = await pool.query(
            `INSERT INTO usuarios_admin (usuario, password_hash, nombre, estado)
             VALUES (?, ?, ?, 'activo')`,
            [usuarioLimpio, passwordHash, nombreLimpio]
        );

        return res.json({
            ok: true,
            admin: {
                id: result.insertId,
                usuario: usuarioLimpio,
                nombre: nombreLimpio
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
            `SELECT id, usuario, password_hash, nombre, estado
             FROM usuarios_admin
             WHERE usuario = ?
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

        req.session.admin = true;
        req.session.adminId = admin.id;
        req.session.adminNombre = admin.nombre;
        req.session.adminUsuario = admin.usuario;
        req.session.loginAt = new Date().toISOString();

        return res.json({
            ok: true,
            admin: {
                id: admin.id,
                nombre: admin.nombre,
                usuario: admin.usuario
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

app.post('/api/logout', (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                ok: false,
                error: 'Error al cerrar sesiÃ³n'
            });
        }

        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

app.get('/api/verificar-sesion', (req, res) => {
    if (!req.session || !req.session.admin) {
        return res.json({
            logueado: false
        });
    }

    return res.json({
        logueado: true,
        admin: {
            id: req.session.adminId,
            nombre: req.session.adminNombre,
            usuario: req.session.adminUsuario
        }
    });
});

app.get('/api/auth/session', (req, res) => {
    if (!req.session || !req.session.admin || !req.session.adminId) {
        return res.status(401).json({
            ok: false,
            error: 'Sesion no activa'
        });
    }

    return res.json({
        ok: true,
        admin: getSessionAdmin(req)
    });
});

app.use('/api', requireAdminSession);

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
            AND COLUMN_NAME IN ('fecha_creacion', 'created_at', 'ultimo_acceso', 'last_login', 'rol')
        `);

        const columnas = new Set(columns.map(col => col.COLUMN_NAME));
        const fechaCreacion = columnas.has('fecha_creacion')
            ? 'fecha_creacion'
            : columnas.has('created_at')
                ? 'created_at AS fecha_creacion'
                : 'NULL AS fecha_creacion';
        const ultimoAcceso = columnas.has('ultimo_acceso')
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
                usuario,
                nombre,
                estado,
                ${fechaCreacion},
                ${ultimoAcceso},
                ${rol}
             FROM usuarios_admin
             WHERE id = ?
             LIMIT 1`,
            [req.session.adminId]
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
            usuario: admin.usuario,
            nombre: admin.nombre,
            estado: admin.estado,
            fecha_creacion: admin.fecha_creacion,
            ultimo_acceso: admin.ultimo_acceso,
            sesion_iniciada: req.session.loginAt || null,
            rol: admin.rol || (admin.id === 1 ? 'Administrador' : 'Recepción')
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: 'Error al cargar perfil'
        });
    }
});

app.put('/api/admin/cambiar-password', async (req, res) => {
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

        const [rows] = await pool.query(
            `SELECT id, password_hash, estado
             FROM usuarios_admin
             WHERE id = ?
             LIMIT 1`,
            [req.session.adminId]
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
             WHERE id = ?`,
            [nuevoHash, admin.id]
        );

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
});

app.get('/admin/login.html', (req, res) => {
    res.sendFile(path.join(adminDir, 'login.html'));
});

app.get(['/admin', '/admin/'], requireAdminSession, (req, res) => {
    res.redirect('/admin/dashboard.html');
});

app.use('/admin/styles', express.static(path.join(adminDir, 'styles')));

app.get('/admin/:page', requireAdminSession, (req, res, next) => {
    const { page } = req.params;

    if (!privateAdminPages.has(page)) {
        return next();
    }

    return res.sendFile(path.join(adminDir, page));
});

app.use('/assets', express.static(adminAssetsDir));

app.use(express.static(publicDir));

// GET CLIENTES
app.get('/api/clientes', async (req, res) => {
    try {
        //await sincronizarEstadosClientes();
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
                ORDER BY (mm.estado = 'activa') DESC, mm.fecha_fin DESC, mm.id DESC
                LIMIT 1
            )
            ORDER BY c.id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error del servidor'
        });
    }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { nombre, dni, telefono, correo, estado } = req.body;

        const [existente] = await pool.query(
            'SELECT * FROM clientes WHERE dni = ?',
            [dni]
        );

        if (existente.length > 0) {
            const cliente = existente[0];

            await pool.query(
                `UPDATE clientes
                 SET nombre = ?, telefono = ?, correo = ?, estado = ?
                 WHERE id = ?`,
                [nombre, telefono, correo, estado || 'activo', cliente.id]
            );

            return res.json({
                id: cliente.id,
                actualizado: true
            });
        }

        const [result] = await pool.query(
            `INSERT INTO clientes (nombre, dni, telefono, correo, estado)
             VALUES (?, ?, ?, ?, ?)`,
            [nombre, dni, telefono, correo, estado || 'activo']
        );

        res.json({
            id: result.insertId,
            creado: true
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar cliente' });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, dni, telefono, correo, estado } = req.body;

        const [duplicado] = await pool.query(
            'SELECT id FROM clientes WHERE dni = ? AND id != ?',
            [dni, id]
        );

        if (duplicado.length > 0) {
            return res.status(400).json({
                error: 'Ya existe otro cliente con ese DNI'
            });
        }

        await pool.query(
            `UPDATE clientes
             SET nombre = ?, dni = ?, telefono = ?, correo = ?
             WHERE id = ?`,
            [nombre, dni, telefono, correo, id]
        );

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

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM clientes WHERE id = ?', [id]);

        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});

async function generarCodigoUnico(conn = pool) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo;
    let existe = true;

    while (existe) {
        codigo = 'PFS-';
        for (let i = 0; i < 6; i++) {
            codigo += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const [rows] = await conn.query(
            'SELECT id FROM membresias WHERE codigo = ?',
            [codigo]
        );

        existe = rows.length > 0;
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

function estadoVisualMembresia(estado, diasRestantes, unidad = 'meses', usosRestantes = null) {
    if (normalizarDuracionUnidad(unidad) === 'usos') {
        if (estado === 'activa' && Number(usosRestantes) > 0) return 'activa';
        return 'vencida';
    }

    if (estado === 'vencida' || diasRestantes < 0) return 'vencida';
    if (diasRestantes === 0) return 'vence_hoy';
    if (diasRestantes === 1) return 'vence_manana';
    if (diasRestantes === 3) return 'vence_3_dias';
    if (estado === 'activa') return 'activa';
    return 'inactiva';
}

async function desactivarClienteSiSinMembresiaActiva(clienteId, membresiaId, conn = pool) {
    await conn.query(
        `UPDATE clientes
         SET estado = 'inactivo'
         WHERE id = ?
         AND NOT EXISTS (
            SELECT 1
            FROM membresias m
            WHERE m.cliente_id = clientes.id
            AND m.estado = 'activa'
            AND m.id != ?
            AND (
                COALESCE(m.duracion_unidad, 'meses') != 'usos'
                OR COALESCE(m.usos_restantes, 0) > 0
            )
         )`,
        [clienteId, membresiaId]
    );
}

async function validarMembresiaYRegistrar(membresia) {
    const unidad = normalizarDuracionUnidad(membresia.duracion_unidad);

    if (unidad === 'usos') {
        const usosRestantes = Number(membresia.usos_restantes || 0);

        if (membresia.estado_membresia !== 'activa' || usosRestantes <= 0) {
            await pool.query(
                `UPDATE membresias
                 SET estado = 'vencida'
                 WHERE id = ?`,
                [membresia.membresia_id]
            );

            await desactivarClienteSiSinMembresiaActiva(membresia.cliente_id, membresia.membresia_id);

            await pool.query(
                `INSERT INTO asistencias
                (cliente_id, membresia_id, codigo_usado, estado, motivo)
                VALUES (?, ?, ?, 'denegado', 'Membresia consumida')`,
                [
                    membresia.cliente_id,
                    membresia.membresia_id,
                    membresia.codigo
                ]
            );

            return {
                valido: false,
                estado: 'vencida',
                mensaje: 'Membresia consumida',
                cliente: membresia.cliente,
                dni: membresia.dni,
                plan: membresia.plan,
                plan_nombre: membresia.plan,
                codigo: membresia.codigo,
                promocion: membresia.promocion,
                descuento_porcentaje: extraerDescuentoPorcentaje(membresia.promocion),
                duracion_unidad: unidad,
                meses: membresia.meses,
                usos_totales: membresia.usos_totales,
                usos_restantes: 0,
                estado_visual: 'vencida'
            };
        }

        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [actualizacion] = await conn.query(
                `UPDATE membresias
                 SET usos_restantes = GREATEST(COALESCE(usos_restantes, 0) - 1, 0)
                 WHERE id = ?
                 AND estado = 'activa'
                 AND COALESCE(usos_restantes, 0) > 0`,
                [membresia.membresia_id]
            );

            if (actualizacion.affectedRows === 0) {
                await conn.rollback();
                return validarMembresiaYRegistrar({
                    ...membresia,
                    usos_restantes: 0
                });
            }

            const [[actualizada]] = await conn.query(
                `SELECT usos_restantes
                 FROM membresias
                 WHERE id = ?`,
                [membresia.membresia_id]
            );

            const usosRestantesFinal = Number(actualizada.usos_restantes || 0);
            const consumida = usosRestantesFinal <= 0;

            await conn.query(
                `INSERT INTO asistencias
                (cliente_id, membresia_id, codigo_usado, estado, motivo)
                VALUES (?, ?, ?, 'permitido', ?)`,
                [
                    membresia.cliente_id,
                    membresia.membresia_id,
                    membresia.codigo,
                    consumida ? 'Ingreso permitido - membresia consumida' : 'Ingreso permitido'
                ]
            );

            if (consumida) {
                await conn.query(
                    `UPDATE membresias
                     SET estado = 'vencida'
                     WHERE id = ?`,
                    [membresia.membresia_id]
                );

                await desactivarClienteSiSinMembresiaActiva(membresia.cliente_id, membresia.membresia_id, conn);
            }

            await conn.commit();

            return {
                valido: true,
                estado: consumida ? 'vencida' : 'activa',
                mensaje: 'Ingreso permitido',
                mensaje_secundario: consumida ? 'Membresia consumida' : `Usos restantes: ${usosRestantesFinal}`,
                cliente: membresia.cliente,
                dni: membresia.dni,
                plan: membresia.plan,
                plan_nombre: membresia.plan,
                codigo: membresia.codigo,
                promocion: membresia.promocion,
                descuento_porcentaje: extraerDescuentoPorcentaje(membresia.promocion),
                duracion_unidad: unidad,
                meses: membresia.meses,
                usos_totales: membresia.usos_totales,
                usos_restantes: usosRestantesFinal,
                estado_visual: consumida ? 'vencida' : 'activa'
            };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    const diasRestantes = calcularDiasRestantes(membresia.fecha_fin);
    const estadoVisual = estadoVisualMembresia(membresia.estado_membresia, diasRestantes, unidad);

    if (membresia.estado_membresia !== 'activa' || diasRestantes < 0) {
        await pool.query(
            `UPDATE membresias
             SET estado = 'vencida'
             WHERE id = ?`,
            [membresia.membresia_id]
        );

        await desactivarClienteSiSinMembresiaActiva(membresia.cliente_id, membresia.membresia_id);

        await pool.query(
            `INSERT INTO asistencias
            (cliente_id, membresia_id, codigo_usado, estado, motivo)
            VALUES (?, ?, ?, 'denegado', 'Membresía vencida')`,
            [
                membresia.cliente_id,
                membresia.membresia_id,
                membresia.codigo
            ]
        );

        return {
            valido: false,
            estado: 'vencida',
            mensaje: 'Membresía vencida',
            cliente: membresia.cliente,
            dni: membresia.dni,
            plan: membresia.plan,
            plan_nombre: membresia.plan,
            codigo: membresia.codigo,
            fecha_fin: membresia.fecha_fin,
            promocion: membresia.promocion,
            descuento_porcentaje: extraerDescuentoPorcentaje(membresia.promocion),
            duracion_unidad: unidad,
            meses: membresia.meses,
            dias_restantes: diasRestantes,
            estado_visual: 'vencida',
            dias_vencido: Math.abs(diasRestantes)
        };
    }

    await pool.query(
        `INSERT INTO asistencias
        (cliente_id, membresia_id, codigo_usado, estado, motivo)
        VALUES (?, ?, ?, 'permitido', 'Ingreso permitido')`,
        [
            membresia.cliente_id,
            membresia.membresia_id,
            membresia.codigo
        ]
    );

    return {
        valido: true,
        estado: 'activa',
        mensaje: 'Membresía activa',
        cliente: membresia.cliente,
        dni: membresia.dni,
        plan: membresia.plan,
        plan_nombre: membresia.plan,
        codigo: membresia.codigo,
        fecha_inicio: membresia.fecha_inicio,
        fecha_fin: membresia.fecha_fin,
        promocion: membresia.promocion,
        descuento_porcentaje: extraerDescuentoPorcentaje(membresia.promocion),
        duracion_unidad: unidad,
        meses: membresia.meses,
        dias_restantes: diasRestantes,
        estado_visual: estadoVisual
    };
}

async function obtenerMembresiasPorCodigo(codigo) {
    const [rows] = await pool.query(`
        SELECT
            m.id AS membresia_id,
            m.codigo,
            m.meses,
            m.fecha_inicio,
            m.fecha_fin,
            m.estado AS estado_membresia,
            m.promocion,
            COALESCE(m.duracion_unidad, 'meses') AS duracion_unidad,
            m.usos_totales,
            m.usos_restantes,
            DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
            CASE
                WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' AND m.estado = 'activa' AND COALESCE(m.usos_restantes, 0) > 0 THEN 'activa'
                WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' THEN 'vencida'
                WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                WHEN m.estado = 'activa' THEN 'activa'
                ELSE 'inactiva'
            END AS estado_visual,
            c.id AS cliente_id,
            c.nombre AS cliente,
            c.dni,
            c.estado AS estado_cliente,
            p.nombre AS plan
        FROM membresias m
        INNER JOIN clientes c ON m.cliente_id = c.id
        INNER JOIN planes p ON m.plan_id = p.id
        WHERE m.codigo = ?
        ORDER BY m.id ASC
    `, [codigo]);

    return rows;
}

app.get('/api/membresias', async (req, res) => {
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
                m.precio_total,
                m.promocion,
                m.fecha_inicio,
                m.fecha_fin,
                m.estado,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual
            FROM membresias m
            INNER JOIN clientes c ON m.cliente_id = c.id
            INNER JOIN planes p ON m.plan_id = p.id
            ORDER BY m.id DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener membresías'
        });
    }
});

app.post('/api/membresias', async (req, res) => {
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

        const unidad = normalizarDuracionUnidad(duracion_unidad);
        const cantidad = normalizarDuracionValor(meses);
        const mesesGuardados = mesesCompatibles(cantidad, unidad);
        const fechaFinFinal = fecha_fin || calcularFechaFin(fecha_inicio, cantidad, unidad);
        const usosTotalesFinal = unidad === 'usos'
            ? normalizarDuracionValor(usos_totales ?? cantidad)
            : null;
        const usosRestantesFinal = unidad === 'usos'
            ? normalizarDuracionValor(usos_restantes ?? usosTotalesFinal)
            : null;

        const codigo = await generarCodigoUnico();

        const [membresiaExistente] = await pool.query(
    'SELECT * FROM membresias WHERE cliente_id = ?',
    [cliente_id]
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
             estado = 'activa',
             origen = ?
         WHERE id = ?`,
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
            origen || 'presencial',
            membresia.id
        ]
    );

    await pool.query(
        `UPDATE clientes
         SET estado = 'activo'
         WHERE id = ?`,
        [cliente_id]
    );

    return res.json({
        id: membresia.id,
        codigo,
        actualizado: true
    });
}

        const [result] = await pool.query(
            `INSERT INTO membresias
            (cliente_id, plan_id, codigo, meses, precio_total, promocion, fecha_inicio, fecha_fin, duracion_unidad, usos_totales, usos_restantes, estado, origen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?)`,
            [
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
                origen || 'presencial'
            ]
        );
        await pool.query(
    `UPDATE clientes
     SET estado = 'activo'
     WHERE id = ?`,
    [cliente_id]
);

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

app.post('/api/membresias/grupal', async (req, res) => {
    const conn = await pool.getConnection();

    try {
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
                error: 'Plan, fechas y personas son obligatorios'
            });
        }

        if (promocion_etiqueta === 'Promoción 2x1' && personas.length > 2) {
            return res.status(400).json({
                error: 'La promoción 2x1 permite máximo 2 personas'
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

        await conn.beginTransaction();

        const unidad = normalizarDuracionUnidad(duracion_unidad);
        const cantidad = normalizarDuracionValor(meses);
        const mesesGuardados = mesesCompatibles(cantidad, unidad);
        const fechaFinFinal = fecha_fin || calcularFechaFin(fecha_inicio, cantidad, unidad);
        const usosTotalesFinal = unidad === 'usos'
            ? normalizarDuracionValor(usos_totales ?? cantidad)
            : null;
        const usosRestantesFinal = unidad === 'usos'
            ? normalizarDuracionValor(usos_restantes ?? usosTotalesFinal)
            : null;

        const codigo = await generarCodigoUnico(conn);
        const membresiasCreadas = [];

        for (let i = 0; i < personas.length; i++) {
            const persona = personas[i];
            let clienteId = persona.cliente_id || null;

            if (clienteId) {
                const [[cliente]] = await conn.query(
                    'SELECT id FROM clientes WHERE id = ?',
                    [clienteId]
                );

                if (!cliente) {
                    throw new Error('Cliente existente no encontrado');
                }
            } else {
                const nombre = String(persona.nombre || '').trim();
                const dni = String(persona.dni || '').trim();
                const telefono = String(persona.telefono || '').trim();
                const correo = String(persona.correo || '').trim();

                if (!nombre || !dni) {
                    throw new Error('Nombre y DNI son obligatorios para clientes nuevos');
                }

                const [existente] = await conn.query(
                    'SELECT id FROM clientes WHERE dni = ?',
                    [dni]
                );

                if (existente.length > 0) {
                    throw new Error('El DNI ya existe. Usa cliente existente para esa persona.');
                }

                const [clienteCreado] = await conn.query(
                    `INSERT INTO clientes (nombre, dni, telefono, correo, estado)
                     VALUES (?, ?, ?, ?, 'activo')`,
                    [nombre, dni, telefono, correo]
                );

                clienteId = clienteCreado.insertId;
            }

            const precioRegistro = i === 0 ? Number(precio_total || 0) : 0;

            const [membresiaCreada] = await conn.query(
                `INSERT INTO membresias
                (cliente_id, plan_id, codigo, meses, precio_total, promocion, fecha_inicio, fecha_fin, duracion_unidad, usos_totales, usos_restantes, estado, origen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?)`,
                [
                    clienteId,
                    plan_id,
                    codigo,
                    mesesGuardados,
                    precioRegistro,
                    promocion_etiqueta || null,
                    fecha_inicio,
                    fechaFinFinal,
                    unidad,
                    usosTotalesFinal,
                    usosRestantesFinal,
                    origen || 'presencial'
                ]
            );

            await conn.query(
                `UPDATE clientes
                 SET estado = 'activo'
                 WHERE id = ?`,
                [clienteId]
            );

            membresiasCreadas.push({
                id: membresiaCreada.insertId,
                cliente_id: clienteId,
                precio_total: precioRegistro
            });
        }

        await conn.commit();

        res.json({
            codigo,
            membresias: membresiasCreadas,
            promocion: promocion_etiqueta || null
        });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({
            error: error.message || 'Error al crear membresía grupal'
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

    return { nombre, precio, descripcion, estado, tipo, duracion_valor, duracion_unidad };
}

function validarDatosPlan(datos) {
    if (!datos.nombre || datos.precio === '' || Number.isNaN(Number(datos.precio))) {
        return 'Nombre y precio son obligatorios';
    }

    return null;
}

app.get('/api/planes', async (req, res) => {
    try {
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
                COALESCE(duracion_unidad, 'meses') AS duracion_unidad
            FROM planes
            WHERE estado = 'activo'
            ORDER BY id ASC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener planes'
        });
    }
});

app.get('/api/validar/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const rows = await obtenerMembresiasPorCodigo(codigo);

        if (rows.length === 0) {
            await pool.query(
                `INSERT INTO asistencias
                (cliente_id, membresia_id, codigo_usado, estado, motivo)
                VALUES (NULL, NULL, ?, 'denegado', 'Código inexistente')`,
                [codigo]
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
                    dias_restantes: r.dias_restantes,
                    estado_visual: r.estado_visual,
                    promocion: r.promocion
                }))
            });
        }

        return res.json(await validarMembresiaYRegistrar(rows[0]));

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al validar código'
        });
    }
});

app.post('/api/validar', async (req, res) => {
    try {
        const { codigo, membresia_id } = req.body;

        if (!codigo || !membresia_id) {
            return res.status(400).json({
                error: 'Código y membresía son obligatorios'
            });
        }

        const membresias = await obtenerMembresiasPorCodigo(codigo);
        const membresia = membresias.find(m => String(m.membresia_id) === String(membresia_id));

        if (!membresia) {
            return res.status(404).json({
                valido: false,
                estado: 'inexistente',
                mensaje: 'Membresía no encontrada para este código'
            });
        }

        return res.json(await validarMembresiaYRegistrar(membresia));

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al validar membresía'
        });
    }
});

app.get('/api/validar-legacy/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;

        const [rows] = await pool.query(`
            SELECT
                m.id AS membresia_id,
                m.codigo,
                m.fecha_inicio,
                m.fecha_fin,
                m.estado AS estado_membresia,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual,
                c.id AS cliente_id,
                c.nombre AS cliente,
                c.dni,
                c.estado AS estado_cliente,
                p.nombre AS plan
            FROM membresias m
            INNER JOIN clientes c ON m.cliente_id = c.id
            INNER JOIN planes p ON m.plan_id = p.id
            WHERE m.codigo = ?
            LIMIT 1
        `, [codigo]);

        if (rows.length === 0) {
            await pool.query(
                `INSERT INTO asistencias
                (cliente_id, membresia_id, codigo_usado, estado, motivo)
                VALUES (NULL, NULL, ?, 'denegado', 'Código inexistente')`,
                [codigo]
            );

            return res.status(404).json({
                valido: false,
                estado: 'inexistente',
                mensaje: 'Código no existe o fue reemplazado'
            });
        }

        const membresia = rows[0];

        const hoy = new Date();
        const fechaFin = new Date(membresia.fecha_fin);

        hoy.setHours(0, 0, 0, 0);
        fechaFin.setHours(0, 0, 0, 0);

        const diffMs = fechaFin - hoy;
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (membresia.estado_membresia !== 'activa' || diasRestantes < 0) {
            await pool.query(
                `UPDATE membresias
                 SET estado = 'vencida'
                 WHERE id = ?`,
                [membresia.membresia_id]
            );

            await pool.query(
                `UPDATE clientes
                 SET estado = 'inactivo'
                 WHERE id = ?`,
                [membresia.cliente_id]
            );

            await pool.query(
                `INSERT INTO asistencias
                (cliente_id, membresia_id, codigo_usado, estado, motivo)
                VALUES (?, ?, ?, 'denegado', 'Membresía vencida')`,
                [
                    membresia.cliente_id,
                    membresia.membresia_id,
                    membresia.codigo
                ]
            );

            return res.json({
                valido: false,
                estado: 'vencida',
                mensaje: 'Membresía vencida',
                cliente: membresia.cliente,
                plan: membresia.plan,
                codigo: membresia.codigo,
                fecha_fin: membresia.fecha_fin,
                dias_restantes: diasRestantes,
                estado_visual: 'vencida',
                dias_vencido: Math.abs(diasRestantes)
            });
        }

        await pool.query(
            `INSERT INTO asistencias
            (cliente_id, membresia_id, codigo_usado, estado, motivo)
            VALUES (?, ?, ?, 'permitido', 'Ingreso permitido')`,
            [
                membresia.cliente_id,
                membresia.membresia_id,
                membresia.codigo
            ]
        );

        return res.json({
            valido: true,
            estado: 'activa',
            mensaje: 'Membresía activa',
            cliente: membresia.cliente,
            plan: membresia.plan,
            codigo: membresia.codigo,
            fecha_inicio: membresia.fecha_inicio,
            fecha_fin: membresia.fecha_fin,
            dias_restantes: diasRestantes,
            estado_visual: estadoVisualMembresia(membresia.estado_membresia, diasRestantes)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al validar código'
        });
    }
});

app.get('/api/asistencias', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                a.id,
                a.codigo_usado,
                a.estado,
                a.motivo,
                a.fecha_hora,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan
            FROM asistencias a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN membresias m ON a.membresia_id = m.id
            LEFT JOIN planes p ON m.plan_id = p.id
            ORDER BY a.fecha_hora DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener asistencias'
        });
    }
});

app.get('/api/asistencias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT
                a.id,
                a.codigo_usado,
                a.estado,
                a.motivo,
                a.fecha_hora,
                a.membresia_id,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan
            FROM asistencias a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN membresias m ON a.membresia_id = m.id
            LEFT JOIN planes p ON m.plan_id = p.id
            WHERE a.id = ?
            LIMIT 1
        `, [id]);

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

app.delete('/api/asistencias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT id FROM asistencias WHERE id = ? LIMIT 1',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Asistencia no encontrada'
            });
        }

        await pool.query(
            'DELETE FROM asistencias WHERE id = ?',
            [id]
        );

        return res.json({
            mensaje: 'Asistencia eliminada correctamente'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al eliminar asistencia'
        });
    }
});

app.get('/api/exportar/clientes', async (req, res) => {
    try {
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
            ORDER BY id ASC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al exportar clientes'
        });
    }
});

app.get('/api/exportar/membresias', async (req, res) => {
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
                m.precio_total,
                m.promocion,
                m.fecha_inicio,
                m.fecha_fin,
                m.estado
            FROM membresias m
            LEFT JOIN clientes c ON m.cliente_id = c.id
            LEFT JOIN planes p ON m.plan_id = p.id
            ORDER BY m.id ASC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al exportar membresias'
        });
    }
});

app.get('/api/exportar/asistencias', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                a.id,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan,
                a.codigo_usado,
                a.estado,
                a.motivo,
                a.fecha_hora
            FROM asistencias a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN membresias m ON a.membresia_id = m.id
            LEFT JOIN planes p ON m.plan_id = p.id
            ORDER BY a.fecha_hora ASC, a.id ASC
        `);

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
        UPDATE membresias
        SET estado = 'vencida'
        WHERE estado = 'activa'
        AND COALESCE(duracion_unidad, 'meses') = 'usos'
        AND COALESCE(usos_restantes, 0) <= 0
    `);

    await pool.query(`
        UPDATE clientes c
        SET c.estado = 'inactivo'
        WHERE NOT EXISTS (
            SELECT 1
            FROM membresias m
            WHERE m.cliente_id = c.id
            AND m.estado = 'activa'
            AND (
                COALESCE(m.duracion_unidad, 'meses') != 'usos'
                OR COALESCE(m.usos_restantes, 0) > 0
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


app.get('/api/dashboard', async (req, res) => {
    console.time('dashboard');
    try {
        //await actualizarMembresiasVencidas();
        //await sincronizarEstadosClientes();

        const [
  [[clientesActivos]],
  [[membresiasActivas]],
  [[porVencer]]
] = await Promise.all([
  pool.query(`SELECT COUNT(*) AS total FROM clientes WHERE estado='activo'`),
  pool.query(`SELECT COUNT(*) AS total FROM membresias WHERE estado='activa'`),
  pool.query(`SELECT COUNT(*) AS total FROM membresias WHERE estado='activa' AND fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`)
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
        `);

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
        `);

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
        `);

        const clientesMesActual = Number(clientesComparacion.actual) || 0;
        const clientesMesAnterior = Number(clientesComparacion.anterior) || 0;
        const membresiasMesActual = Number(membresiasComparacion.actual) || 0;
        const membresiasMesAnterior = Number(membresiasComparacion.anterior) || 0;
        const ingresosMesActual = Number(ingresosComparacion.actual) || 0;
        const ingresosMesAnterior = Number(ingresosComparacion.anterior) || 0;

        const [[totalClientes]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM clientes
        `);
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
                    WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' AND m.estado = 'activa' AND COALESCE(m.usos_restantes, 0) > 0 THEN 'activa'
                    WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' THEN 'vencida'
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual
            FROM membresias m
            INNER JOIN clientes c ON m.cliente_id = c.id
            INNER JOIN planes p ON m.plan_id = p.id
            WHERE m.fecha_fin <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            AND COALESCE(m.duracion_unidad, 'meses') != 'usos'
            ORDER BY m.fecha_fin ASC
            LIMIT 5
        `);

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
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN m.id IS NULL THEN 'inactiva'
                    WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' AND m.estado = 'activa' AND COALESCE(m.usos_restantes, 0) > 0 THEN 'activa'
                    WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' THEN 'vencida'
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
                ORDER BY (mm.estado = 'activa') DESC, mm.fecha_fin DESC, mm.id DESC
                LIMIT 1
            )
            LEFT JOIN planes p ON m.plan_id = p.id
            ORDER BY c.fecha_registro DESC
            LIMIT 5
        `);
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

app.get('/api/notificaciones', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                CASE
                    WHEN DATE(m.fecha_fin) = CURDATE() THEN 'vencida_hoy'
                    WHEN DATE(m.fecha_fin) = DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN 'vence_manana'
                    WHEN DATE(m.fecha_fin) = DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN 'vence_3_dias'
                END AS tipo,
                CASE
                    WHEN m.fecha_fin = CURDATE() THEN 'Membresía vencida hoy'
                    WHEN m.fecha_fin = DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN 'Membresía vence mañana'
                    WHEN m.fecha_fin = DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN 'Membresía vence en 3 días'
                END AS titulo,
                CASE
                    WHEN m.fecha_fin = CURDATE() THEN CONCAT(c.nombre, ' vence hoy')
                    WHEN m.fecha_fin = DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN CONCAT(c.nombre, ' vence mañana')
                    WHEN m.fecha_fin = DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN CONCAT(c.nombre, ' vence en 3 días')
                END AS mensaje,
                c.nombre AS cliente,
                c.dni,
                p.nombre AS plan,
                DATE_FORMAT(m.fecha_fin, '%Y-%m-%d') AS fecha_fin,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes
            FROM membresias m
            INNER JOIN clientes c ON m.cliente_id = c.id
            INNER JOIN planes p ON m.plan_id = p.id
            WHERE m.estado = 'activa'
            AND COALESCE(m.duracion_unidad, 'meses') != 'usos'
            AND DATE(m.fecha_fin) IN (
                CURDATE(),
                DATE_ADD(CURDATE(), INTERVAL 1 DAY),
                DATE_ADD(CURDATE(), INTERVAL 3 DAY)
            )
            ORDER BY m.fecha_fin ASC, c.nombre ASC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener notificaciones'
        });
    }
});

app.get('/api/membresias', async (req, res) => {
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
                m.precio_total,
                m.promocion,
                m.fecha_inicio,
                m.fecha_fin,
                m.estado,
                DATEDIFF(DATE(m.fecha_fin), CURDATE()) AS dias_restantes,
                CASE
                    WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' AND m.estado = 'activa' AND COALESCE(m.usos_restantes, 0) > 0 THEN 'activa'
                    WHEN COALESCE(m.duracion_unidad, 'meses') = 'usos' THEN 'vencida'
                    WHEN m.estado = 'vencida' OR DATEDIFF(DATE(m.fecha_fin), CURDATE()) < 0 THEN 'vencida'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 0 THEN 'vence_hoy'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 1 THEN 'vence_manana'
                    WHEN DATEDIFF(DATE(m.fecha_fin), CURDATE()) = 3 THEN 'vence_3_dias'
                    WHEN m.estado = 'activa' THEN 'activa'
                    ELSE 'inactiva'
                END AS estado_visual
            FROM membresias m
            INNER JOIN clientes c ON m.cliente_id = c.id
            INNER JOIN planes p ON m.plan_id = p.id
            ORDER BY m.fecha_inicio DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener membresías'
        });
    }
});

app.delete('/api/membresias/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [[membresia]] = await pool.query(
            `SELECT cliente_id FROM membresias WHERE id = ?`,
            [id]
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
             WHERE membresia_id = ?`,
            [id]
        );

        await pool.query(
            `DELETE FROM membresias WHERE id = ?`,
            [id]
        );

        const [[activas]] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM membresias
             WHERE cliente_id = ?
             AND estado = 'activa'`,
            [clienteId]
        );

        if (activas.total === 0) {
            await pool.query(
                `UPDATE clientes
                 SET estado = 'inactivo'
                 WHERE id = ?`,
                [clienteId]
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

app.put('/api/clientes/:id/desactivar', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            `UPDATE clientes
             SET estado = 'inactivo'
             WHERE id = ?`,
            [id]
        );

        await pool.query(
            `UPDATE membresias
             SET estado = 'vencida'
             WHERE cliente_id = ?
             AND estado = 'activa'`,
            [id]
        );

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

app.get('/api/sidebar', async (req, res) => {
    try {

        const [[clientes]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM clientes
        `);

        const [[membresias]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM membresias
            WHERE estado = 'activa'
            AND (
                COALESCE(duracion_unidad, 'meses') != 'usos'
                OR COALESCE(usos_restantes, 0) > 0
            )
        `);

        const [[porVencer]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM membresias
            WHERE estado = 'activa'
            AND COALESCE(duracion_unidad, 'meses') != 'usos'
            AND fecha_fin BETWEEN CURDATE()
            AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        `);

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
            AND m.estado = 'activa'
            AND (
                COALESCE(m.duracion_unidad, 'meses') != 'usos'
                OR COALESCE(m.usos_restantes, 0) > 0
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
            AND m.estado = 'activa'
            AND (
                COALESCE(m.duracion_unidad, 'meses') != 'usos'
                OR COALESCE(m.usos_restantes, 0) > 0
            )
        )
    `);
}

app.get('/api/planes/todos', async (req, res) => {
    try {
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
                COALESCE(duracion_unidad, 'meses') AS duracion_unidad
            FROM planes
            ORDER BY id ASC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener planes'
        });
    }
});

app.post('/api/planes', async (req, res) => {
    try {
        const datos = obtenerDatosPlan(req.body);
        const errorValidacion = validarDatosPlan(datos);

        if (errorValidacion) {
            return res.status(400).json({ error: errorValidacion });
        }

        const [result] = await pool.query(
            `INSERT INTO planes (nombre, precio_mensual, tipo, descripcion, estado, duracion_valor, duracion_unidad)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                datos.nombre,
                datos.precio,
                datos.tipo,
                datos.descripcion,
                datos.estado,
                datos.duracion_valor,
                datos.duracion_unidad
            ]
        );

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

app.put('/api/planes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const datos = obtenerDatosPlan(req.body);
        const errorValidacion = validarDatosPlan(datos);

        if (errorValidacion) {
            return res.status(400).json({ error: errorValidacion });
        }

        await pool.query(
            `UPDATE planes
             SET nombre = ?, precio_mensual = ?, descripcion = ?, estado = ?, duracion_valor = ?, duracion_unidad = ?
             WHERE id = ?`,
            [
                datos.nombre,
                datos.precio,
                datos.descripcion,
                datos.estado,
                datos.duracion_valor,
                datos.duracion_unidad,
                id
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

app.put('/api/planes/:id/desactivar', async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `UPDATE planes
             SET estado = 'inactivo'
             WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Plan no encontrado'
            });
        }

        res.json({
            mensaje: 'Plan desactivado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al desactivar plan'
        });
    }
});

app.get('/api/test', (req, res) => {
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
