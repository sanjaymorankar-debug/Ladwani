-- Admin 2-factor login and OTP brute-force guard: count wrong guesses per
-- code so a code is burned after 5 attempts. Additive; existing rows get 0.
ALTER TABLE `verification_tokens` ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0;
