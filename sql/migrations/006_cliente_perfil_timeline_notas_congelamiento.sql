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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permisos_admin (codigo, nombre, categoria, descripcion) VALUES
('clientes.notas.ver', 'Ver notas de clientes', 'Clientes', 'Permite consultar notas internas de clientes'),
('clientes.notas.crear', 'Crear notas de clientes', 'Clientes', 'Permite agregar notas internas de clientes'),
('clientes.notas.editar', 'Editar notas de clientes', 'Clientes', 'Permite editar notas internas de clientes'),
('clientes.notas.eliminar', 'Eliminar notas de clientes', 'Clientes', 'Permite eliminar notas internas de clientes'),
('membresias.congelar', 'Congelar membresias', 'Membresias', 'Permite congelar membresias activas');
