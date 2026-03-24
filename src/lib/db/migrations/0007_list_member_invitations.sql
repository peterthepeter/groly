ALTER TABLE list_members ADD COLUMN status TEXT NOT NULL DEFAULT 'accepted';
--> statement-breakpoint
ALTER TABLE list_members ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;
