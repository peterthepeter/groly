CREATE TABLE IF NOT EXISTS `recipes` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `title` TEXT NOT NULL,
  `description` TEXT,
  `image_url` TEXT,
  `source_url` TEXT,
  `servings` INTEGER NOT NULL DEFAULT 4,
  `prep_time` INTEGER,
  `cook_time` INTEGER,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `recipe_id` TEXT NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `amount` TEXT,
  `unit` TEXT,
  `name` TEXT NOT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recipe_steps` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `recipe_id` TEXT NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `step_number` INTEGER NOT NULL,
  `text` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recipe_shares` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `sender_id` TEXT NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `receiver_id` TEXT NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `recipe_id` TEXT NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `status` TEXT NOT NULL DEFAULT 'pending',
  `created_at` INTEGER NOT NULL
);
