-- Migracion: permisos granulares para roles administrativos existentes.
-- Ejecutar en Aiven/MySQL antes de desplegar el backend actualizado.
-- No borra datos. Usa usuarios_admin.rol como codigo de rol existente.

CREATE TABLE IF NOT EXISTS permisos_admin (
  id INT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(100) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  categoria VARCHAR(80) NOT NULL,
  descripcion VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permisos_admin_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS roles_admin (
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255) NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  sistema TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (codigo),
  KEY idx_roles_admin_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS roles_permisos (
  rol_codigo VARCHAR(50) NOT NULL,
  permiso_id INT NOT NULL,
  PRIMARY KEY (rol_codigo, permiso_id),
  KEY idx_roles_permisos_permiso (permiso_id),
  CONSTRAINT fk_roles_permisos_permiso
    FOREIGN KEY (permiso_id) REFERENCES permisos_admin (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO roles_admin (codigo, nombre, descripcion, estado, sistema) VALUES
('admin', 'Administrador', 'Acceso total al sistema y configuracion del gimnasio.', 'activo', 1),
('recepcion', 'Recepcion', 'Gestiona ingresos, clientes y atencion al cliente.', 'activo', 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  estado = 'activo',
  sistema = 1;

INSERT IGNORE INTO roles_admin (codigo, nombre, descripcion, estado, sistema)
SELECT
  LOWER(TRIM(rol)) AS codigo,
  TRIM(rol) AS nombre,
  'Rol administrativo existente migrado automaticamente.',
  'activo',
  0
FROM usuarios_admin
WHERE rol IS NOT NULL
  AND TRIM(rol) <> ''
  AND LOWER(TRIM(rol)) NOT IN ('admin', 'recepcion');

INSERT INTO permisos_admin (codigo, nombre, categoria, descripcion) VALUES
('clientes.ver', 'Ver clientes', 'Clientes', 'Permite listar y consultar clientes'),
('clientes.crear', 'Crear clientes', 'Clientes', 'Permite registrar clientes'),
('clientes.editar', 'Editar clientes', 'Clientes', 'Permite actualizar clientes'),
('clientes.eliminar', 'Eliminar clientes', 'Clientes', 'Permite eliminar o desactivar clientes'),
('membresias.ver', 'Ver membresias', 'Membresias', 'Permite listar membresias'),
('membresias.crear', 'Crear membresias', 'Membresias', 'Permite crear membresias'),
('membresias.editar', 'Editar membresias', 'Membresias', 'Permite actualizar membresias'),
('membresias.eliminar', 'Eliminar membresias', 'Membresias', 'Permite eliminar membresias'),
('membresias.renovar', 'Renovar membresias', 'Membresias', 'Permite renovar membresias'),
('planes.ver', 'Ver planes', 'Planes', 'Permite listar planes'),
('planes.crear', 'Crear planes', 'Planes', 'Permite crear planes'),
('planes.editar', 'Editar planes', 'Planes', 'Permite actualizar planes'),
('planes.eliminar', 'Eliminar planes', 'Planes', 'Permite eliminar o desactivar planes'),
('asistencias.ver', 'Ver asistencias', 'Asistencias', 'Permite listar asistencias'),
('asistencias.eliminar', 'Eliminar asistencias', 'Asistencias', 'Permite eliminar asistencias'),
('validacion.usar', 'Usar validacion', 'Validacion', 'Permite validar ingresos'),
('dashboard.ver', 'Ver dashboard', 'Dashboard', 'Permite acceder al dashboard'),
('configuracion.ver', 'Ver configuracion', 'Configuracion', 'Permite acceder a configuracion'),
('usuarios.ver', 'Ver usuarios', 'Usuarios', 'Permite listar usuarios administrativos'),
('usuarios.crear', 'Crear usuarios', 'Usuarios', 'Permite crear usuarios administrativos'),
('usuarios.editar', 'Editar usuarios', 'Usuarios', 'Permite actualizar usuarios administrativos'),
('usuarios.desactivar', 'Desactivar usuarios', 'Usuarios', 'Permite activar o desactivar usuarios administrativos'),
('roles.ver', 'Ver roles', 'Roles', 'Permite consultar roles administrativos'),
('roles.crear', 'Crear roles', 'Roles', 'Permite crear roles administrativos'),
('roles.editar', 'Editar roles', 'Roles', 'Permite editar roles administrativos'),
('roles.eliminar', 'Eliminar roles', 'Roles', 'Permite eliminar o desactivar roles administrativos'),
('roles.asignar_permisos', 'Asignar permisos', 'Roles', 'Permite administrar permisos de roles'),
('exportar.clientes', 'Exportar clientes', 'Exportaciones', 'Permite exportar clientes'),
('exportar.membresias', 'Exportar membresias', 'Exportaciones', 'Permite exportar membresias'),
('exportar.asistencias', 'Exportar asistencias', 'Exportaciones', 'Permite exportar asistencias'),
('notificaciones.ver', 'Ver notificaciones', 'Notificaciones', 'Permite ver notificaciones'),
('notificaciones.marcar_leida', 'Marcar notificacion como leida', 'Notificaciones', 'Permite marcar notificaciones como leidas'),
('notificaciones.eliminar', 'Eliminar notificaciones', 'Notificaciones', 'Permite eliminar notificaciones')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  categoria = VALUES(categoria),
  descripcion = VALUES(descripcion);

INSERT IGNORE INTO roles_permisos (rol_codigo, permiso_id)
SELECT 'admin', id
FROM permisos_admin;

INSERT IGNORE INTO roles_permisos (rol_codigo, permiso_id)
SELECT 'recepcion', id
FROM permisos_admin
WHERE codigo IN (
  'dashboard.ver',
  'clientes.ver',
  'clientes.crear',
  'clientes.editar',
  'membresias.ver',
  'membresias.crear',
  'membresias.renovar',
  'planes.ver',
  'asistencias.ver',
  'validacion.usar',
  'notificaciones.ver',
  'notificaciones.marcar_leida'
);

DELIMITER $$

DROP PROCEDURE IF EXISTS pf_notificar_permisos_base $$
CREATE PROCEDURE pf_notificar_permisos_base()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notificaciones'
      AND COLUMN_NAME = 'evento_key'
  ) THEN
    INSERT IGNORE INTO notificaciones
      (tipo, titulo, mensaje, entidad, entidad_id, usuario_id, usuario_nombre, evento_key)
    VALUES
      ('permiso_base_creado', 'Permisos base disponibles', 'Se inicializaron los permisos base para roles administrativos.', 'permisos_admin', 0, NULL, NULL, 'permisos_base_v1');
  ELSE
    INSERT IGNORE INTO notificaciones
      (tipo, titulo, mensaje, entidad, entidad_id, usuario_id, usuario_nombre)
    VALUES
      ('permiso_base_creado', 'Permisos base disponibles', 'Se inicializaron los permisos base para roles administrativos.', 'permisos_admin', 0, NULL, NULL);
  END IF;
END $$

DELIMITER ;

CALL pf_notificar_permisos_base();

DROP PROCEDURE IF EXISTS pf_notificar_permisos_base;
