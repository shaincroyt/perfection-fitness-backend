ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS validation_active_bg VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_active_surface VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_active_border VARCHAR(60) NULL,
ADD COLUMN IF NOT EXISTS validation_active_text VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_active_muted VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_active_accent VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_denied_bg VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_denied_surface VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_denied_border VARCHAR(60) NULL,
ADD COLUMN IF NOT EXISTS validation_denied_text VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_denied_muted VARCHAR(40) NULL,
ADD COLUMN IF NOT EXISTS validation_denied_accent VARCHAR(40) NULL;
