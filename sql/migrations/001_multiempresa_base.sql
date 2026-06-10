START TRANSACTION;

CREATE TABLE IF NOT EXISTS empresas (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  estado ENUM('activo','suspendido','inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO empresas (id, nombre, estado)
VALUES (1, 'Empresa Principal', 'activo')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  estado = VALUES(estado);

ALTER TABLE usuarios_admin ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE clientes ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE planes ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE membresias ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE asistencias ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE promociones ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE notificaciones ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE roles_admin ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 AFTER codigo;
ALTER TABLE roles_permisos ADD COLUMN empresa_id INT NOT NULL DEFAULT 1 FIRST;

UPDATE usuarios_admin SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE clientes SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE planes SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE membresias SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE asistencias SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE promociones SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE notificaciones SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE roles_admin SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;
UPDATE roles_permisos SET empresa_id = 1 WHERE empresa_id IS NULL OR empresa_id = 0;

ALTER TABLE clientes DROP INDEX dni;
ALTER TABLE clientes ADD UNIQUE KEY uq_clientes_empresa_dni (empresa_id, dni);
ALTER TABLE clientes ADD UNIQUE KEY uq_clientes_empresa_correo (empresa_id, correo);

ALTER TABLE usuarios_admin DROP INDEX usuario;
ALTER TABLE usuarios_admin ADD UNIQUE KEY uq_usuarios_empresa_usuario (empresa_id, usuario);

ALTER TABLE membresias DROP INDEX codigo;
ALTER TABLE membresias ADD UNIQUE KEY uq_membresias_empresa_codigo (empresa_id, codigo);

ALTER TABLE roles_admin DROP INDEX codigo;
ALTER TABLE roles_admin ADD UNIQUE KEY uq_roles_empresa_codigo (empresa_id, codigo);

ALTER TABLE roles_permisos DROP PRIMARY KEY;
ALTER TABLE roles_permisos ADD PRIMARY KEY (empresa_id, rol_codigo, permiso_id);

CREATE INDEX idx_clientes_empresa ON clientes (empresa_id);
CREATE INDEX idx_planes_empresa ON planes (empresa_id);
CREATE INDEX idx_membresias_empresa ON membresias (empresa_id);
CREATE INDEX idx_asistencias_empresa ON asistencias (empresa_id);
CREATE INDEX idx_promociones_empresa ON promociones (empresa_id);
CREATE INDEX idx_notificaciones_empresa ON notificaciones (empresa_id);
CREATE INDEX idx_usuarios_admin_empresa ON usuarios_admin (empresa_id);

COMMIT;