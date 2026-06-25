# Design Document: Purrsona v1 Implementation

## Overview

Purrsona v1 is a community cat tracker comprising a Next.js frontend, FastAPI backend, PostgreSQL database with pgvector, S3-compatible image storage, and a two-stage cat matching pipeline (metadata filtering + MegaDescriptor fur pattern embeddings). The system supports public browsing, authenticated contributions, and role-gated welfare updates through a three-tier access model.

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Next.js Frontend (TypeScript/React)                           │ │
│  │  - SSR for public pages (Map, Cat Profiles)                    │ │
│  │  - CSR for authenticated flows (Sighting Submission)           │ │
│  │  - Interactive Map (Leaflet/MapLibre GL)                       │ │
│  └────────────────────────────────────┬───────────────────────────┘ │
└───────────────────────────────────────┼─────────────────────────────┘
                                        │ HTTPS / JSON
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  FastAPI Backend (Python)                                      │ │
│  │  /api/v1/*                                                     │ │
│  │  - Auth middleware (JWT)                                       │ │
│  │  - Rate limiting middleware                                    │ │
│  │  - Request validation (Pydantic)                               │ │
│  │  - Role-based access control                                   │ │
│  └──────┬────────────┬────────────┬────────────┬─────────────────┘ │
└─────────┼────────────┼────────────┼────────────┼───────────────────┘
          │            │            │            │
          ▼            ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────────────┐
│  PostgreSQL  │ │  Image   │ │ MegaDescriptor│ │  Auth Provider   │
│  + pgvector  │ │  Store   │ │    Model      │ │  (JWT issuer)    │
│              │ │  (S3)    │ │   Service     │ │                  │
└──────────────┘ └──────────┘ └───────────────┘ └──────────────────┘
```

### Component Breakdown

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Frontend | Next.js 14+, TypeScript, React 18 | UI rendering, SSR, map interaction, form handling |
| Backend API | Python 3.11+, FastAPI, Pydantic | REST API, business logic, auth, validation |
| Database | PostgreSQL 16 + pgvector | Relational data, embedding vectors, spatial data |
| Image Store | MinIO (dev) / S3 (prod) | Photo storage, public URL serving |
| Metadata Filter | SQL-based pre-filter | Narrows candidate set by coat color, pattern, ear tip, body size |
| Embedding Service | MegaDescriptor (ViT-B/14), in-process | 768-dim fur pattern embedding generation, cosine similarity search |
| Auth | JWT-based, role claims | Authentication, authorization |

### Request Flow: Sighting Submission

```
User → Frontend → POST /api/v1/sightings/initiate
                     │
                     ├─ Upload photo → Image Store → reference URL
                     ├─ Stage 1: Metadata Filter (coat_color, pattern_type,
                     │           ear_tip_status, body_size) → candidate subset
                     ├─ Stage 2: Generate MegaDescriptor embedding (768-dim)
                     │           → pgvector cosine search on filtered subset
                     ├─ Return top-3 Match_Candidates
                     │
User ← Frontend ← Match candidates + "none of these"
                     │
User → Frontend → POST /api/v1/sightings/confirm
                     │
                     ├─ If match selected → link sighting to Cat_Profile
                     ├─ If "none of these" → create Cat_Profile + link
                     └─ Store immutable sighting record
```

## Data Models

### Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    users     │       │   cat_profiles   │       │    sightings     │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (UUID PK) │       │ id (UUID PK)     │       │ id (UUID PK)     │
│ email        │       │ name             │       │ cat_profile_id   │──→
│ role (enum)  │       │ photos (JSONB)   │       │ user_id (FK)     │
│ created_at   │       │ tnr_status(enum) │       │ photo_url        │
│ verified_at  │       │ coat_color(enum) │       │ location (point) │
└──────────────┘       │ pattern_type(enum)│      │ blurred_location │
       │               │ notable_markings │       │ observed_at      │
       │               │ ear_tip_status   │       │ condition_tags   │
       │               │ body_size (enum) │       │ coat_color(enum) │
       │               │ embedding(vec768)│       │ pattern_type(enum)│
       │               │ created_at       │       │ notable_markings │
       │               │ created_by (FK)  │       │ ear_tip_status   │
       ▼               └──────────────────┘       │ body_size (enum) │
┌──────────────────┐   ┌──────────────────┐       │ notes (nullable) │
│  feeding_spots   │   │   tnr_records    │       │ created_at       │
├──────────────────┤   ├──────────────────┤       └──────────────────┘
│ id (UUID PK)     │   │ id (UUID PK)     │
│ user_id (FK)     │   │ cat_profile_id   │
│ location (point) │   │ user_id (FK)     │
│ details (JSONB)  │   │ content (text)   │
│ created_at       │   │ status_change    │
└──────────────────┘   │ created_at       │
                       └──────────────────┘
┌──────────────────┐
│ content_reports  │
├──────────────────┤
│ id (UUID PK)     │
│ reporter_id (FK) │
│ content_type     │
│ content_id (UUID)│
│ reason (enum)    │
│ created_at       │
└──────────────────┘
```

### Database Schema (PostgreSQL + pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;

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

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'signed_in',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

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
    -- MegaDescriptor embedding (768-dim)
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

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

CREATE TABLE feeding_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    location GEOMETRY(Point, 4326) NOT NULL,
    blurred_location GEOMETRY(Point, 4326) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tnr_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cat_profile_id UUID NOT NULL REFERENCES cat_profiles(id),
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    status_change tnr_status_enum,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    reason report_reason NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
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
```

## API Contracts

### Authentication

All mutation endpoints require a Bearer JWT token in the `Authorization` header. Public read endpoints do not require authentication.

**JWT Claims Structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "signed_in | verified",
  "iat": 1700000000,
  "exp": 1700086400
}
```

### Error Response Format

All API errors follow a consistent structure:

```json
{
  "error": {
    "status_code": 422,
    "error_type": "validation_error",
    "message": "Human-readable description",
    "details": [
      {"field": "photo", "message": "This field is required"}
    ]
  }
}
```

### Endpoints

#### Map & Browsing (Public)

```
GET /api/v1/map/markers
  Query: ?bounds=sw_lat,sw_lng,ne_lat,ne_lng&types=sighting,feeding_spot,tnr
  Response 200:
    {
      "markers": [
        {
          "id": "uuid",
          "type": "sighting | feeding_spot | tnr",
          "location": {"lat": 40.7128, "lng": -74.0060},  // blurred
          "cat_profile": {"id": "uuid", "name": "Whiskers", "photo_url": "..."},
          "timestamp": "2024-01-15T10:30:00Z",
          "tnr_status": "completed"  // if applicable
        }
      ]
    }
```

#### Cat Profiles (Public)

```
GET /api/v1/cats/{cat_id}
  Response 200:
    {
      "id": "uuid",
      "name": "Whiskers",
      "photos": ["url1", "url2"],
      "tnr_status": "needs_tnr",
      "sighting_history": [
        {
          "id": "uuid",
          "photo_url": "...",
          "location": {"lat": 40.71, "lng": -74.00},
          "observed_at": "2024-01-15T10:30:00Z",
          "condition_tags": ["healthy", "friendly"]
        }
      ],
      "feeding_notes": [...],
      "status_tags": [...]
    }

GET /api/v1/cats
  Query: ?page=1&per_page=20
  Response 200: { "cats": [...], "total": 42, "page": 1, "per_page": 20 }
```

#### Sighting Submission (Authenticated)

```
POST /api/v1/sightings/initiate
  Headers: Authorization: Bearer <token>
  Body (multipart/form-data):
    {
      "photo": <file>,
      "latitude": 40.7128,
      "longitude": -74.0060,
      "observed_at": "2024-01-15T10:30:00Z",
      "condition_tags": ["healthy", "friendly"],
      "coat_color": "orange",
      "pattern_type": "tabby",
      "notable_markings": "white patch on chest",  // optional
      "ear_tip_status": false,                     // optional
      "body_size": "medium",                       // optional
      "notes": "Spotted near the park bench"       // optional
    }
  Response 200:
    {
      "sighting_draft_id": "uuid",
      "photo_url": "https://storage.example.com/photos/abc.jpg",
      "match_candidates": [
        {
          "cat_profile_id": "uuid",
          "name": "Whiskers",
          "photo_url": "...",
          "similarity_score": 0.87
        }
      ]
    }
  Response 401: Unauthenticated
  Response 422: Validation failure (missing required fields)

POST /api/v1/sightings/confirm
  Headers: Authorization: Bearer <token>
  Body:
    {
      "sighting_draft_id": "uuid",
      "selected_cat_profile_id": "uuid" | null  // null = "none of these"
    }
  Response 201:
    {
      "sighting_id": "uuid",
      "cat_profile_id": "uuid",
      "is_new_profile": false
    }
  Response 401: Unauthenticated
  Response 404: Draft not found
```

#### Feeding Spots (Authenticated)

```
POST /api/v1/feeding-spots
  Headers: Authorization: Bearer <token>
  Body:
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "details": {
        "description": "Under the red awning",
        "schedule": "Daily 7am and 6pm",
        "food_type": "dry kibble"
      }
    }
  Response 201: { "id": "uuid", "created_at": "..." }
  Response 401: Unauthenticated
  Response 422: Validation failure
```

#### TNR Records (Authenticated)

```
POST /api/v1/tnr-records
  Headers: Authorization: Bearer <token>
  Body:
    {
      "cat_profile_id": "uuid",
      "content": "Trapped on Jan 15, taken to clinic"
    }
  Response 201: { "id": "uuid", "created_at": "..." }
  Response 401: Unauthenticated

PATCH /api/v1/cats/{cat_id}/tnr-status
  Headers: Authorization: Bearer <token>  (must be verified role)
  Body:
    {
      "status": "completed"
    }
  Response 200: { "cat_profile_id": "uuid", "tnr_status": "completed" }
  Response 401: Unauthenticated
  Response 403: Insufficient role (not verified)
  Response 422: Invalid status value
```

#### Content Reports (Authenticated)

```
POST /api/v1/reports
  Headers: Authorization: Bearer <token>
  Body:
    {
      "content_type": "sighting | feeding_spot | tnr_record | cat_profile",
      "content_id": "uuid",
      "reason": "inaccurate | abusive | unsafe | other",
      "details": "Optional description"
    }
  Response 201: { "id": "uuid", "created_at": "..." }
  Response 401: Unauthenticated
```

#### Authentication

```
POST /api/v1/auth/register
  Body: { "email": "...", "password": "..." }
  Response 201: { "user_id": "uuid", "token": "jwt..." }

POST /api/v1/auth/login
  Body: { "email": "...", "password": "..." }
  Response 200: { "token": "jwt...", "role": "signed_in" }

POST /api/v1/auth/verify-request
  Headers: Authorization: Bearer <token>
  Body: { "evidence": "..." }
  Response 202: { "message": "Verification request submitted" }
```

## Components and Interfaces

### Backend Components

```python
# === Service Layer Interfaces ===

class ISightingService(Protocol):
    """Manages sighting lifecycle: initiation, matching, confirmation."""
    async def initiate_sighting(
        self, user_id: str, photo: UploadFile, location: Coordinate,
        observed_at: datetime, condition_tags: list[str],
        metadata: CatMetadata, notes: str | None
    ) -> SightingDraft: ...

    async def confirm_sighting(
        self, user_id: str, draft_id: str, selected_cat_id: str | None
    ) -> ConfirmedSighting: ...

class IEmbeddingService(Protocol):
    """Generates MegaDescriptor fur pattern embeddings and performs similarity search."""
    def generate_embedding(self, image: Image.Image) -> list[float]: ...
    async def find_matches(
        self, embedding: list[float], metadata: CatMetadata,
        metadata_filter: IMetadataFilterService, db_session: AsyncSession
    ) -> list[MatchCandidate]: ...

class IMetadataFilterService(Protocol):
    """Pre-filters candidate Cat_Profiles by structured metadata (Stage 1)."""
    def build_filter_query(self, metadata: CatMetadata) -> tuple[str, list]: ...

class IImageService(Protocol):
    """Handles image upload, validation, and storage."""
    async def upload_image(self, file: UploadFile) -> str: ...
    def validate_image(self, content_type: str, size: int) -> ValidationResult: ...

class ICatProfileService(Protocol):
    """Manages cat profile CRUD and embedding updates."""
    async def get_profile(self, cat_id: str) -> CatProfile: ...
    async def create_profile(self, sighting: SightingDraft) -> CatProfile: ...
    async def update_tnr_status(
        self, cat_id: str, status: str, user: User
    ) -> CatProfile: ...

class IMapService(Protocol):
    """Provides blurred map data for public consumption."""
    async def get_markers(self, bounds: BoundingBox, types: list[str]) -> list[MapMarker]: ...

class IReportService(Protocol):
    """Handles content reporting."""
    async def submit_report(
        self, reporter_id: str, content_type: str,
        content_id: str, reason: str, details: str | None
    ) -> Report: ...

class IAuthService(Protocol):
    """Manages authentication and authorization."""
    async def register(self, email: str, password: str) -> tuple[User, str]: ...
    async def login(self, email: str, password: str) -> tuple[User, str]: ...
    def verify_token(self, token: str) -> TokenClaims: ...
    async def request_verification(self, user_id: str, evidence: str) -> None: ...
```

### Frontend Components

```typescript
// === Page-Level Components ===

interface LiveMapPageProps {
  initialMarkers: MapMarker[];
}

interface CatProfilePageProps {
  cat: CatProfile;
  sightings: Sighting[];
  tnrRecords: TnrRecord[];
}

// === Shared Component Interfaces ===

interface MarkerClusterProps {
  markers: MapMarker[];
  onMarkerClick: (id: string) => void;
}

interface SightingFormProps {
  onSubmit: (data: SightingFormData) => Promise<void>;
  isLoading: boolean;
}

interface MatchSelectionProps {
  candidates: MatchCandidate[];
  onSelect: (catId: string | null) => void;
}

interface CatCardProps {
  cat: CatProfileSummary;
  onClick: () => void;
}

interface ReportModalProps {
  contentType: string;
  contentId: string;
  onSubmit: (reason: string, details?: string) => Promise<void>;
  onClose: () => void;
}

// === Hook Interfaces ===

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

interface UseMapMarkersReturn {
  markers: MapMarker[];
  isLoading: boolean;
  refetch: (bounds: BoundingBox) => void;
}
```

### Coordinate Blurring Interface

```python
class ICoordinateBlurService(Protocol):
    """Applies privacy-preserving offset to geographic coordinates."""
    def blur(self, exact: Coordinate) -> Coordinate: ...
    def compute_blurred_location(
        self, latitude: float, longitude: float
    ) -> tuple[float, float]: ...
```

## Core Algorithms

### Coordinate Blurring

The system applies a random offset within a 200m radius to protect exact locations while maintaining area fidelity.

```python
import math
import random
from dataclasses import dataclass

@dataclass
class Coordinate:
    latitude: float
    longitude: float

def blur_coordinate(exact: Coordinate) -> Coordinate:
    """Apply random offset within 200m radius.
    
    Uses uniform random bearing and distance to avoid
    clustering at the center (uses sqrt for uniform area distribution).
    """
    MAX_OFFSET_METERS = 200.0
    EARTH_RADIUS_METERS = 6_371_000.0

    # Uniform distribution over circular area
    distance = MAX_OFFSET_METERS * math.sqrt(random.random())
    bearing = random.uniform(0, 2 * math.pi)

    # Convert distance to angular offset
    angular_distance = distance / EARTH_RADIUS_METERS
    lat_rad = math.radians(exact.latitude)

    new_lat = math.asin(
        math.sin(lat_rad) * math.cos(angular_distance)
        + math.cos(lat_rad) * math.sin(angular_distance) * math.cos(bearing)
    )
    new_lng = math.radians(exact.longitude) + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat_rad),
        math.cos(angular_distance) - math.sin(lat_rad) * math.sin(new_lat),
    )

    return Coordinate(
        latitude=math.degrees(new_lat),
        longitude=math.degrees(new_lng),
    )


def haversine_distance(a: Coordinate, b: Coordinate) -> float:
    """Calculate distance in meters between two coordinates."""
    R = 6_371_000.0
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat = lat2 - lat1
    dlng = math.radians(b.longitude - a.longitude)
    h = (math.sin(dlat / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))
```

### MegaDescriptor Embedding & Two-Stage Cat Matching

```python
import torch
import timm
from PIL import Image
from torchvision import transforms
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class MatchCandidate:
    cat_profile_id: str
    name: str
    photo_url: str
    similarity_score: float

@dataclass
class CatMetadata:
    """Structured metadata for metadata-based pre-filtering."""
    coat_color: str          # enum: black, white, orange, gray, brown, cream, mixed_black_white, mixed_orange_white, other
    pattern_type: str        # enum: tabby, calico, tuxedo, solid, bicolor, tortoiseshell, pointed, other
    notable_markings: Optional[str] = None   # free-text
    ear_tip_status: Optional[bool] = None    # True if ear-tipped
    body_size: Optional[str] = None          # enum: small, medium, large


class MetadataFilterService:
    """Stage 1: Pre-filters candidate Cat_Profiles by structured metadata.
    
    Uses SQL WHERE clauses to narrow the candidate set before the more
    expensive embedding comparison. Only exact-match fields are used for
    filtering (coat_color, pattern_type, ear_tip_status, body_size).
    """

    def build_filter_query(self, metadata: CatMetadata) -> tuple[str, list]:
        """Build a SQL WHERE clause fragment from sighting metadata.
        
        Returns (where_clause, params) for composing into the similarity query.
        Filters only on non-None fields. coat_color and pattern_type are required.
        """
        conditions = []
        params = []
        param_idx = 1

        # Required filters (always present on sighting submission)
        conditions.append(f"coat_color = ${param_idx}")
        params.append(metadata.coat_color)
        param_idx += 1

        conditions.append(f"pattern_type = ${param_idx}")
        params.append(metadata.pattern_type)
        param_idx += 1

        # Optional filters (only applied if provided)
        if metadata.ear_tip_status is not None:
            conditions.append(f"ear_tip_status = ${param_idx}")
            params.append(metadata.ear_tip_status)
            param_idx += 1

        if metadata.body_size is not None:
            conditions.append(f"body_size = ${param_idx}")
            params.append(metadata.body_size)
            param_idx += 1

        where_clause = " AND ".join(conditions)
        return where_clause, params


class EmbeddingService:
    """Stage 2: Generates MegaDescriptor embeddings and performs similarity search.
    
    Uses MegaDescriptor (ViT-B/14) trained specifically for animal
    re-identification. Produces 768-dimensional fur pattern embeddings
    optimized for distinguishing individual animals by visual appearance.
    """
    SIMILARITY_THRESHOLD: float = 0.65
    MAX_CANDIDATES: int = 3

    def __init__(self, model_name: str = "hf-hub:BVRA/MegaDescriptor-T-224"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = timm.create_model(model_name, pretrained=True)
        self.model = self.model.to(self.device).eval()
        
        # Standard preprocessing for ViT-B/14 (224x224 input)
        self.preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

    def generate_embedding(self, image: Image.Image) -> List[float]:
        """Generate a 768-dimensional MegaDescriptor embedding from an image."""
        preprocessed = self.preprocess(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            embedding = self.model(preprocessed)
            embedding = embedding / embedding.norm(dim=-1, keepdim=True)
        return embedding.cpu().numpy().flatten().tolist()

    async def find_matches(
        self,
        embedding: List[float],
        metadata: CatMetadata,
        metadata_filter: MetadataFilterService,
        db_session,
    ) -> List[MatchCandidate]:
        """Two-stage matching: metadata filter → cosine similarity on filtered subset.
        
        Stage 1: SQL WHERE clauses filter by coat_color, pattern_type,
                 ear_tip_status, body_size to narrow candidate set.
        Stage 2: pgvector cosine similarity on the metadata-filtered subset.
        """
        # Stage 1: Build metadata filter
        where_clause, filter_params = metadata_filter.build_filter_query(metadata)

        # Stage 2: Cosine similarity on filtered subset
        embedding_param_idx = len(filter_params) + 1
        threshold_param_idx = embedding_param_idx + 1
        limit_param_idx = threshold_param_idx + 1

        query = f"""
            SELECT id, name, photos, 
                   1 - (embedding <=> ${embedding_param_idx}::vector) AS similarity
            FROM cat_profiles
            WHERE embedding IS NOT NULL
              AND {where_clause}
              AND 1 - (embedding <=> ${embedding_param_idx}::vector) >= ${threshold_param_idx}
            ORDER BY similarity DESC
            LIMIT ${limit_param_idx}
        """
        params = filter_params + [embedding, self.SIMILARITY_THRESHOLD, self.MAX_CANDIDATES]
        rows = await db_session.fetch(query, *params)
        return [
            MatchCandidate(
                cat_profile_id=str(row["id"]),
                name=row["name"] or "Unknown",
                photo_url=row["photos"][0] if row["photos"] else "",
                similarity_score=float(row["similarity"]),
            )
            for row in rows
        ]
```

### Image Validation

```python
from enum import Enum
from dataclasses import dataclass

class ImageFormat(str, Enum):
    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"

MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

SUPPORTED_FORMATS = {ImageFormat.JPEG, ImageFormat.PNG, ImageFormat.WEBP}

@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]

def validate_image(content_type: str, size_bytes: int) -> ValidationResult:
    """Validate image format and size constraints."""
    errors = []
    if content_type not in {f.value for f in SUPPORTED_FORMATS}:
        errors.append(
            f"Unsupported format '{content_type}'. "
            f"Supported: JPEG, PNG, WebP"
        )
    if size_bytes > MAX_IMAGE_SIZE_BYTES:
        errors.append(
            f"File size {size_bytes} bytes exceeds maximum of 10 MB"
        )
    return ValidationResult(valid=len(errors) == 0, errors=errors)
```

### Role-Based Access Control

```python
from enum import Enum
from functools import wraps
from fastapi import HTTPException, Depends

class UserRole(str, Enum):
    PUBLIC = "public"
    SIGNED_IN = "signed_in"
    VERIFIED = "verified"

# Permission matrix: endpoint → minimum required role
ROLE_HIERARCHY = {
    UserRole.PUBLIC: 0,
    UserRole.SIGNED_IN: 1,
    UserRole.VERIFIED: 2,
}

def require_role(minimum_role: UserRole):
    """Dependency that enforces minimum role for an endpoint."""
    def dependency(current_user = Depends(get_current_user)):
        if current_user is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        if ROLE_HIERARCHY[current_user.role] < ROLE_HIERARCHY[minimum_role]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency
```

### TNR Status Management

```python
from typing import Optional

VALID_TNR_STATUSES = frozenset([
    "unassessed", "needs_tnr", "scheduled",
    "in_progress", "completed", "ear_tipped",
])

def validate_tnr_status(status: str) -> bool:
    """Check that a TNR status value is in the valid domain."""
    return status in VALID_TNR_STATUSES

async def update_tnr_status(
    cat_profile_id: str,
    new_status: str,
    user_role: UserRole,
    db_session,
) -> None:
    """Update TNR status. Only verified users may call this."""
    if user_role != UserRole.VERIFIED:
        raise HTTPException(status_code=403, detail="Only verified users can update TNR status")
    if not validate_tnr_status(new_status):
        raise HTTPException(status_code=422, detail=f"Invalid TNR status: {new_status}")
    await db_session.execute(
        "UPDATE cat_profiles SET tnr_status = $1 WHERE id = $2",
        new_status, cat_profile_id,
    )
```

## Frontend Architecture

### Page Structure

```
pages/
├── index.tsx              → Live Map (SSR, public)
├── cats/
│   ├── index.tsx          → Cat listing (SSR, public)
│   └── [id].tsx           → Cat profile detail (SSR, public)
├── sightings/
│   └── new.tsx            → Sighting submission wizard (CSR, auth required)
├── feeding-spots/
│   └── new.tsx            → Feeding spot creation (CSR, auth required)
├── auth/
│   ├── login.tsx          → Login page
│   └── register.tsx       → Registration page
└── api/                   → Next.js API routes (proxying to FastAPI if needed)
```

### Component Architecture

```typescript
// Core map component interface
interface MapProps {
  markers: MapMarker[];
  onMarkerClick: (marker: MapMarker) => void;
  initialBounds?: BoundingBox;
}

interface MapMarker {
  id: string;
  type: 'sighting' | 'feeding_spot' | 'tnr';
  location: { lat: number; lng: number };  // always blurred
  catProfile?: { id: string; name: string; photoUrl: string };
  timestamp: string;
  tnrStatus?: TnrStatus;
}

// Sighting submission flow
interface SightingWizardState {
  step: 'upload' | 'details' | 'matching' | 'confirmed';
  photo: File | null;
  location: { lat: number; lng: number } | null;
  observedAt: string;
  conditionTags: string[];
  coatColor: string;        // required metadata
  patternType: string;      // required metadata
  notableMarkings: string;  // optional metadata
  earTipStatus: boolean | null;  // optional metadata
  bodySize: string | null;  // optional metadata
  notes: string;
  draftId: string | null;
  matchCandidates: MatchCandidate[];
  selectedCatId: string | null;
}

// Cat profile display
interface CatProfileProps {
  cat: CatProfile;
  sightings: Sighting[];  // reverse chronological
  tnrRecords: TnrRecord[];
}
```

### State Management

- **Server state**: React Query (TanStack Query) for API data fetching, caching, and synchronization
- **Form state**: React Hook Form for multi-step sighting submission
- **Map state**: Map library internal state + React context for selected marker
- **Auth state**: JWT stored in httpOnly cookie, user context via React Context

## Design System Foundation

### Color Tokens

```typescript
const colors = {
  primary: {
    50: '#fef3e2', 100: '#fde4b9', 200: '#fcd48c',
    300: '#fbc45f', 400: '#fab83d', 500: '#f9ac1b',
    600: '#e89a17', 700: '#c98112', 800: '#aa680e', 900: '#7b4a09',
  },
  secondary: {
    50: '#e8f5e9', 100: '#c8e6c9', 200: '#a5d6a7',
    300: '#81c784', 400: '#66bb6a', 500: '#4caf50',
    600: '#43a047', 700: '#388e3c', 800: '#2e7d32', 900: '#1b5e20',
  },
  neutral: {
    0: '#ffffff', 50: '#f8f9fa', 100: '#f1f3f5',
    200: '#e9ecef', 300: '#dee2e6', 400: '#ced4da',
    500: '#adb5bd', 600: '#6c757d', 700: '#495057',
    800: '#343a40', 900: '#212529', 1000: '#000000',
  },
  success: { light: '#d4edda', main: '#28a745', dark: '#1e7e34' },
  warning: { light: '#fff3cd', main: '#ffc107', dark: '#d39e00' },
  error: { light: '#f8d7da', main: '#dc3545', dark: '#bd2130' },
};

// Dark mode overrides
const darkColors = {
  neutral: {
    0: '#1a1a2e', 50: '#16213e', 100: '#0f3460',
    // ... inverted scale
  },
  // primary/secondary remain similar with adjusted lightness
};
```

### Typography Tokens

```typescript
const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};
```

### Spacing Tokens (8px base grid)

```typescript
const spacing = {
  0: '0px',
  1: '4px',    // half-step for fine control
  2: '8px',    // 1 unit
  3: '12px',
  4: '16px',   // 2 units
  5: '20px',
  6: '24px',   // 3 units
  8: '32px',   // 4 units
  10: '40px',  // 5 units
  12: '48px',  // 6 units
  16: '64px',  // 8 units
  20: '80px',  // 10 units
  24: '96px',  // 12 units
};
```

### Border Radius, Shadow & Elevation Tokens

```typescript
const borderRadius = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
};

const elevation = {
  base: 0,      // flat content
  raised: 1,    // cards, panels
  overlay: 2,   // dropdowns, tooltips
  modal: 3,     // modals, dialogs
  toast: 4,     // notifications
};
```

### Responsive Breakpoints

```typescript
const breakpoints = {
  xs: '320px',   // small mobile
  sm: '768px',   // tablet
  md: '1024px',  // desktop
  lg: '1440px',  // large desktop
  xl: '2560px',  // ultra-wide (max supported)
};

const mediaQueries = {
  mobile: `(max-width: 767px)`,
  tablet: `(min-width: 768px) and (max-width: 1023px)`,
  desktop: `(min-width: 1024px)`,
  largeDesktop: `(min-width: 1440px)`,
};
```

### Component Patterns

#### Interactive States

All interactive components define these states:

| State | Description | Visual Treatment |
|-------|-------------|-----------------|
| Default | Resting state | Base colors, standard border |
| Hover | Cursor over element | Slight elevation, color shift |
| Focus | Keyboard navigation | Visible focus ring (2px primary-500) |
| Active | Being pressed | Darker shade, inset shadow |
| Disabled | Not interactable | 50% opacity, no pointer events |

#### Button Variants

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

// Primary: solid fill (primary-500), white text
// Secondary: outlined (primary-500 border), primary text
// Ghost: no border/fill, primary text, hover background
```

#### Component Specifications

- **Buttons**: Primary, Secondary, Ghost variants with sm/md/lg sizes
- **Form Inputs**: Text, Select, Textarea, File upload with validation states
- **Cards**: Cat profile cards, sighting cards, feeding spot cards
- **Modals**: Confirmation dialogs, image viewer, report form
- **Map Markers**: Sighting (paw icon), Feeding spot (bowl icon), TNR (medical icon)
- **Navigation Bar**: Logo, search, auth controls, responsive hamburger
- **Status Badges**: TNR status pills with color-coded backgrounds

#### Icon Set

| Category | Icons |
|----------|-------|
| Map | pin, paw-marker, bowl, medical-cross, zoom-in, zoom-out, locate |
| Cat Welfare | heart, ear-tip, syringe, calendar, check-circle |
| Navigation | menu, close, back, home, search, filter |
| Actions | camera, upload, report, edit, share, expand |

## Deployment Architecture

### Docker Compose (Development)

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql://purrsona:purrsona@db:5432/purrsona
      - S3_ENDPOINT=http://minio:9000
      - S3_ACCESS_KEY=minioadmin
      - S3_SECRET_KEY=minioadmin
      - S3_BUCKET=purrsona-images
      - MEGADESCRIPTOR_MODEL=hf-hub:BVRA/MegaDescriptor-T-224
      - JWT_SECRET=dev-secret-key
      - RATE_LIMIT_PER_MINUTE=60
    depends_on: [db, minio]

  db:
    image: pgvector/pgvector:pg16
    ports: ["5432:5432"]
    environment:
      - POSTGRES_USER=purrsona
      - POSTGRES_PASSWORD=purrsona
      - POSTGRES_DB=purrsona
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/migrations/seed.sql:/docker-entrypoint-initdb.d/seed.sql

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data

volumes:
  pgdata:
  minio_data:
```

### Production Container Architecture

```
┌─────────────────────────────────────────────────┐
│              Load Balancer / CDN                 │
└────────────────┬────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Frontend│  │Frontend│  │Backend │  ← Horizontally scalable
│ (SSR)  │  │ (SSR)  │  │  API   │
└────────┘  └────────┘  └────┬───┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
          ┌──────────┐ ┌──────────┐ ┌──────────────┐
          │PostgreSQL│ │    S3    │ │MegaDescriptor│
          │+pgvector │ │  Bucket  │ │    Model     │
          └──────────┘ └──────────┘ └──────────────┘
```

### Environment Variables (Backend)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `S3_ENDPOINT` | S3-compatible storage endpoint | Yes |
| `S3_ACCESS_KEY` | Storage access key | Yes |
| `S3_SECRET_KEY` | Storage secret key | Yes |
| `S3_BUCKET` | Image storage bucket name | Yes |
| `MEGADESCRIPTOR_MODEL` | MegaDescriptor model identifier (default: hf-hub:BVRA/MegaDescriptor-T-224) | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `JWT_EXPIRY_HOURS` | Token expiry (default: 24) | No |
| `RATE_LIMIT_PER_MINUTE` | Rate limit for mutations (default: 60) | No |
| `SIMILARITY_THRESHOLD` | Min cosine similarity for matches (default: 0.65) | No |
| `MAX_IMAGE_SIZE_MB` | Max upload size (default: 10) | No |
| `BLUR_RADIUS_METERS` | Coordinate blur radius (default: 200) | No |

## Error Handling

### Backend Error Strategy

| Scenario | HTTP Code | Error Type | Description |
|----------|-----------|------------|-------------|
| Missing auth token | 401 | `authentication_required` | No valid token provided |
| Insufficient role | 403 | `forbidden` | User lacks required role |
| Resource not found | 404 | `not_found` | Entity does not exist |
| Validation failure | 422 | `validation_error` | Request body fails schema |
| Rate limit exceeded | 429 | `rate_limit_exceeded` | Too many requests |
| Internal error | 500 | `internal_error` | Unexpected server failure |

### Frontend Error States

- **Network error**: Full-page error boundary with retry button and offline indicator
- **401 responses**: Redirect to login, preserve intended destination
- **422 responses**: Inline field-level validation messages
- **404 responses**: "Cat not found" friendly state with link back to map
- **Rate limiting**: Disable submit button, show cooldown timer

## Security Considerations

1. **Coordinate privacy**: Exact locations never exposed in public APIs; blurred coordinates computed at write time and stored separately
2. **Image validation**: File type verified by magic bytes (not just extension), size enforced before processing
3. **JWT security**: Short-lived tokens (24h), httpOnly cookies, role claims verified server-side on every request
4. **Input sanitization**: All user text (notes, descriptions) sanitized before storage; no raw HTML rendering
5. **Rate limiting**: Per-user rate limits on mutation endpoints; higher limits for read endpoints
6. **Matching pipeline advisory only**: Embedding scores and metadata filter results never used for access control or automated decisions

## Testing Strategy

### Property-Based Tests (Hypothesis for Python, fast-check for TypeScript)

Property-based tests validate universal invariants across randomly generated inputs. Each test runs a minimum of 100 iterations.

**Backend (Python + Hypothesis):**
- Coordinate blur distance constraint (Property 1)
- Sighting field validation with random field subsets (Property 6)
- TNR status domain validation with random strings (Property 12)
- Image format/size validation with random inputs (Property 16)
- Match candidates ordering and count (Property 9)
- Metadata filter query correctness (Property 23)
- API error structure consistency (Property 17)
- Rate limiting behavior (Property 19)

**Frontend (TypeScript + fast-check):**
- Spacing tokens grid alignment (Property 20)
- Sighting history sort order (Property 3)

### Unit Tests (pytest for Python, Vitest for TypeScript)

- Role-based access control for each endpoint × role combination
- Sighting submission flow (initiate → match → confirm)
- Cat profile creation from "none of these" flow
- TNR status update with correct/incorrect roles
- Content report creation and storage
- JWT token generation and claim verification
- Image validation edge cases (exact 10MB boundary, each format)

### Integration Tests

- Full sighting submission flow through API with database
- MegaDescriptor embedding generation and pgvector similarity search
- Metadata filter + embedding pipeline integration
- Image upload to S3-compatible storage and URL retrieval
- Docker Compose startup with seeded data
- Public API responses contain only blurred coordinates

### End-to-End Tests (Playwright)

- Public visitor can browse map without login
- Signed-in user can submit a sighting end-to-end
- Match selection and "none of these" flows
- Verified user can update TNR status
- Non-verified user is blocked from TNR status update
- Content reporting flow

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Coordinate blur stays within 200m radius

*For any* valid geographic coordinate (latitude in [-90, 90], longitude in [-180, 180]), applying the blur function SHALL produce a new coordinate whose Haversine distance from the original is at most 200 meters, and the blurred coordinate SHALL differ from the original.

**Validates: Requirements 1.3, 1.4, 7.4**

### Property 2: Map marker completeness

*For any* set of Sightings, Feeding_Spots, and TNR-relevant Cat_Profiles in the database, the map markers endpoint SHALL return exactly one marker for each entity within the requested bounding box.

**Validates: Requirements 1.2, 7.2**

### Property 3: Sighting history ordering

*For any* Cat_Profile with two or more sightings, the sighting history returned by the API SHALL be ordered by descending `observed_at` timestamp (most recent first).

**Validates: Requirements 2.3**

### Property 4: Role-based access enforcement

*For any* mutation endpoint and *for any* user whose role is below the endpoint's minimum required role, the API SHALL return the appropriate denial response (401 for unauthenticated, 403 for insufficient role).

**Validates: Requirements 3.2, 3.3, 9.3**

### Property 5: Authentication token contains role

*For any* authenticated user, the JWT token issued by the auth system SHALL contain a `role` claim matching the user's current role in the database.

**Validates: Requirements 3.5**

### Property 6: Sighting field validation

*For any* sighting submission where one or more required fields (photo, location, timestamp, condition_tags) are absent, the API SHALL return an HTTP 422 response whose `details` array lists exactly the names of the missing fields.

**Validates: Requirements 4.1, 4.6**

### Property 7: Sighting immutability

*For any* confirmed sighting record in the database, all mutation operations (update, delete) on that record SHALL be rejected by the API.

**Validates: Requirements 4.4**

### Property 8: Sighting-profile linkage invariant

*For any* sighting with `created_at` set (i.e., confirmed), the `cat_profile_id` field SHALL be non-null and SHALL reference exactly one existing Cat_Profile.

**Validates: Requirements 4.5**

### Property 9: Match candidates bounded and ordered

*For any* MegaDescriptor embedding query against the metadata-filtered subset of cat_profiles, the result set SHALL contain at most 3 candidates, all with similarity scores above the configured threshold, and the candidates SHALL be ordered by descending similarity score.

**Validates: Requirements 5.3, 5.4, 5.5**

### Property 10: No automatic sighting linkage

*For any* sighting submission flow, the sighting SHALL NOT transition to confirmed status without an explicit user confirmation action (either selecting a match candidate or choosing "none of these").

**Validates: Requirements 5.7, 5.8**

### Property 11: New cat profile initialization completeness

*For any* sighting where the user selects "none of these," the newly created Cat_Profile SHALL contain the originating sighting's photo in its photos array, and the originating sighting SHALL be the first (and only initial) entry in the new profile's sighting history.

**Validates: Requirements 6.2, 6.4**

### Property 12: TNR status value domain

*For any* string submitted as a TNR status update, the API SHALL accept it if and only if it is one of the six valid values: "unassessed", "needs_tnr", "scheduled", "in_progress", "completed", "ear_tipped".

**Validates: Requirements 9.1**

### Property 13: TNR status singularity

*For any* Cat_Profile, after any sequence of TNR status updates, the profile SHALL have exactly one current TNR status value (not zero, not multiple).

**Validates: Requirements 9.4**

### Property 14: Immediate content visibility

*For any* content submission (sighting, feeding spot, TNR record) that receives a success response, an immediately subsequent public API query SHALL include that content in its results.

**Validates: Requirements 10.1**

### Property 15: Report data completeness

*For any* content report submission that receives a success response, the stored report SHALL contain the reporter's user ID, the referenced content ID, the content type, and a valid reason category.

**Validates: Requirements 10.2**

### Property 16: Image upload validation

*For any* uploaded file, the API SHALL accept it if and only if the content type is JPEG, PNG, or WebP AND the file size is at most 10 MB. Invalid uploads SHALL receive an HTTP 422 response specifying which constraint was violated.

**Validates: Requirements 11.3, 11.4**

### Property 17: Consistent API error structure

*For any* API response with an HTTP status code >= 400, the response body SHALL be JSON containing an `error` object with `status_code` (integer), `error_type` (string), and `message` (string) fields.

**Validates: Requirements 13.2**

### Property 18: API payload schema validation

*For any* API endpoint and *for any* request payload that does not conform to the endpoint's defined schema, the API SHALL return an HTTP 422 response.

**Validates: Requirements 13.3**

### Property 19: Rate limiting enforcement

*For any* mutation endpoint, when a single user exceeds the configured rate limit within the time window, subsequent requests SHALL receive an HTTP 429 response until the window resets.

**Validates: Requirements 13.4**

### Property 20: Spacing tokens grid alignment

*For any* spacing token in the design system (excluding the 0 value), the token's pixel value SHALL be a multiple of 4px (the half-step of the 8px base grid).

**Validates: Requirements 15.3**

### Property 21: Interactive component state completeness

*For any* interactive component defined in the design system, the component specification SHALL define visual treatments for all five states: default, hover, focus, active, and disabled.

**Validates: Requirements 15.7**

### Property 22: Environment-based configuration

*For any* configuration value consumed by the Backend_API (database URL, storage credentials, model identifier, JWT secret, rate limits, thresholds), the value SHALL be read from an environment variable and SHALL NOT be hardcoded in source code.

**Validates: Requirements 16.4**

### Property 23: Metadata filter narrows candidate set correctly

*For any* sighting submission with Cat_Metadata (coat_color, pattern_type, and optionally ear_tip_status and body_size), the Metadata_Filter SHALL return only Cat_Profiles whose stored metadata matches the provided fields exactly, and SHALL exclude all Cat_Profiles that differ on any provided field.

**Validates: Requirements 5.1, 12.5**

### Property 24: New cat profile stores metadata for future filtering

*For any* newly created Cat_Profile (via "none of these" selection), the Cat_Profile record SHALL contain the coat_color, pattern_type, notable_markings, ear_tip_status, and body_size values from the originating sighting, enabling future metadata-based pre-filtering.

**Validates: Requirements 6.2, 6.4**
