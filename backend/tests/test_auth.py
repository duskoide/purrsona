import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": "newuser@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "user_id" in data
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json={
        "email": "dupe@purrsona.local",
        "password": "testpass123",
    })
    resp = await client.post("/api/v1/auth/register", json={
        "email": "dupe@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 422
    assert "already registered" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": "short@purrsona.local",
        "password": "abc",
    })
    assert resp.status_code == 422
    assert "8 characters" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": "not-an-email",
        "password": "testpass123",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json={
        "email": "login@purrsona.local",
        "password": "testpass123",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "login@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    assert resp.json()["role"] == "signed_in"
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@purrsona.local",
        "password": "testpass123",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "wrong@purrsona.local",
        "password": "badpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/login", json={
        "email": "ghost@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out"


@pytest.mark.asyncio
async def test_me_authenticated(auth_client: tuple[AsyncClient, dict]) -> None:
    client, user_data = auth_client
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == user_data["user_id"]
    assert data["email"] == "testuser@purrsona.local"
    assert data["role"] == "signed_in"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verify_request(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/auth/verify-request", json={
        "evidence": "I volunteer at a local cat shelter",
    })
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_verify_request_duplicate(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    await client.post("/api/v1/auth/verify-request", json={
        "evidence": "First request",
    })
    resp = await client.post("/api/v1/auth/verify-request", json={
        "evidence": "Second request",
    })
    assert resp.status_code == 422
    assert "pending" in resp.json()["error"]["message"].lower()
