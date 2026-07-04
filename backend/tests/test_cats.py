import pytest
from httpx import AsyncClient

import asyncpg


async def _create_test_cat(db_pool: asyncpg.Pool) -> str:
    """Insert a test cat and return its ID."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO cat_profiles (name, coat_color, pattern_type, body_size, ear_tip_status)
               VALUES ('Test Cat', 'black', 'tabby', 'medium', false)
               RETURNING id"""
        )
        return str(row["id"])


@pytest.mark.asyncio
async def test_cats_list(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/cats")
    assert resp.status_code == 200
    data = resp.json()
    assert "cats" in data
    assert "total" in data
    assert "page" in data
    assert "per_page" in data


@pytest.mark.asyncio
async def test_cats_list_with_filters(client: AsyncClient, db_pool: asyncpg.Pool) -> None:
    await _create_test_cat(db_pool)
    resp = await client.get("/api/v1/cats", params={
        "coat_color": "black",
        "pattern_type": "tabby",
        "tnr_status": "unassessed",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert all(c["coat_color"] == "black" for c in data["cats"])


@pytest.mark.asyncio
async def test_cats_list_invalid_filter(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/cats", params={"coat_color": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cat_detail(client: AsyncClient, db_pool: asyncpg.Pool) -> None:
    cat_id = await _create_test_cat(db_pool)
    resp = await client.get(f"/api/v1/cats/{cat_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == cat_id
    assert data["coat_color"] == "black"
    assert "status_tags" in data
    assert "sighting_history" in data
    assert "tnr_records" in data


@pytest.mark.asyncio
async def test_cat_detail_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/cats/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cat_update(auth_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, _ = auth_client
    cat_id = await _create_test_cat(db_pool)
    resp = await client.patch(f"/api/v1/cats/{cat_id}", json={
        "name": "Updated Cat",
        "coat_color": "orange",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Cat"
    assert data["coat_color"] == "orange"


@pytest.mark.asyncio
async def test_cat_update_unauthenticated(client: AsyncClient, db_pool: asyncpg.Pool) -> None:
    cat_id = await _create_test_cat(db_pool)
    resp = await client.patch(f"/api/v1/cats/{cat_id}", json={"name": "Nope"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_cat_update_not_found(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.patch("/api/v1/cats/00000000-0000-0000-0000-000000000000", json={
        "name": "Ghost",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cat_update_invalid_field(auth_client: tuple[AsyncClient, dict], db_pool: asyncpg.Pool) -> None:
    client, _ = auth_client
    cat_id = await _create_test_cat(db_pool)
    resp = await client.patch(f"/api/v1/cats/{cat_id}", json={
        "coat_color": "plaid",
    })
    assert resp.status_code == 422
