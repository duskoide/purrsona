import pytest
from httpx import AsyncClient

import asyncpg


async def _create_sighting(db_pool: asyncpg.Pool, cat_id: str, user_id: str) -> str:
    """Insert a test sighting."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO sightings (cat_profile_id, user_id, photo_url, location, blurred_location,
               observed_at, condition_tags, coat_color, pattern_type)
               VALUES ($1, $2, 'http://test/photo.jpg',
               ST_SetSRID(ST_MakePoint(121.0, 14.5), 4326),
               ST_SetSRID(ST_MakePoint(121.001, 14.501), 4326),
               NOW(), '["friendly"]'::jsonb, 'black', 'tabby')
               RETURNING id""",
            cat_id, user_id,
        )
        return str(row["id"])


async def _create_feeding_spot(db_pool: asyncpg.Pool, user_id: str) -> str:
    """Insert a test feeding spot."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO feeding_spots (user_id, location, blurred_location, details)
               VALUES ($1,
               ST_SetSRID(ST_MakePoint(121.0, 14.5), 4326),
               ST_SetSRID(ST_MakePoint(121.001, 14.501), 4326),
               '{"notes": "daily feeding"}'::jsonb)
               RETURNING id""",
            user_id,
        )
        return str(row["id"])


@pytest.mark.asyncio
async def test_map_markers(client: AsyncClient, db_pool: asyncpg.Pool) -> None:
    async with db_pool.acquire() as conn:
        user_row = await conn.fetchrow(
            "INSERT INTO users (email, password_hash) VALUES ('mapuser@test.local', 'hash') RETURNING id"
        )
        user_id = str(user_row["id"])
        cat_row = await conn.fetchrow(
            "INSERT INTO cat_profiles (name, coat_color, pattern_type) VALUES ('Map Cat', 'black', 'tabby') RETURNING id"
        )
        cat_id = str(cat_row["id"])

    await _create_sighting(db_pool, cat_id, user_id)
    await _create_feeding_spot(db_pool, user_id)

    resp = await client.get("/api/v1/map", params={
        "min_lat": 14.0,
        "min_lng": 120.5,
        "max_lat": 15.0,
        "max_lng": 121.5,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "sightings" in data
    assert "feeding_spots" in data
    assert len(data["sightings"]) >= 1
    assert len(data["feeding_spots"]) >= 1


@pytest.mark.asyncio
async def test_map_empty_area(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/map", params={
        "min_lat": -90,
        "min_lng": -180,
        "max_lat": -89,
        "max_lng": -179,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sightings"] == []
    assert data["feeding_spots"] == []


@pytest.mark.asyncio
async def test_map_missing_bbox(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/map")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_map_invalid_bbox(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/map", params={
        "min_lat": 15.0,
        "min_lng": 120.5,
        "max_lat": 14.0,
        "max_lng": 121.5,
    })
    assert resp.status_code == 422
