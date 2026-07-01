"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [adminError, setAdminError] = useState("");

  useEffect(() => {
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        router.push("/auth/login");
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    router.push("/auth/login");
  };

  const handleVerifyRequest = async () => {
    setVerifyMessage("");
    const res = await fetch("/api/v1/auth/verify-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ evidence: "I am a community cat caretaker and TNR volunteer." }),
    });
    if (res.ok) {
      setVerifyMessage("Verification request submitted!");
    } else {
      const err = await res.json();
      setVerifyMessage(err.error?.message || "Failed to submit");
    }
  };

  const handleListVerificationRequests = async () => {
    setAdminError("");
    setVerificationRequests([]);
    const res = await fetch("/api/v1/admin/verification-requests?status=pending", {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setVerificationRequests(data.requests);
    } else {
      const err = await res.json();
      setAdminError(err.error?.message || "Failed to fetch");
    }
  };

  const handleApprove = async (requestId: string) => {
    const res = await fetch(`/api/v1/admin/verification-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) {
      handleListVerificationRequests();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-neutral-200 rounded-md hover:bg-neutral-300"
          >
            Logout
          </button>
        </div>

        {/* User Info */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Email:</span> {user?.email}</p>
            <p>
              <span className="font-medium">Role:</span>{" "}
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                user?.role === "verified"
                  ? "bg-success-light text-success-dark"
                  : "bg-primary-100 text-primary-700"
              }`}>
                {user?.role}
              </span>
            </p>
          </div>
        </div>

        {/* RBAC Test */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">RBAC Test</h2>
          <p className="text-sm text-neutral-600 mb-4">
            Your current role is <strong>{user?.role}</strong>. Try the actions below to see RBAC in action.
          </p>

          <div className="space-y-4">
            {/* Request Verification (signed_in only) */}
            {user?.role === "signed_in" && (
              <div className="p-4 border border-neutral-200 rounded-md">
                <h3 className="font-medium mb-2">Request Verification</h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a signed-in user, you can request to become verified.
                </p>
                <button
                  onClick={handleVerifyRequest}
                  className="px-4 py-2 bg-secondary-500 text-white rounded-md hover:bg-secondary-600 text-sm"
                >
                  Submit Verification Request
                </button>
                {verifyMessage && (
                  <p className="mt-2 text-sm text-secondary-700">{verifyMessage}</p>
                )}
              </div>
            )}

            {/* Admin: List Verification Requests (verified only) */}
            {user?.role === "verified" && (
              <div className="p-4 border border-neutral-200 rounded-md">
                <h3 className="font-medium mb-2">Admin: Verification Requests</h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a verified user, you can review verification requests.
                </p>
                <button
                  onClick={handleListVerificationRequests}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 text-sm"
                >
                  Load Pending Requests
                </button>
                {adminError && (
                  <p className="mt-2 text-sm text-error-dark">{adminError}</p>
                )}
                {verificationRequests.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {verificationRequests.map((req) => (
                      <div key={req.id} className="p-3 bg-neutral-50 rounded-md flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">User: {req.user_id}</p>
                          <p className="text-xs text-neutral-500">{req.evidence}</p>
                        </div>
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="px-3 py-1 bg-success-main text-white rounded text-xs hover:bg-success-dark"
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {verificationRequests.length === 0 && !adminError && (
                  <p className="mt-2 text-sm text-neutral-400">No pending requests</p>
                )}
              </div>
            )}

            {/* Try accessing admin endpoint as non-verified */}
            {user?.role !== "verified" && (
              <div className="p-4 border border-error-light rounded-md bg-error-light/30">
                <h3 className="font-medium mb-2 text-error-dark">Try Admin Endpoint</h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a {user?.role} user, you should get 403 Forbidden.
                </p>
                <button
                  onClick={handleListVerificationRequests}
                  className="px-4 py-2 bg-error-main text-white rounded-md hover:bg-error-dark text-sm"
                >
                  Try GET /admin/verification-requests
                </button>
                {adminError && (
                  <p className="mt-2 text-sm text-error-dark">Got: {adminError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="space-y-2 text-sm">
            <p><a href="http://localhost:8000/docs" target="_blank" className="text-primary-600 hover:underline">API Docs (Swagger UI)</a></p>
            <p><a href="http://localhost:8000/health" target="_blank" className="text-primary-600 hover:underline">Health Check</a></p>
            <p><a href="http://localhost:9001" target="_blank" className="text-primary-600 hover:underline">MinIO Console (minioadmin/minioadmin)</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
