CREATE TABLE `barcode_cache` (
	`barcode` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`last_seen_at` integer NOT NULL
);
