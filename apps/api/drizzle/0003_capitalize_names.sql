-- Nombres visibles con la primera letra en mayúscula (la app ya lo aplica al guardar).
-- upper() de SQLite solo convierte ASCII: las iniciales con tilde o ñ se mapean a mano.
UPDATE `members` SET `name` =
  CASE substr(`name`, 1, 1)
    WHEN 'á' THEN 'Á' WHEN 'é' THEN 'É' WHEN 'í' THEN 'Í' WHEN 'ó' THEN 'Ó' WHEN 'ú' THEN 'Ú'
    WHEN 'ü' THEN 'Ü' WHEN 'ñ' THEN 'Ñ'
    ELSE upper(substr(`name`, 1, 1))
  END || substr(`name`, 2);
--> statement-breakpoint
UPDATE `foods` SET `name` =
  CASE substr(`name`, 1, 1)
    WHEN 'á' THEN 'Á' WHEN 'é' THEN 'É' WHEN 'í' THEN 'Í' WHEN 'ó' THEN 'Ó' WHEN 'ú' THEN 'Ú'
    WHEN 'ü' THEN 'Ü' WHEN 'ñ' THEN 'Ñ'
    ELSE upper(substr(`name`, 1, 1))
  END || substr(`name`, 2);
