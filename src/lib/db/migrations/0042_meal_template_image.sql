-- Bild + Gericht-Name für Gericht-Vorlagen und getrackte Mahlzeiten.
ALTER TABLE `nutrition_meal_favorites` ADD COLUMN `image_url` text;
--> statement-breakpoint
ALTER TABLE `meals` ADD COLUMN `image_url` text;
--> statement-breakpoint
ALTER TABLE `meals` ADD COLUMN `favorite_name` text;
