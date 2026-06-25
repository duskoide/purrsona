-- Purrsona v1 — Seed Data
-- Dev/test data for local development

-- Users (passwords are all "password123" hashed with bcrypt)
-- bcrypt hash: $2b$12$LJ3m4ys3Lz0YBGQxKvGqeOBUOzHMdPpMTJmF1mQKc1ovCZYZb0S/C
INSERT INTO users (id, email, password_hash, role, verified_at) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin@purrsona.local', '$2b$12$LJ3m4ys3Lz0YBGQxKvGqeOBUOzHMdPpMTJmF1mQKc1ovCZYZb0S/C', 'verified', NOW()),
    ('a0000000-0000-0000-0000-000000000002', 'caretaker@purrsona.local', '$2b$12$LJ3m4ys3Lz0YBGQxKvGqeOBUOzHMdPpMTJmF1mQKc1ovCZYZb0S/C', 'verified', NOW()),
    ('a0000000-0000-0000-0000-000000000003', 'user@purrsona.local', '$2b$12$LJ3m4ys3Lz0YBGQxKvGqeOBUOzHMdPpMTJmF1mQKc1ovCZYZb0S/C', 'signed_in', NULL),
    ('a0000000-0000-0000-0000-000000000004', 'volunteer@purrsona.local', '$2b$12$LJ3m4ys3Lz0YBGQxKvGqeOBUOzHMdPpMTJmF1mQKc1ovCZYZb0S/C', 'signed_in', NULL);

-- Cat profiles (no embeddings yet — will be generated on first sighting confirmation)
INSERT INTO cat_profiles (id, name, photos, tnr_status, coat_color, pattern_type, notable_markings, ear_tip_status, body_size, created_by) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Whiskers',
     '["https://placekitten.com/400/400"]'::jsonb,
     'completed', 'orange', 'tabby', 'White patch on chest, striped tail', true, 'medium',
     'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002', 'Shadow',
     '["https://placekitten.com/401/401"]'::jsonb,
     'needs_tnr', 'black', 'solid', NULL, false, 'small',
     'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000003', 'Luna',
     '["https://placekitten.com/402/402"]'::jsonb,
     'unassessed', 'gray', 'tuxedo', 'White belly and paws', false, 'medium',
     'a0000000-0000-0000-0000-000000000003'),
    ('b0000000-0000-0000-0000-000000000004', 'Marmalade',
     '["https://placekitten.com/403/403"]'::jsonb,
     'scheduled', 'orange', 'calico', NULL, false, 'large',
     'a0000000-0000-0000-0000-000000000001');

-- Sighting drafts (one active, one expired)
INSERT INTO sighting_drafts (id, user_id, photo_url, location, blurred_location, observed_at, condition_tags, coat_color, pattern_type, draft_expires_at) VALUES
    ('c0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000003',
     'https://placekitten.com/500/500',
     ST_SetSRID(ST_MakePoint(-74.006, 40.7128), 4326),
     ST_SetSRID(ST_MakePoint(-74.0061, 40.7129), 4326),
     NOW() - INTERVAL '10 minutes',
     '["healthy", "friendly"]'::jsonb,
     'orange', 'tabby',
     NOW() + INTERVAL '20 minutes');

-- Confirmed sightings
INSERT INTO sightings (id, cat_profile_id, user_id, photo_url, location, blurred_location, observed_at, condition_tags, coat_color, pattern_type, notable_markings, ear_tip_status, body_size, notes) VALUES
    ('d0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'https://placekitten.com/400/400',
     ST_SetSRID(ST_MakePoint(-74.006, 40.7128), 4326),
     ST_SetSRID(ST_MakePoint(-74.0061, 40.7129), 4326),
     NOW() - INTERVAL '3 days',
     '["healthy", "friendly", "eating"]'::jsonb,
     'orange', 'tabby', 'White patch on chest, striped tail', true, 'medium',
     'Spotted near the park bench, very friendly'),
    ('d0000000-0000-0000-0000-000000000002',
     'b0000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000002',
     'https://placekitten.com/401/401',
     ST_SetSRID(ST_MakePoint(-74.007, 40.7138), 4326),
     ST_SetSRID(ST_MakePoint(-74.0071, 40.7139), 4326),
     NOW() - INTERVAL '1 day',
     '["skittish", "hiding"]'::jsonb,
     'black', 'solid', NULL, false, 'small',
     'Hiding under the dumpster, very shy');

-- Feeding spots
INSERT INTO feeding_spots (id, user_id, location, blurred_location, details) VALUES
    ('e0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000002',
     ST_SetSRID(ST_MakePoint(-74.0065, 40.713), 4326),
     ST_SetSRID(ST_MakePoint(-74.0066, 40.7131), 4326),
     '{"description": "Under the red awning", "schedule": "Daily 7am and 6pm", "food_type": "dry kibble"}'::jsonb);

-- TNR records
INSERT INTO tnr_records (id, cat_profile_id, user_id, content, status_change) VALUES
    ('f0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'Trapped on Jan 15, taken to clinic for neutering',
     'completed');

-- Verification requests (one pending)
INSERT INTO verification_requests (id, user_id, evidence, status) VALUES
    ('f0000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000004',
     'I volunteer at the local TNR clinic and have been doing community cat care for 3 years',
     'pending');
