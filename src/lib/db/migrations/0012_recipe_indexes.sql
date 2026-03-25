CREATE INDEX IF NOT EXISTS `recipe_ingredients_recipe_id_idx` ON `recipe_ingredients` (`recipe_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recipe_steps_recipe_id_idx` ON `recipe_steps` (`recipe_id`);
