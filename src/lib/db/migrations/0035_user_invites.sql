CREATE TABLE `user_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_invites_token_hash_unique` ON `user_invites` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `user_invites_user_id_idx` ON `user_invites` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_invites_expires_at_idx` ON `user_invites` (`expires_at`);
