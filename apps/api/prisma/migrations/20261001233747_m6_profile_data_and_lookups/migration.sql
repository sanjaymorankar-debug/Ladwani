-- AlterTable
ALTER TABLE `matrimonial_profiles` ADD COLUMN `education_level_id` VARCHAR(191) NULL,
    ADD COLUMN `familyBackground` TEXT NULL,
    ADD COLUMN `occupation_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `members` ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `education_level_id` VARCHAR(191) NULL,
    ADD COLUMN `employer_or_business` VARCHAR(191) NULL,
    ADD COLUMN `income_range` VARCHAR(191) NULL,
    ADD COLUMN `native_district` VARCHAR(191) NULL,
    ADD COLUMN `native_state` VARCHAR(191) NULL,
    ADD COLUMN `occupation_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `education_levels` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `education_levels_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `occupations` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `occupations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skills` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `skills_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_skills` (
    `member_id` VARCHAR(191) NOT NULL,
    `skill_id` VARCHAR(191) NOT NULL,

    INDEX `member_skills_skill_id_idx`(`skill_id`),
    PRIMARY KEY (`member_id`, `skill_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `members_deleted_at_current_city_idx` ON `members`(`deleted_at`, `current_city`);

-- CreateIndex
CREATE INDEX `members_deleted_at_education_level_id_idx` ON `members`(`deleted_at`, `education_level_id`);

-- CreateIndex
CREATE INDEX `members_deleted_at_occupation_id_idx` ON `members`(`deleted_at`, `occupation_id`);

-- AddForeignKey
ALTER TABLE `members` ADD CONSTRAINT `members_education_level_id_fkey` FOREIGN KEY (`education_level_id`) REFERENCES `education_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `members` ADD CONSTRAINT `members_occupation_id_fkey` FOREIGN KEY (`occupation_id`) REFERENCES `occupations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_skills` ADD CONSTRAINT `member_skills_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_skills` ADD CONSTRAINT `member_skills_skill_id_fkey` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrimonial_profiles` ADD CONSTRAINT `matrimonial_profiles_education_level_id_fkey` FOREIGN KEY (`education_level_id`) REFERENCES `education_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrimonial_profiles` ADD CONSTRAINT `matrimonial_profiles_occupation_id_fkey` FOREIGN KEY (`occupation_id`) REFERENCES `occupations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
