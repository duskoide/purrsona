-- Purrsona v1 — User Account Settings
-- Adds profile picture support and soft-delete support to users table.
--
-- Account deletion is a soft delete (deleted_at + scrubbed PII) rather than a
-- hard DELETE, because sightings, feeding_spots, tnr_records, and
-- content_reports all reference users(id) with NOT NULL, NO ACTION foreign
-- keys — a hard delete would either fail outright or require destroying
-- community-contributed data (sightings, TNR history) that has value beyond
-- the deleting user's account.

ALTER TABLE users ADD COLUMN avatar_url VARCHAR(1024);
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
