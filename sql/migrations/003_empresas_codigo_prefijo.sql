ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS codigo_prefijo VARCHAR(20) DEFAULT 'PFS',
ADD COLUMN IF NOT EXISTS codigo_longitud INT DEFAULT 4;

UPDATE empresas
SET codigo_prefijo = 'PFS',
    codigo_longitud = 4
WHERE id = 1;

UPDATE empresas
SET codigo_prefijo = 'PDP',
    codigo_longitud = 4
WHERE id = 2;
