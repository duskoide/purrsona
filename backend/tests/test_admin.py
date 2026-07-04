import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_verification_requests_as_verified(verified_client: tuple[AsyncClient, dict]) -> None:
    client, _ = verified_client
    resp = await client.get("/api/v1/admin/verification-requests")
    assert resp.status_code == 200
    assert "requests" in resp.json()


@pytest.mark.asyncio
async def test_list_verification_requests_as_signed_in(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.get("/api/v1/admin/verification-requests")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_approve_verification_request(
    verified_client: tuple[AsyncClient, dict],
    auth_client: tuple[AsyncClient, dict],
) -> None:
    admin_client, _ = verified_client
    user_client, user_data = auth_client

    # Submit verification request
    await user_client.post("/api/v1/auth/verify-request", json={
        "evidence": "I am a cat expert",
    })

    # Get the request
    resp = await admin_client.get("/api/v1/admin/verification-requests", params={"status": "pending"})
    requests = resp.json()["requests"]
    assert len(requests) >= 1
    request_id = requests[0]["id"]

    # Approve it
    resp = await admin_client.patch(f"/api/v1/admin/verification-requests/{request_id}", json={
        "status": "approved",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_reject_verification_request(
    verified_client: tuple[AsyncClient, dict],
    auth_client: tuple[AsyncClient, dict],
) -> None:
    admin_client, _ = verified_client
    user_client, _ = auth_client

    await user_client.post("/api/v1/auth/verify-request", json={
        "evidence": "Please verify me",
    })

    resp = await admin_client.get("/api/v1/admin/verification-requests", params={"status": "pending"})
    request_id = resp.json()["requests"][0]["id"]

    resp = await admin_client.patch(f"/api/v1/admin/verification-requests/{request_id}", json={
        "status": "rejected",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_approve_nonexistent_request(verified_client: tuple[AsyncClient, dict]) -> None:
    client, _ = verified_client
    resp = await client.patch("/api/v1/admin/verification-requests/00000000-0000-0000-0000-000000000000", json={
        "status": "approved",
    })
    assert resp.status_code == 404
