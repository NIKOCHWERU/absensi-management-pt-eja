ALTER TABLE `attendance` MODIFY COLUMN `check_in_photo` varchar(255);--> statement-breakpoint
ALTER TABLE `attendance` MODIFY COLUMN `break_start_photo` varchar(255);--> statement-breakpoint
ALTER TABLE `attendance` MODIFY COLUMN `break_end_photo` varchar(255);--> statement-breakpoint
ALTER TABLE `attendance` MODIFY COLUMN `check_out_photo` varchar(255);--> statement-breakpoint
ALTER TABLE `announcements` ADD `image_url` varchar(512);--> statement-breakpoint
ALTER TABLE `announcements` ADD `expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `attendance` ADD `shift` varchar(50);--> statement-breakpoint
ALTER TABLE `attendance` ADD `permit_exit_at` timestamp;--> statement-breakpoint
ALTER TABLE `attendance` ADD `permit_resume_at` timestamp;