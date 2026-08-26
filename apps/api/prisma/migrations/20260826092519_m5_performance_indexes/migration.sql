-- CreateIndex
CREATE INDEX `approvals_status_submitted_at_idx` ON `approvals`(`status`, `submitted_at`);

-- CreateIndex
CREATE INDEX `assets_deleted_at_status_idx` ON `assets`(`deleted_at`, `status`);

-- CreateIndex
CREATE INDEX `assets_deleted_at_category_id_idx` ON `assets`(`deleted_at`, `category_id`);

-- CreateIndex
CREATE INDEX `audit_logs_actor_id_created_at_idx` ON `audit_logs`(`actor_id`, `created_at`);

-- CreateIndex
CREATE INDEX `audit_logs_entity_type_created_at_idx` ON `audit_logs`(`entity_type`, `created_at`);

-- CreateIndex
CREATE INDEX `bookings_user_id_created_at_idx` ON `bookings`(`user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `bookings_status_asset_id_idx` ON `bookings`(`status`, `asset_id`);

-- CreateIndex
CREATE INDEX `donations_donor_user_id_created_at_idx` ON `donations`(`donor_user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `families_deleted_at_idx` ON `families`(`deleted_at`);

-- CreateIndex
CREATE INDEX `family_join_requests_family_id_status_idx` ON `family_join_requests`(`family_id`, `status`);

-- CreateIndex
CREATE INDEX `family_members_member_id_left_at_idx` ON `family_members`(`member_id`, `left_at`);

-- CreateIndex
CREATE INDEX `family_members_family_id_left_at_idx` ON `family_members`(`family_id`, `left_at`);

-- CreateIndex
CREATE INDEX `fee_invoices_family_id_created_at_idx` ON `fee_invoices`(`family_id`, `created_at`);

-- CreateIndex
CREATE INDEX `financial_ledger_entry_type_idx` ON `financial_ledger`(`entry_type`);

-- CreateIndex
CREATE INDEX `matrimonial_interests_to_member_id_created_at_idx` ON `matrimonial_interests`(`to_member_id`, `created_at`);

-- CreateIndex
CREATE INDEX `matrimonial_interests_from_member_id_created_at_idx` ON `matrimonial_interests`(`from_member_id`, `created_at`);

-- CreateIndex
CREATE INDEX `matrimonial_interests_status_idx` ON `matrimonial_interests`(`status`);

-- CreateIndex
CREATE INDEX `matrimonial_profiles_is_visible_idx` ON `matrimonial_profiles`(`is_visible`);

-- CreateIndex
CREATE INDEX `member_relationships_is_active_from_member_id_idx` ON `member_relationships`(`is_active`, `from_member_id`);

-- CreateIndex
CREATE INDEX `members_deleted_at_gender_idx` ON `members`(`deleted_at`, `gender`);

-- CreateIndex
CREATE INDEX `members_deleted_at_marital_status_idx` ON `members`(`deleted_at`, `marital_status`);

-- CreateIndex
CREATE INDEX `members_deleted_at_status_idx` ON `members`(`deleted_at`, `status`);

-- CreateIndex
CREATE INDEX `notifications_recipient_id_is_read_created_at_idx` ON `notifications`(`recipient_id`, `is_read`, `created_at`);

-- CreateIndex
CREATE INDEX `payment_gateway_transactions_gateway_order_id_idx` ON `payment_gateway_transactions`(`gateway_order_id`);

-- CreateIndex
CREATE INDEX `payment_transactions_gateway_code_status_updated_at_idx` ON `payment_transactions`(`gateway_code`, `status`, `updated_at`);

-- CreateIndex
CREATE INDEX `posts_deleted_at_status_is_pinned_created_at_idx` ON `posts`(`deleted_at`, `status`, `is_pinned`, `created_at`);

-- CreateIndex
CREATE INDEX `reports_status_created_at_idx` ON `reports`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `reviews_asset_id_created_at_idx` ON `reviews`(`asset_id`, `created_at`);

-- CreateIndex
CREATE INDEX `user_roles_user_id_family_id_idx` ON `user_roles`(`user_id`, `family_id`);

-- CreateIndex
CREATE INDEX `users_deleted_at_idx` ON `users`(`deleted_at`);

-- CreateIndex
CREATE INDEX `verification_tokens_user_id_type_used_at_idx` ON `verification_tokens`(`user_id`, `type`, `used_at`);

-- RenameIndex
ALTER TABLE `family_areas` RENAME INDEX `family_areas_area_id_fkey` TO `family_areas_area_id_idx`;
