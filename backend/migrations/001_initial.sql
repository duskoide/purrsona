-- Purrsona v1 — Initial Schema
-- PostgreSQL 16 + pgvector + PostGIS

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enum types
CREATE TYPE user_role AS ENUM ('public', 'signed_in', 'verified');
CREATE TYPE tnr_status_enum AS ENUM (
    'unassessed', 'needs_tnr', 'scheduled',
    'in_progress', 'completed', 'ear_tipped'
);
CREATE TYPE report_reason AS ENUM (
    'inaccurate', 'abusive', 'unsafe', 'other'
);
CREATE TYPE coat_color_enum AS ENUM (
    'black', 'white', 'orange', 'gray', 'brown',
    'cream', 'mixed_black_white', 'mixed_orange_white', 'other'
);
CREATE TYPE pattern_type_enum AS ENUM (
    'tabby', 'calico', 'tuxedo', 'solid', 'bicolor',
    'tortoiseshell', 'pointed', 'other'
);
CREATE TYPE body_size_enum AS ENUM ('small', 'medium', 'large');

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'signed_in',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

-- Cat profiles
CREATE TABLE cat_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    photos JSONB NOT NULL DEFAULT '[]',
    tnr_status tnr_status_enum NOT NULL DEFAULT 'unassessed',
    -- Cat_Metadata for filtering
    coat_color coat_color_enum,
    pattern_type pattern_type_enum,
    notable_markings TEXT,
    ear_tip_status BOOLEAN NOT NULL DEFAULT FALSE,
    body_size body_size_enum,
    -- MegaDescriptor embedding (768-dim, Swin-Tiny)
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Sighting drafts (ephemeral, 30-min TTL)
CREATE TABLE sighting_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    photo_url VARCHAR(1024) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    blurred_location GEOMETRY(Point, 4326) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    condition_tags JSONB NOT NULL,
    coat_color coat_color_enum NOT NULL,
    pattern_type pattern_type_enum NOT NULL,
    notable_markings TEXT,
    ear_tip_status BOOLEAN,
    body_size body_size_enum,
    notes TEXT,
    embedding vector(768),
    match_candidates JSONB NOT NULL DEFAULT '[]',
    draft_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Confirmed sightings (immutable)
CREATE TABLE sightings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cat_profile_id UUID NOT NULL REFERENCES cat_profiles(id),
    user_id UUID NOT NULL REFERENCES users(id),
    photo_url VARCHAR(1024) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    blurred_location GEOMETRY(Point, 4326) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    condition_tags JSONB NOT NULL,
    -- Cat_Metadata captured at sighting time
    coat_color coat_color_enum,
    pattern_type pattern_type_enum,
    notable_markings TEXT,
    ear_tip_status BOOLEAN,
    body_size body_size_enum,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feeding spots
CREATE TABLE feeding_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    location GEOMETRY(Point, 4326) NOT NULL,
    blurred_location GEOMETRY(Point, 4326) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TNR records
CREATE TABLE tnr_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cat_profile_id UUID NOT NULL REFERENCES cat_profiles(id),
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    status_change tnr_status_enum,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verification requests
CREATE TABLE verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    evidence TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Content reports (polymorphic)
CREATE TABLE content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    reason report_reason NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cat_profiles_embedding ON cat_profiles
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_cat_profiles_coat_color ON cat_profiles(coat_color);
CREATE INDEX idx_cat_profiles_pattern_type ON cat_profiles(pattern_type);
CREATE INDEX idx_cat_profiles_ear_tip_status ON cat_profiles(ear_tip_status);
CREATE INDEX idx_cat_profiles_body_size ON cat_profiles(body_size);
CREATE INDEX idx_sightings_cat_profile ON sightings(cat_profile_id);
CREATE INDEX idx_sightings_observed_at ON sightings(observed_at DESC);
CREATE INDEX idx_feeding_spots_location ON feeding_spots USING GIST(blurred_location);
CREATE INDEX idx_sightings_location ON sightings USING GIST(blurred_location);
CREATE INDEX idx_sighting_drafts_expires ON sighting_drafts(draft_expires_at);
CREATE INDEX idx_verification_requests_status ON verification_requests(status);
