-- Invariantes de stock según el modo del producto (ver packages/shared/src/stock.ts).
-- La API valida lo mismo antes de escribir; estos triggers son la última barrera.
-- Los mensajes empiezan con un código estable que la API traduce a errores legibles.

CREATE TRIGGER `stock_items_mode_guard_insert`
BEFORE INSERT ON `stock_items`
BEGIN
  SELECT RAISE(ABORT, 'stock_bulk_level: un producto a granel solo admite los niveles 0, 1 o 2')
  WHERE (SELECT `stock_mode` FROM `products` WHERE `id` = NEW.`product_id`) = 'bulk'
    AND NEW.`quantity` NOT IN (0, 1, 2);
  SELECT RAISE(ABORT, 'stock_unit_integer: un producto por envases solo admite cantidades enteras')
  WHERE (SELECT `stock_mode` FROM `products` WHERE `id` = NEW.`product_id`) = 'unit'
    AND NEW.`quantity` <> CAST(NEW.`quantity` AS INTEGER);
  SELECT RAISE(ABORT, 'stock_bulk_single_lot: un producto a granel tiene a lo más un lote')
  WHERE (SELECT `stock_mode` FROM `products` WHERE `id` = NEW.`product_id`) = 'bulk'
    AND EXISTS (SELECT 1 FROM `stock_items` WHERE `product_id` = NEW.`product_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `stock_items_mode_guard_update`
BEFORE UPDATE OF `quantity`, `product_id` ON `stock_items`
BEGIN
  SELECT RAISE(ABORT, 'stock_bulk_level: un producto a granel solo admite los niveles 0, 1 o 2')
  WHERE (SELECT `stock_mode` FROM `products` WHERE `id` = NEW.`product_id`) = 'bulk'
    AND NEW.`quantity` NOT IN (0, 1, 2);
  SELECT RAISE(ABORT, 'stock_unit_integer: un producto por envases solo admite cantidades enteras')
  WHERE (SELECT `stock_mode` FROM `products` WHERE `id` = NEW.`product_id`) = 'unit'
    AND NEW.`quantity` <> CAST(NEW.`quantity` AS INTEGER);
  SELECT RAISE(ABORT, 'stock_bulk_single_lot: un producto a granel tiene a lo más un lote')
  WHERE (SELECT `stock_mode` FROM `products` WHERE `id` = NEW.`product_id`) = 'bulk'
    AND EXISTS (
      SELECT 1 FROM `stock_items` WHERE `product_id` = NEW.`product_id` AND `id` <> NEW.`id`
    );
END;
--> statement-breakpoint
-- Cambiar un producto a granel exige consolidar antes su stock en un solo lote de nivel 0-2.
CREATE TRIGGER `products_stock_mode_guard`
BEFORE UPDATE OF `stock_mode` ON `products`
WHEN NEW.`stock_mode` = 'bulk' AND OLD.`stock_mode` <> 'bulk'
BEGIN
  SELECT RAISE(ABORT, 'stock_bulk_single_lot: consolida el stock en un solo lote antes de pasar a granel')
  WHERE (SELECT count(*) FROM `stock_items` WHERE `product_id` = NEW.`id`) > 1;
  SELECT RAISE(ABORT, 'stock_bulk_level: el lote debe tener nivel 0, 1 o 2 antes de pasar a granel')
  WHERE EXISTS (
    SELECT 1 FROM `stock_items` WHERE `product_id` = NEW.`id` AND `quantity` NOT IN (0, 1, 2)
  );
END;
