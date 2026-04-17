ALTER TABLE `supplement_catalog` ADD COLUMN `package_size` real;
--> statement-breakpoint
ALTER TABLE `supplement_catalog` DROP COLUMN `default_amount`;
