import pytest
from httpx import AsyncClient

import asyncpg


async def _create_cat(db_pool: asyncpg.Pool, user_id: str) -> str:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO cat_profiles (name, coat_color, pattern_type) "
            "VALUES ('Feed Cat', 'black', 'tabby') RETURNING id",
        )
        return str(row["id"])


async def _create_sighting(db_pool: asyncpg.Pool, cat_id: str, user_id: str) -> str:
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


@pytest.mark.asyncio
async def test_create_feeding_spot(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/feeding-spots", json={
        "latitude": 14.5,
        "longitude": 121.0,
        "details": {"notes": "near the park"},
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert "blurred_location" in data


@pytest.mark.asyncio
async def test_create_feeding_spot_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/feeding-spots", json={
        "latitude": 14.5,
        "longitude": 121.0,
        "details": {},
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_feeding_spot_invalid_coords(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/feeding-spots", json={
        "latitude": 999,
        "longitude": 121.0,
        "details": {},
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_tnr_record(auth_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_pool, user_data["user_id"])
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": cat_id,
        "content": "Cat appears healthy, no TNR needed",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["cat_id"] == cat_id
    assert data["status_change"] is None


@pytest.mark.asyncio
async def test_create_tnr_status_change_as_signed_in(auth_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_pool, user_data["user_id"])
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": cat_id,
        "content": "TNR scheduled",
        "status_change": "scheduled",
    })
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_tnr_status_change_as_verified(verified_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, user_data = verified_client
    cat_id = await _create_cat(db_pool, user_data["user_id"])
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": cat_id,
        "content": "TNR scheduled",
        "status_change": "scheduled",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status_change"] == "scheduled"


@pytest.mark.asyncio
async def test_create_tnr_cat_not_found(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": "00000000-0000-0000-0000-000000000000",
        "content": "Ghost cat",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_report(auth_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_pool, user_data["user_id"])
    sighting_id = await _create_sighting(db_pool, cat_id, user_data["user_id"])
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": sighting_id,
        "reason": "inaccurate",
        "details": "Wrong location",
    })
    assert resp.status_code == 201
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_create_report_invalid_content_type(auth_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_pool, user_data["user_id"])
    sighting_id = await _create_sighting(db_pool, cat_id, user_data["user_id"])
    resp = await client.post("/api/v1/reports", json={
        "content_type": "invalid_type",
        "content_id": sighting_id,
        "reason": "inaccurate",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_report_invalid_reason(auth_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_pool, user_data["user_id"])
    sighting_id = await _create_sighting(db_pool, cat_id, user_data["user_id"])
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": sighting_id,
        "reason": "invalid_reason",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_report_content_not_found(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": "00000000-0000-0000-0000-000000000000",
        "reason": "inaccurate",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_report_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": "00000000-0000-0000-0000-000000000000",
        "reason": "inaccurate",
    })
    assert resp.status_code == 401
