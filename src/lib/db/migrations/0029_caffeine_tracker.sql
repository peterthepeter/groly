CREATE TABLE IF NOT EXISTS `caffeine_drinks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`default_ml` integer NOT NULL,
	`caffeine_mg` integer NOT NULL,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `caffeine_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`drink_name` text NOT NULL,
	`amount_ml` integer NOT NULL,
	`caffeine_mg` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `caffeine_logs_user_id_idx` ON `caffeine_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `caffeine_logs_logged_at_idx` ON `caffeine_logs` (`logged_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `caffeine_drinks` (`id`, `name`, `default_ml`, `caffeine_mg`, `sort_order`, `created_at`) VALUES
	('cd-espresso',          'Espresso',           30,  63,  0, 0),
	('cd-doppelter-espresso','Doppelter Espresso',  60, 126,  1, 0),
	('cd-filterkaffee',      'Filterkaffee',       200,  90,  2, 0),
	('cd-cappuccino',        'Cappuccino',         200,  63,  3, 0),
	('cd-latte-macchiato',   'Latte Macchiato',    300,  63,  4, 0),
	('cd-cold-brew',         'Cold Brew',          250, 200,  5, 0),
	('cd-schwarztee',        'Schwarztee',         200,  45,  6, 0),
	('cd-gruentee',          'Grüntee',            200,  30,  7, 0),
	('cd-energy-drink',      'Energy Drink',       250,  80,  8, 0),
	('cd-cola',              'Cola',               330,  35,  9, 0);
