-- Migracion: usuarios administrativos, roles, sesiones unicas y auditoria.
-- Ejecutar en la base MySQL de Aiven antes de desplegar el backend actualizado.

DELIMITER $$

DROP PROCEDURE IF EXISTS pf_add_column_if_missing $$
CREATE PROCEDURE pf_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @pf_sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
    PREPARE pf_stmt FROM @pf_sql;
    EXECUTE pf_stmt;
    DEALLOCATE PREPARE pf_stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS pf_drop_index_if_exists $$
CREATE PROCEDURE pf_drop_index_if_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @pf_sql = CONCAT('ALTER TABLE `', p_table_name, '` DROP INDEX `', p_index_name, '`');
    PREPARE pf_stmt FROM @pf_sql;
    EXECUTE pf_stmt;
    DEALLOCATE PREPARE pf_stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS pf_add_index_if_missing $$
CREATE PROCEDURE pf_add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @pf_sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
    PREPARE pf_stmt FROM @pf_sql;
    EXECUTE pf_stmt;
    DEALLOCATE PREPARE pf_stmt;
  END IF;
END $$

DELIMITER ;

CALL pf_add_column_if_missing('usuarios_admin', 'rol', "`rol` ENUM('admin','recepcion') NOT NULL DEFAULT 'recepcion' AFTER `estado`");
CALL pf_add_column_if_missing('usuarios_admin', 'session_id', "`session_id` VARCHAR(255) NULL AFTER `rol`");
CALL pf_add_column_if_missing('usuarios_admin', 'ultimo_login', "`ultimo_login` DATETIME NULL AFTER `session_id`");
CALL pf_add_column_if_missing('usuarios_admin', 'fecha_actualizacion', "`fecha_actualizacion` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `fecha_creacion`");

UPDATE usuarios_admin
SET rol = 'admin', estado = 'activo'
WHERE id = 1;

UPDATE usuarios_admin
SET rol = 'admin', estado = 'activo'
WHERE id = (
  SELECT id FROM (
    SELECT id
    FROM usuarios_admin
    ORDER BY id ASC
    LIMIT 1
  ) AS primer_usuario
)
AND NOT EXISTS (
  SELECT 1 FROM (
    SELECT id
    FROM usuarios_admin
    WHERE rol = 'admin'
      AND estado = 'activo'
    LIMIT 1
  ) AS admin_activo
);

CALL pf_add_column_if_missing('notificaciones', 'evento_key', "`evento_key` VARCHAR(191) NULL AFTER `entidad_id`");

UPDATE notificaciones
SET evento_key = 'default'
WHERE evento_key IS NULL
  AND tipo NOT IN ('usuario_login');

CALL pf_drop_index_if_exists('notificaciones', 'uq_notificaciones_evento');
CALL pf_add_index_if_missing(
  'notificaciones',
  'uq_notificaciones_evento_key',
  "UNIQUE KEY `uq_notificaciones_evento_key` (`tipo`,`entidad`,`entidad_id`,`evento_key`)"
);

DROP PROCEDURE IF EXISTS pf_add_column_if_missing;
DROP PROCEDURE IF EXISTS pf_drop_index_if_exists;
DROP PROCEDURE IF EXISTS pf_add_index_if_missing;
