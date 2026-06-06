CREATE TABLE IF NOT EXISTS notificaciones (
  id INT NOT NULL AUTO_INCREMENT,
  tipo VARCHAR(80) NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  mensaje TEXT NOT NULL,
  entidad VARCHAR(80) NOT NULL,
  entidad_id INT NOT NULL,
  usuario_id INT NULL,
  usuario_nombre VARCHAR(160) NULL,
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notificaciones_evento (tipo, entidad, entidad_id),
  KEY idx_notificaciones_leida_fecha (leida, fecha_creacion),
  KEY idx_notificaciones_fecha (fecha_creacion)
);
