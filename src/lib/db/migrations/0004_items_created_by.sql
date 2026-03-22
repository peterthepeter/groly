ALTER TABLE `items` ADD COLUMN `created_by` text REFERENCES `users`(`id`);
