# Requirements Document

## Introduction

Purrsona v1 is a community cat tracker enabling shared sightings, persistent cat profiles, welfare mapping, and TNR coordination for stray and community cats. The system comprises a Next.js (TypeScript) frontend, a FastAPI (Python) backend, PostgreSQL with pgvector for embedding-based cat matching, S3-compatible image storage, and a two-stage matching pipeline using metadata filtering and MegaDescriptor fur pattern embeddings. The platform supports three access tiers (public, signed-in, verified), a publish-first moderation model with user reporting, and a live public map with blurred coordinates.

## Glossary

- **Purrsona_System**: The full-stack application comprising the Next.js frontend, FastAPI backend, PostgreSQL database, image storage service, and MegaDescriptor embedding pipeline
- **Frontend**: The Next.js (React, TypeScript) client application served to users
- **Backend_API**: The FastAPI (Python) service handling business logic, authentication, and data persistence
- **Embedding_Service**: The subsystem that generates MegaDescriptor fur pattern embeddings (768-dimensional vectors) from cat photos and performs cosine similarity search via pgvector
- **Metadata_Filter**: The subsystem that compares structured cat metadata (coat color, pattern type, notable markings, ear tip status, body size) to pre-filter candidate Cat_Profiles before embedding comparison
- **Image_Store**: The S3-compatible object storage service for cat photos and sighting images
- **Cat_Profile**: A persistent record representing a likely individual community or stray cat, containing alias, photos, sighting history, status tags, feeding notes, TNR status, Cat_Metadata, and a MegaDescriptor fur pattern embedding
- **Sighting**: A user-submitted observation of a cat including a photo, map location, timestamp, at least one structured condition tag, and Cat_Metadata describing the observed cat
- **Feeding_Spot**: A map-based record for a known feeding location created by a signed-in user
- **TNR_Record**: A user-created post or record related to Trap-Neuter-Return activity for a cat
- **TNR_Status**: The current public welfare status on a Cat_Profile, restricted to one of six defined values
- **Public_Visitor**: An unauthenticated user who can browse the map and view public data
- **Signed_In_User**: An authenticated community user who can submit sightings, create feeding spots, create TNR records, and report content
- **Verified_User**: A verified caretaker or TNR volunteer who has all Signed_In_User permissions plus the ability to update TNR_Status on existing Cat_Profiles
- **Live_Map**: The public-facing interactive map displaying sightings, feeding spots, and TNR information with blurred coordinates
- **Cat_Metadata**: Structured descriptive attributes of a cat including coat color, pattern type (tabby, calico, tuxedo, solid, bicolor, tortoiseshell, pointed, other), notable markings, ear tip status, and body size (small, medium, large)
- **Match_Candidates**: Up to 3 existing Cat_Profiles returned by the two-stage matching pipeline (metadata filtering followed by MegaDescriptor embedding ranking) ordered by cosine similarity confidence
- **Design_System**: The foundational visual design tokens, component library specifications, and UI patterns guiding frontend implementation

## Requirements

### Requirement 1: Public Map Browsing

**User Story:** As a Public_Visitor, I want to browse a live map of cat sightings, feeding spots, and TNR information, so that I can see community cat activity in my area without creating an account.

#### Acceptance Criteria

1. THE Purrsona_System SHALL render the Live_Map as the primary view accessible without authentication
2. THE Live_Map SHALL display markers for Sightings, Feeding_Spots, and TNR-related information
3. THE Purrsona_System SHALL blur all public-facing location coordinates by applying a randomized offset within a 200-meter radius of the actual coordinates
4. THE Purrsona_System SHALL store exact coordinates in the database for future authorized workflows while serving only blurred coordinates to public API responses
5. WHEN a Public_Visitor selects a map marker, THE Frontend SHALL display a summary card with the associated Cat_Profile name, photo thumbnail, and timestamp

### Requirement 2: Cat Profile Viewing

**User Story:** As a Public_Visitor, I want to view detailed cat profiles, so that I can learn about individual community cats and their welfare history.

#### Acceptance Criteria

1. THE Purrsona_System SHALL maintain a public Cat_Profile for each identified cat
2. THE Cat_Profile SHALL display the following fields: name or alias, photo set, sighting history, status tags, feeding notes, and current TNR_Status
3. WHEN a Public_Visitor navigates to a Cat_Profile, THE Frontend SHALL display the sighting history in reverse chronological order
4. THE Backend_API SHALL serve Cat_Profile data without requiring authentication

### Requirement 3: User Authentication and Role Management

**User Story:** As a user, I want to create an account and have appropriate permissions based on my role, so that I can contribute to the community cat database.

#### Acceptance Criteria

1. THE Purrsona_System SHALL support three access tiers: Public_Visitor, Signed_In_User, and Verified_User
2. WHEN an unauthenticated user attempts to create content, THE Backend_API SHALL return an HTTP 401 response and THE Frontend SHALL redirect the user to the authentication flow
3. THE Backend_API SHALL enforce role-based access control on every mutation endpoint
4. THE Purrsona_System SHALL provide a verification workflow that elevates a Signed_In_User to Verified_User status
5. THE Backend_API SHALL include the user role in the authentication token claims

### Requirement 4: Sighting Submission

**User Story:** As a Signed_In_User, I want to submit cat sightings with photos and structured data, so that the community cat database grows with verified observations.

#### Acceptance Criteria

1. WHEN a Signed_In_User submits a sighting, THE Backend_API SHALL require a photo, map location, timestamp, at least one structured condition tag, and Cat_Metadata fields (coat color and pattern type)
2. THE Backend_API SHALL accept optional Cat_Metadata fields (notable markings, ear tip status, body size) on a sighting submission
3. THE Backend_API SHALL accept optional free-text notes on a sighting submission
4. WHEN a sighting photo is uploaded, THE Image_Store SHALL store the image and return a permanent reference URL
5. THE Backend_API SHALL store each confirmed sighting as an immutable historical record
6. THE Backend_API SHALL associate each sighting with exactly one Cat_Profile before marking submission as complete
7. WHEN a sighting submission is missing any required field, THE Backend_API SHALL return an HTTP 422 response specifying the missing fields

### Requirement 5: Cat Matching via Two-Stage Pipeline (Metadata + MegaDescriptor)

**User Story:** As a Signed_In_User, I want the system to suggest possible cat matches for my sighting photo and metadata, so that I can link my observation to existing cat profiles efficiently.

#### Acceptance Criteria

1. WHEN a sighting is submitted with Cat_Metadata, THE Metadata_Filter SHALL filter candidate Cat_Profiles by matching coat color, pattern type, ear tip status, and body size against stored Cat_Profile metadata
2. WHEN a sighting photo is submitted, THE Embedding_Service SHALL generate a 768-dimensional MegaDescriptor fur pattern embedding vector from the photo
3. THE Embedding_Service SHALL query pgvector using cosine similarity against stored Cat_Profile embeddings, restricted to the candidate set produced by the Metadata_Filter
4. THE Embedding_Service SHALL return at most 3 Match_Candidates ranked by descending cosine similarity score
5. WHEN fewer than 3 Cat_Profiles exist with similarity above a configured threshold within the metadata-filtered candidate set, THE Embedding_Service SHALL return only those candidates that meet the threshold
6. THE Frontend SHALL present Match_Candidates to the user alongside a "none of these" option
7. WHEN the user selects "none of these," THE Backend_API SHALL create a new Cat_Profile and associate the sighting with the new profile
8. WHEN the user confirms a Match_Candidate, THE Backend_API SHALL associate the sighting with the selected Cat_Profile
9. THE Purrsona_System SHALL treat all Embedding_Service and Metadata_Filter output as advisory and SHALL NOT automatically link sightings without explicit user confirmation

### Requirement 6: Cat Profile Creation

**User Story:** As a Signed_In_User, I want to create a new cat profile when my sighting does not match any existing cat, so that new community cats are documented.

#### Acceptance Criteria

1. WHEN a Signed_In_User selects "none of these" during sighting submission, THE Backend_API SHALL create a new Cat_Profile
2. THE Backend_API SHALL initialize the new Cat_Profile with the sighting photo, location, timestamp, structured tags, and Cat_Metadata (coat color, pattern type, notable markings, ear tip status, body size) from the originating sighting
3. THE Embedding_Service SHALL generate and store a 768-dimensional MegaDescriptor fur pattern embedding for the new Cat_Profile to enable future matching
4. THE Backend_API SHALL store the Cat_Metadata on the new Cat_Profile to enable future metadata filtering
5. THE Backend_API SHALL link the originating sighting as the first entry in the new Cat_Profile sighting history

### Requirement 7: Feeding Spot Management

**User Story:** As a Signed_In_User, I want to create feeding spot records on the map, so that the community can coordinate cat feeding locations.

#### Acceptance Criteria

1. WHEN a Signed_In_User submits a feeding spot, THE Backend_API SHALL create a Feeding_Spot record with the provided map location and details
2. THE Live_Map SHALL display all Feeding_Spots as distinct markers
3. THE Backend_API SHALL require authentication for Feeding_Spot creation
4. THE Purrsona_System SHALL blur Feeding_Spot coordinates on the Live_Map using the same offset method applied to sighting coordinates

### Requirement 8: TNR Record Creation

**User Story:** As a Signed_In_User, I want to create TNR-related records, so that I can document trap-neuter-return activity for community cats.

#### Acceptance Criteria

1. WHEN a Signed_In_User submits a TNR_Record, THE Backend_API SHALL store the record and associate it with the specified Cat_Profile
2. THE Backend_API SHALL require authentication for TNR_Record creation
3. THE Frontend SHALL display TNR_Records in the Cat_Profile welfare history

### Requirement 9: TNR Status Updates (Verified Only)

**User Story:** As a Verified_User, I want to update the TNR status on a cat profile, so that the public welfare information stays accurate and trustworthy.

#### Acceptance Criteria

1. THE Purrsona_System SHALL support exactly six TNR_Status values: Unassessed, Needs TNR, Scheduled, In progress, Completed, and Ear-tipped
2. WHEN a Verified_User submits a TNR_Status change, THE Backend_API SHALL update the Cat_Profile current TNR_Status
3. IF a Signed_In_User without verified role attempts to update TNR_Status, THEN THE Backend_API SHALL return an HTTP 403 response
4. THE Cat_Profile SHALL display at most one current TNR_Status at any time
5. THE Live_Map SHALL reflect TNR_Status on relevant map markers

### Requirement 10: Content Reporting and Moderation

**User Story:** As a Signed_In_User, I want to report inaccurate or abusive content, so that the community data stays trustworthy and safe.

#### Acceptance Criteria

1. THE Purrsona_System SHALL publish user-submitted content immediately upon successful submission
2. WHEN a Signed_In_User submits a content report, THE Backend_API SHALL store the report with a reference to the reported content, the reporter identity, and a reason category
3. THE Backend_API SHALL require authentication for report submission
4. IF a Public_Visitor attempts to submit a report, THEN THE Backend_API SHALL return an HTTP 401 response
5. THE Purrsona_System SHALL treat Embedding_Service confidence scores as advisory only and SHALL NOT use confidence scores for automated content moderation decisions

### Requirement 11: Image Storage and Retrieval

**User Story:** As a user, I want uploaded cat photos to be reliably stored and quickly retrievable, so that cat profiles display accurate visual information.

#### Acceptance Criteria

1. WHEN a photo is uploaded, THE Backend_API SHALL store the image in the Image_Store and persist the reference URL in the database
2. THE Image_Store SHALL serve stored images via HTTPS URLs accessible to all users without authentication
3. THE Backend_API SHALL validate uploaded images for supported format (JPEG, PNG, WebP) and maximum file size (10 MB) before storage
4. IF an uploaded image exceeds 10 MB or uses an unsupported format, THEN THE Backend_API SHALL return an HTTP 422 response specifying the validation failure

### Requirement 12: Database and Embedding Storage

**User Story:** As the development team, I want cat embeddings and metadata stored in pgvector alongside relational data, so that the two-stage matching pipeline is fast and co-located with application data.

#### Acceptance Criteria

1. THE Backend_API SHALL store 768-dimensional MegaDescriptor fur pattern embedding vectors in PostgreSQL using the pgvector extension
2. THE Embedding_Service SHALL use cosine similarity as the distance metric for cat matching queries
3. THE Backend_API SHALL store exact geographic coordinates in PostgreSQL for all location-bearing entities
4. THE Backend_API SHALL index embedding vectors to support sub-second similarity search across the Cat_Profile corpus
5. THE Backend_API SHALL store Cat_Metadata (coat color, pattern type, notable markings, ear tip status, body size) as structured columns on the Cat_Profile record to support metadata-based pre-filtering

### Requirement 13: API Architecture

**User Story:** As the development team, I want a well-structured REST API, so that the frontend and backend communicate through clear, versioned contracts.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a versioned REST API (prefixed with /api/v1)
2. THE Backend_API SHALL return JSON responses with consistent error structures including status code, error type, and human-readable message
3. THE Backend_API SHALL validate all request payloads against defined schemas and return HTTP 422 for validation failures
4. THE Backend_API SHALL implement rate limiting on mutation endpoints to prevent abuse

### Requirement 14: Frontend Application Architecture

**User Story:** As the development team, I want a performant, accessible frontend, so that users on various devices can interact with the platform smoothly.

#### Acceptance Criteria

1. THE Frontend SHALL be built with Next.js using TypeScript and React
2. THE Frontend SHALL implement server-side rendering for public pages (Live_Map, Cat_Profile) to support search engine indexing
3. THE Frontend SHALL be responsive across viewport widths from 320px to 2560px
4. THE Frontend SHALL meet WCAG 2.1 Level AA accessibility standards for all interactive components
5. WHEN the Backend_API is unreachable, THE Frontend SHALL display a user-friendly error state with retry guidance

### Requirement 15: Design System Foundation

**User Story:** As the development team, I want a documented design system with tokens and component specifications, so that the UI is consistent and maintainable across the application.

#### Acceptance Criteria

1. THE Design_System SHALL define color tokens including primary, secondary, neutral, success, warning, and error palettes with light and dark mode variants
2. THE Design_System SHALL define typography tokens including font family, size scale (at least 6 sizes), line heights, and font weights
3. THE Design_System SHALL define spacing tokens using a consistent base unit (4px or 8px grid)
4. THE Design_System SHALL define border radius, shadow, and elevation tokens
5. THE Design_System SHALL specify component patterns for: buttons (primary, secondary, ghost), form inputs, cards, modals, map markers, navigation bar, and status badges
6. THE Design_System SHALL define an icon set specification covering map, cat welfare, navigation, and action categories
7. THE Design_System SHALL specify interactive states (default, hover, focus, active, disabled) for all interactive components
8. THE Design_System SHALL define responsive breakpoints at 320px, 768px, 1024px, and 1440px minimum

### Requirement 16: Deployment and Development Environment

**User Story:** As the development team, I want a containerized development environment, so that local setup is reproducible and consistent across machines.

#### Acceptance Criteria

1. THE Purrsona_System SHALL provide a Docker Compose configuration that runs the Frontend, Backend_API, PostgreSQL (with pgvector), and a local S3-compatible storage service
2. WHEN a developer runs the Docker Compose configuration, THE Purrsona_System SHALL start all services with seeded test data within 120 seconds on a standard development machine
3. THE Purrsona_System SHALL provide container image definitions suitable for production deployment via container orchestration
4. THE Backend_API SHALL read all configuration values (database credentials, storage endpoints, model paths) from environment variables
