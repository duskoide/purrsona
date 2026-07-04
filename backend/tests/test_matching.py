from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

MOCK_EMBEDDING = [0.0] * 768
MOCK_CANDIDATES = [
    {
        "cat_id": "test-id",
        "name": "Test Cat",
        "similarity": 0.85,
        "coat_color": "black",
        "pattern_type": "tabby",
        "notable_markings": None,
    }
]

VALID_JPEG = b"\xff\xd8\xff" + b"\x00" * 100


@pytest.mark.asyncio
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_match(mock_find: AsyncMock, mock_embed: AsyncMock, auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "candidates" in data
    assert len(data["candidates"]) == 1


@pytest.mark.asyncio
async def test_match_unauthenticated(client) -> None:
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_match_invalid_image(auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.txt", b"not an image", "text/plain")},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_match_with_filters(mock_find: AsyncMock, mock_embed: AsyncMock, auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        params={"coat_color": "black", "pattern_type": "tabby"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_match_invalid_filter(auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        params={"coat_color": "plaid"},
    )
    assert resp.status_code == 422
