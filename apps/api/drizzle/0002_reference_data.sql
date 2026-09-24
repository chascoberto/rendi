-- Datos de referencia globales. Los ids son slugs estables usados en el código y el seed.

INSERT INTO `categories` (`id`, `name`, `icon`, `sort_order`) VALUES
  ('frutas-verduras', 'Frutas y verduras', 'carrot', 10),
  ('lacteos', 'Lácteos y huevos', 'milk', 20),
  ('carnes', 'Carnes y pescados', 'beef', 30),
  ('panaderia', 'Panadería', 'croissant', 40),
  ('abarrotes', 'Abarrotes', 'wheat', 50),
  ('congelados', 'Congelados', 'snowflake', 60),
  ('colaciones', 'Colaciones y snacks', 'cookie', 70),
  ('bebidas', 'Bebidas', 'cup-soda', 80),
  ('limpieza', 'Limpieza', 'spray-can', 90),
  ('higiene', 'Higiene personal', 'bath', 100),
  ('otros', 'Otros', 'package', 999)
ON CONFLICT (`id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `supermarkets` (`id`, `name`, `has_online_prices`, `is_wholesale`, `website_url`, `sort_order`, `active`) VALUES
  ('lider', 'Lider', 1, 0, 'https://www.lider.cl', 10, 1),
  ('jumbo', 'Jumbo', 1, 0, 'https://www.jumbo.cl', 20, 1),
  ('alvi', 'Alvi', 0, 1, NULL, 30, 1),
  ('acuenta', 'aCuenta', 0, 0, NULL, 40, 1),
  ('super10', 'Super 10', 0, 0, NULL, 50, 1),
  ('ganga', 'Ganga', 0, 0, NULL, 60, 1),
  ('cugat', 'Cugat', 0, 0, NULL, 70, 1)
ON CONFLICT (`id`) DO NOTHING;
