-- Migracion segura: asistencias por membresia y promociones vinculadas
-- Ejecutar en la base de datos MySQL antes de desplegar el backend actualizado.

CREATE TABLE IF NOT EXISTS promociones (
  id INT NOT NULL AUTO_INCREMENT,
  tipo VARCHAR(80) NOT NULL,
  fecha_creacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS asistencias_incluidas INT NULL AFTER duracion_unidad,
  ADD COLUMN IF NOT EXISTS es_ilimitado TINYINT(1) NOT NULL DEFAULT 0 AFTER asistencias_incluidas;

ALTER TABLE membresias
  ADD COLUMN IF NOT EXISTS asistencias_totales INT NULL AFTER usos_restantes,
  ADD COLUMN IF NOT EXISTS asistencias_usadas INT NOT NULL DEFAULT 0 AFTER asistencias_totales,
  ADD COLUMN IF NOT EXISTS promocion_id INT NULL AFTER asistencias_usadas;

ALTER TABLE asistencias
  ADD COLUMN IF NOT EXISTS cuenta_como_uso TINYINT(1) NOT NULL DEFAULT 0 AFTER motivo;

ALTER TABLE asistencias
  MODIFY COLUMN cliente_id INT NULL;

UPDATE planes
SET
  asistencias_incluidas = CASE
    WHEN duracion_unidad = 'usos' THEN COALESCE(asistencias_incluidas, duracion_valor)
    ELSE asistencias_incluidas
  END,
  es_ilimitado = CASE
    WHEN duracion_unidad = 'usos' THEN 0
    WHEN asistencias_incluidas IS NULL THEN 1
    ELSE es_ilimitado
  END
WHERE asistencias_incluidas IS NULL OR es_ilimitado IS NULL;

UPDATE asistencias
SET cuenta_como_uso = 1
WHERE estado = 'permitido'
AND cuenta_como_uso = 0;

DROP PROCEDURE IF EXISTS add_index_if_not_exists;
DELIMITER //
CREATE PROCEDURE add_index_if_not_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @sql = p_index_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL add_index_if_not_exists(
  'membresias',
  'idx_membresias_promocion_id',
  'CREATE INDEX idx_membresias_promocion_id ON membresias (promocion_id)'
);

CALL add_index_if_not_exists(
  'asistencias',
  'idx_asistencias_membresia_fecha_uso',
  'CREATE INDEX idx_asistencias_membresia_fecha_uso ON asistencias (membresia_id, fecha_hora, cuenta_como_uso)'
);

DROP PROCEDURE IF EXISTS add_index_if_not_exists;
