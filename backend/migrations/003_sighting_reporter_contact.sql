-- Purrsona v1 — Sighting Reporter Contact
-- Lets a reporter optionally leave a contact method (phone, email, etc.)
-- alongside a sighting, so caretakers/TNR volunteers can follow up.

ALTER TABLE sighting_drafts ADD COLUMN reporter_contact VARCHAR(255);
ALTER TABLE sightings ADD COLUMN reporter_contact VARCHAR(255);
