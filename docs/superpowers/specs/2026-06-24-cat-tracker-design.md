# Purrsona Functional Specification

Date: 2026-06-24
Status: Draft approved for review

## Summary

Purrsona is a community cat tracker focused on stray and community cat identification and welfare mapping. The v1 product allows the public to browse a live map of cat-related activity while signed-in users contribute sightings, feeding spots, and TNR-related records. Cat recognition is assistive: the system suggests up to 3 likely cat matches for each new sighting, and the user confirms whether the sighting belongs to an existing cat or should create a new cat profile.

This specification is intentionally limited to functional requirements. It does not define implementation architecture, technical stack, visual design, or tooling choices.

## Product Goals

The product must support these core goals in v1:

1. Help the community document stray and community cats through shared sightings.
2. Build persistent cat profiles over time from repeated, user-confirmed sightings.
3. Show a live public map of sightings, feeding spots, and TNR-related welfare information.
4. Support welfare coordination without requiring a heavy operations system in v1.
5. Keep sensitive updates, especially TNR status changes, restricted to trusted user roles.

## Roles And Permissions

### Public visitors

Public visitors can:

1. Browse the live map.
2. View cat profiles.
3. View public sighting history, feeding spot records, and public TNR information.

Public visitors cannot:

1. Create records.
2. Edit records.
3. Report content.

### Signed-in community users

Signed-in community users can:

1. Submit new sightings.
2. Submit new feeding spots.
3. Create new cat-related records when a sighting does not match an existing cat.
4. Create new TNR-related records or posts.
5. Report inappropriate or inaccurate public content.

Signed-in community users cannot:

1. Change an existing cat's current TNR status.

### Verified caretakers and TNR volunteers

Verified caretakers and TNR volunteers can:

1. Do everything signed-in community users can do.
2. Update an existing cat's current TNR status.
3. Revise public welfare state when new verified care information is available.

### Permission rules

1. Browsing is open to everyone.
2. Posting requires an authenticated account.
3. Sensitive updates are controlled by user role and verification status, not by match confidence or posting history.
4. Moderation is lightweight in v1: content publishes immediately and can later be reported for review.

## Core Entities

### Cat profile

A cat profile represents a likely individual community or stray cat.

Each cat profile must support these public fields:

1. Name or alias.
2. Photo set.
3. Sighting history.
4. Status tags.
5. Feeding notes.
6. Current TNR status.

A cat profile is created when a submitted sighting is confirmed as not matching any suggested existing cat.

### Sighting

A sighting is a user-submitted observation of a cat at a place and time.

Each sighting must include:

1. Photo.
2. Map location.
3. Timestamp.
4. At least one structured condition or status tag.

Each sighting may include:

1. Optional free-text notes.

Each sighting must be linked to exactly one cat profile before submission is completed.

### Feeding spot

A feeding spot is a map-based record for a known feeding location.

Any signed-in user can create a feeding spot.

### TNR record and TNR status

TNR-related data has two functional parts:

1. TNR-related records or posts, which any signed-in user may create.
2. The current TNR status shown on a cat profile, which only verified caretakers or TNR volunteers may change.

V1 must support these public-facing TNR status values:

1. Unassessed.
2. Needs TNR.
3. Scheduled.
4. In progress.
5. Completed.
6. Ear-tipped.

Each cat must have at most one current public TNR status at a time.

## Core User Flows

### Browse the map

1. Any visitor can open the app and browse a live public map.
2. The map shows sightings, feeding spots, and public TNR-related information.
3. Public map markers use blurred locations rather than exact coordinates.

### Submit a sighting

1. A signed-in user uploads a photo.
2. The user provides location, timestamp, structured status tags, and optional notes.
3. The app analyzes the sighting and returns up to 3 possible cat matches ranked by confidence.
4. The user must choose one suggested cat or select `none of these`.
5. If the user selects `none of these`, the system creates a new cat profile.
6. The confirmed sighting is stored in the selected or newly created cat profile history.

### View a cat profile

1. Any visitor can open a public cat profile.
2. The profile shows photos, known aliases, sighting history, welfare or status tags, feeding notes, and current public TNR status.

### Add a feeding spot

1. A signed-in user can create a feeding spot record on the map.

### Add or update TNR information

1. A signed-in user can create a new TNR-related record or post.
2. Only verified caretakers or verified volunteers can update the current TNR status shown on a cat profile.

### Report problematic content

1. A signed-in user can report inaccurate, abusive, or unsafe public content after publication.

## Functional Requirements

### Authentication and access

1. The system must allow anonymous users to browse public map and cat profile data.
2. The system must require authentication before a user can create any sighting, feeding spot, or TNR-related record.
3. The system must support a verified role for caretakers and TNR volunteers.

### Sighting submission

1. The system must require a photo, map location, timestamp, and at least one structured condition or status tag for every sighting.
2. The system must allow optional free-text notes on a sighting.
3. The system must store each sighting as a permanent historical record.
4. The system must associate each sighting with exactly one cat profile after submission is completed.

### Cat matching

1. The system must analyze each submitted sighting photo and return up to 3 possible cat matches ranked by confidence.
2. The system must require the submitting user to either select one suggested cat or choose `none of these`.
3. The system must not automatically merge or attach sightings without user confirmation.
4. The system must create a new cat profile when the user selects `none of these`.

### Cat profiles

1. The system must maintain a public profile for each identified cat.
2. The system must support cat profile fields for alias or name, photos, sighting history, status tags, feeding notes, and current TNR status.
3. The system must update profile history as new confirmed sightings are linked.

### Feeding spots

1. The system must allow any signed-in user to create a feeding spot record.
2. The system must display feeding spots on the public map.

### TNR tracking

1. The system must allow any signed-in user to create a TNR-related record or post.
2. The system must restrict changes to an existing cat's current TNR status to verified caretakers or verified volunteers only.
3. The system must display the current public TNR status on cat profiles and on the map where relevant.

### Map behavior

1. The system must provide a live public map view containing sightings, feeding spots, and TNR-related information.
2. The system must blur public-facing locations rather than expose exact coordinates.
3. The system must preserve enough location fidelity to support future authorized workflows, even though those workflows are not part of the v1 product scope.

### Moderation and safety

1. The system must publish user-submitted content immediately.
2. The system must allow signed-in users to report inaccurate, abusive, or unsafe content for review.
3. The system must treat computer vision output as advisory only, not as permission or moderation authority.

## V1 Boundaries

### Included in v1

1. Public browsing of map and cat profiles.
2. Account-based posting.
3. Sighting submission with required structured fields.
4. Cat match suggestions capped at 3 candidates.
5. Human-confirmed sighting linking.
6. Public feeding spots.
7. Public TNR tracking with restricted status updates.
8. User reporting for moderation.
9. Blurred public map locations.

### Not included in v1

1. Fully automatic cat identity resolution.
2. Anonymous posting.
3. Pre-publication moderation queues.
4. Private caretaker notes.
5. Task assignment or volunteer operations management.
6. Heavy admin back-office workflows.
7. Trust scoring based on reputation or algorithm confidence.

## Core Product Loop

The core v1 loop is:

1. A user reports a cat sighting.
2. The system suggests up to 3 possible identities.
3. The user confirms an existing cat or creates a new one.
4. The cat profile gains history and visibility on the map.
5. The community gradually builds welfare context through sightings, feeding spots, and TNR updates.
