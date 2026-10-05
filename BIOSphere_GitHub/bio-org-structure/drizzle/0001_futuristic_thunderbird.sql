CREATE TABLE `login_attempts` (
	`ip` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`blocked_until` integer NOT NULL
);
