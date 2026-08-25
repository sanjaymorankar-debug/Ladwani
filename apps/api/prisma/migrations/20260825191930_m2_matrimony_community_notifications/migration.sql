-- CreateTable
CREATE TABLE `matrimonial_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `is_visible` BOOLEAN NOT NULL DEFAULT false,
    `about` TEXT NULL,
    `height_cm` INTEGER NULL,
    `languages` JSON NULL,
    `allow_contact_requests` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `matrimonial_profiles_member_id_key`(`member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matrimonial_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `matrimonial_profile_id` VARCHAR(191) NOT NULL,
    `min_age` INTEGER NULL,
    `max_age` INTEGER NULL,
    `preferred_gender` VARCHAR(191) NULL,
    `preferred_locations` JSON NULL,
    `education_preference` VARCHAR(191) NULL,
    `occupation_preference` VARCHAR(191) NULL,

    UNIQUE INDEX `matrimonial_preferences_matrimonial_profile_id_key`(`matrimonial_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matrimonial_interests` (
    `id` VARCHAR(191) NOT NULL,
    `from_member_id` VARCHAR(191) NOT NULL,
    `to_member_id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'INTEREST',
    `message` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `responded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `matrimonial_interests_from_member_id_to_member_id_kind_key`(`from_member_id`, `to_member_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matrimonial_saves` (
    `id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `saved_member_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `matrimonial_saves_member_id_saved_member_id_key`(`member_id`, `saved_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_types` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `requires_approval` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `post_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posts` (
    `id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `post_type_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `target_area_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PUBLISHED',
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `parent_id` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reactions` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NULL,
    `comment_id` VARCHAR(191) NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'LIKE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reactions_post_id_member_id_key`(`post_id`, `member_id`),
    UNIQUE INDEX `reactions_comment_id_member_id_key`(`comment_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NULL,
    `comment_id` VARCHAR(191) NULL,
    `member_id` VARCHAR(191) NULL,
    `reporter_id` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `resolved_by` VARCHAR(191) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `recipient_id` VARCHAR(191) NOT NULL,
    `sender_id` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `data` JSON NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `email_sent` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `matrimonial_profiles` ADD CONSTRAINT `matrimonial_profiles_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrimonial_preferences` ADD CONSTRAINT `matrimonial_preferences_matrimonial_profile_id_fkey` FOREIGN KEY (`matrimonial_profile_id`) REFERENCES `matrimonial_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrimonial_interests` ADD CONSTRAINT `matrimonial_interests_from_member_id_fkey` FOREIGN KEY (`from_member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrimonial_interests` ADD CONSTRAINT `matrimonial_interests_to_member_id_fkey` FOREIGN KEY (`to_member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrimonial_saves` ADD CONSTRAINT `matrimonial_saves_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrimonial_saves` ADD CONSTRAINT `matrimonial_saves_saved_member_id_fkey` FOREIGN KEY (`saved_member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_post_type_id_fkey` FOREIGN KEY (`post_type_id`) REFERENCES `post_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_target_area_id_fkey` FOREIGN KEY (`target_area_id`) REFERENCES `areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_id_fkey` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
