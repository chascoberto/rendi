CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`search_text` text NOT NULL,
	`category_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `foods_household_search_uq` ON `foods` (`household_id`,`search_text`);--> statement-breakpoint
CREATE TABLE `product_barcodes` (
	`household_id` text NOT NULL,
	`ean` text NOT NULL,
	`product_id` text NOT NULL,
	`pack_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`household_id`, `ean`),
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_barcodes_ean_check" CHECK(length("product_barcodes"."ean") IN (8, 12, 13, 14) AND "product_barcodes"."ean" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "product_barcodes_pack_count_check" CHECK("product_barcodes"."pack_count" >= 1)
);
--> statement-breakpoint
CREATE INDEX `product_barcodes_product_idx` ON `product_barcodes` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`search_text` text NOT NULL,
	`food_id` text,
	`category_id` text,
	`content_amount` real NOT NULL,
	`content_unit` text NOT NULL,
	`base_unit` text NOT NULL,
	`base_quantity` real NOT NULL,
	`stock_mode` text DEFAULT 'unit' NOT NULL,
	`min_stock` integer,
	`default_location_id` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`default_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "products_content_unit_check" CHECK("products"."content_unit" IN ('g', 'kg', 'ml', 'L', 'u')),
	CONSTRAINT "products_base_unit_check" CHECK("products"."base_unit" IN ('g', 'ml', 'u')),
	CONSTRAINT "products_content_positive" CHECK("products"."content_amount" > 0 AND "products"."base_quantity" > 0),
	CONSTRAINT "products_stock_mode_check" CHECK("products"."stock_mode" IN ('unit', 'bulk')),
	CONSTRAINT "products_min_stock_check" CHECK("products"."min_stock" IS NULL
        OR ("products"."stock_mode" = 'unit' AND "products"."min_stock" >= 1 AND "products"."min_stock" = CAST("products"."min_stock" AS INTEGER))
        OR ("products"."stock_mode" = 'bulk' AND "products"."min_stock" = 2))
);
--> statement-breakpoint
CREATE INDEX `products_household_idx` ON `products` (`household_id`);--> statement-breakpoint
CREATE INDEX `products_food_idx` ON `products` (`food_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'America/Santiago' NOT NULL,
	`currency` text DEFAULT 'CLP' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_food_prefs` (
	`member_id` text NOT NULL,
	`food_id` text NOT NULL,
	`stance` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`member_id`, `food_id`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "member_food_prefs_stance_check" CHECK("member_food_prefs"."stance" IN ('accepts', 'rejects'))
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`birth_date` text,
	`notes` text,
	`diet_profile` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "members_kind_check" CHECK("members"."kind" IN ('adult', 'child'))
);
--> statement-breakpoint
CREATE INDEX `members_household_idx` ON `members` (`household_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_memberId_unique` ON `users` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locations_household_idx` ON `locations` (`household_id`);--> statement-breakpoint
CREATE TABLE `stock_items` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`location_id` text NOT NULL,
	`quantity` real NOT NULL,
	`expires_on` text,
	`opened_at` integer,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "stock_items_quantity_check" CHECK("stock_items"."quantity" >= 0),
	CONSTRAINT "stock_items_expires_format" CHECK("stock_items"."expires_on" IS NULL OR "stock_items"."expires_on" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `stock_items_product_idx` ON `stock_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `stock_items_expires_idx` ON `stock_items` (`expires_on`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`product_id` text NOT NULL,
	`stock_item_id` text,
	`delta` real NOT NULL,
	`reason` text NOT NULL,
	`user_id` text,
	`purchase_id` text,
	`undone_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "stock_movements_reason_check" CHECK("stock_movements"."reason" IN ('purchase', 'consume', 'depleted', 'adjust', 'receipt'))
);
--> statement-breakpoint
CREATE INDEX `stock_movements_product_idx` ON `stock_movements` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_action_idx` ON `stock_movements` (`action_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`supermarket_id` text NOT NULL,
	`user_id` text,
	`purchased_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supermarket_id`) REFERENCES `supermarkets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `purchases_household_idx` ON `purchases` (`household_id`,`purchased_at`);--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`product_id` text,
	`food_id` text,
	`free_text` text,
	`quantity` integer,
	`note` text,
	`source` text NOT NULL,
	`source_ref` text,
	`supermarket_id` text,
	`checked_at` integer,
	`checked_by` text,
	`check_updated_at` integer,
	`purchase_id` text,
	`added_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supermarket_id`) REFERENCES `supermarkets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "shopping_list_items_target_check" CHECK(("shopping_list_items"."product_id" IS NOT NULL) + ("shopping_list_items"."food_id" IS NOT NULL) + ("shopping_list_items"."free_text" IS NOT NULL) = 1),
	CONSTRAINT "shopping_list_items_source_check" CHECK("shopping_list_items"."source" IN ('manual', 'min_stock', 'menu', 'lunchbox')),
	CONSTRAINT "shopping_list_items_quantity_check" CHECK("shopping_list_items"."quantity" IS NULL OR "shopping_list_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE INDEX `shopping_list_items_open_idx` ON `shopping_list_items` (`household_id`,`purchase_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_list_items_min_stock_uq` ON `shopping_list_items` (`household_id`,`product_id`) WHERE "shopping_list_items"."source" = 'min_stock' AND "shopping_list_items"."purchase_id" IS NULL;--> statement-breakpoint
CREATE TABLE `supermarkets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`has_online_prices` integer DEFAULT false NOT NULL,
	`is_wholesale` integer DEFAULT false NOT NULL,
	`website_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
