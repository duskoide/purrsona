from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

import asyncpg

MOCK_PHOTO_URL = "http://localhost:9000/purrsona-images/photos/test.jpg"
MOCK_EMBEDDING = [0.0] * 768
MOCK_CANDIDATES: list = []

VALID_JPEG = b"\xff\xd8\xff" + b"\x00" * 100


async def _create_cat(db_pool: asyncpg.Pool, user_id: str) -> str:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO cat_profiles (name, coat_color, pattern_type, created_by) "
            "VALUES ('Sighting Cat', 'black', 'tabby', $1) RETURNING id",
            user_id,
        )
        return str(row["id"])


@pytest.mark.asyncio
@patch("app.services.sighting_service.upload_image", new_callable=AsyncMock, return_value=MOCK_PHOTO_URL)
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_initiate_sighting(
    mock_find: AsyncMock,
    mock_embed: AsyncMock,
    mock_upload: AsyncMock,
    auth_client: tuple[AsyncClient, dict],
) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "draft_id" in data
    assert "photo_url" in data
    assert "blurred_location" in data
    assert "candidates" in data


@pytest.mark.asyncio
async def test_initiate_sighting_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_initiate_sighting_missing_image(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/sightings/initiate", data={
        "latitude": "14.5",
        "longitude": "121.0",
        "observed_at": "2026-07-04T10:00:00",
        "condition_tags": '["friendly"]',
        "coat_color": "black",
        "pattern_type": "tabby",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_initiate_sighting_invalid_coat_color(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "plaid",
            "pattern_type": "tabby",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
@patch("app.services.sighting_service.upload_image", new_callable=AsyncMock, return_value=MOCK_PHOTO_URL)
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_confirm_sighting_with_cat_id(
    mock_find: AsyncMock,
    mock_embed: AsyncMock,
    mock_upload: AsyncMock,
    auth_client: tuple[AsyncClient, dict],
    db_pool: asyncpg.Pool,
) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_pool, user_data["user_id"])

    initiate_resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    draft_id = initiate_resp.json()["draft_id"]

    resp = await client.post("/api/v1/sightings/confirm", json={
        "draft_id": draft_id,
        "cat_id": cat_id,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "sighting_id" in data
    assert data["cat_profile_id"] == cat_id


@pytest.mark.asyncio
@patch("app.services.sighting_service.upload_image", new_callable=AsyncMock, return_value=MOCK_PHOTO_URL)
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_confirm_sighting_new_cat(
    mock_find: AsyncMock,
    mock_embed: AsyncMock,
    mock_upload: AsyncMock,
    auth_client: tuple[AsyncClient, dict],
) -> None:
    client, _ = auth_client

    initiate_resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    draft_id = initiate_resp.json()["draft_id"]

    resp = await client.post("/api/v1/sightings/confirm", json={
        "draft_id": draft_id,
        "cat_id": None,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "sighting_id" in data
    assert "cat_profile_id" in data


@pytest.mark.asyncio
async def test_confirm_sighting_invalid_draft(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/sightings/confirm", json={
        "draft_id": "00000000-0000-0000-0000-000000000000",
        "cat_id": None,
    })
    assert resp.status_code == 404
