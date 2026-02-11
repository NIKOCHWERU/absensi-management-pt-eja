CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`author_id` int,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`date` date NOT NULL,
	`check_in` timestamp,
	`check_in_photo` text,
	`check_in_location` text,
	`break_start` timestamp,
	`break_start_photo` text,
	`break_start_location` text,
	`break_end` timestamp,
	`break_end_photo` text,
	`break_end_location` text,
	`check_out` timestamp,
	`check_out_photo` text,
	`check_out_location` text,
	`status` enum('present','late','sick','permission','absent') DEFAULT 'absent',
	`notes` text,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255),
	`username` varchar(255),
	`password` varchar(255) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`role` enum('admin','employee') NOT NULL DEFAULT 'employee',
	`nik` varchar(50),
	`branch` varchar(100),
	`position` varchar(100),
	`shift` varchar(50),
	`photo_url` varchar(512),
	`is_admin` boolean DEFAULT false,
	`phone_number` varchar(20),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_nik_unique` UNIQUE(`nik`)
);
