-- Duracion flexible de planes y membresias
-- Ejecutar solo si las columnas no existen en la base de datos actual.

ALTER TABLE planes
ADD COLUMN duracion_valor INT DEFAULT 1,
ADD COLUMN duracion_unidad ENUM('dias','meses','usos') DEFAULT 'meses';

ALTER TABLE membresias
ADD COLUMN duracion_unidad ENUM('dias','meses','usos') DEFAULT 'meses',
ADD COLUMN usos_totales INT NULL,
ADD COLUMN usos_restantes INT NULL;
