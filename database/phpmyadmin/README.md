# Superseded — use `scripts/mysql/` instead

`create_tables.sql` here is **incomplete**: it lacks 9 tables (`assets`,
`bookings`, `asset_blackouts`, `payments`, `fee_invoices`, `fee_types`,
`member_invitations`, `community_groups`, `community_group_members`) and 15
columns the app uses (e.g. `users.joinIntent`, `members.languages`,
`photos.visibility`, `family_join_requests.direction`), and
`seed_reference_data.sql` lacks the permission matrix, approval rules, areas,
income ranges and the registration fee.

- New, empty database → import `scripts/mysql/01-schema.sql` then
  `scripts/mysql/02-reference-data.sql`.
- Database already built from the files in this folder → back it up, make sure
  `add_member_profile_details.sql` has been imported, then import
  `scripts/mysql/03-upgrade-existing.sql` once.
