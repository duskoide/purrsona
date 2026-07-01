"use client";

import { useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/Button";
import { Card, CardTitle } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user } = useAuthContext();
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [adminError, setAdminError] = useState("");

  const handleVerifyRequest = async () => {
    setVerifyMessage("");
    const res = await fetch("/api/v1/auth/verify-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        evidence: "I am a community cat caretaker and TNR volunteer.",
      }),
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
    const res = await fetch(
      "/api/v1/admin/verification-requests?status=pending",
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      setVerificationRequests(data.requests);
    } else {
      const err = await res.json();
      setAdminError(err.error?.message || "Failed to fetch");
    }
  };

  const handleApprove = async (requestId: string) => {
    const res = await fetch(
      `/api/v1/admin/verification-requests/${requestId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "approved" }),
      },
    );
    if (res.ok) handleListVerificationRequests();
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        <Card className="mb-6">
          <CardTitle>Your Profile</CardTitle>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p>
              <span className="font-medium">Role:</span>{" "}
              <StatusBadge status={user?.role || "public"} />
            </p>
          </div>
        </Card>

        <Card className="mb-6">
          <CardTitle>RBAC Test</CardTitle>
          <p className="text-sm text-neutral-600 mb-4">
            Your current role is <strong>{user?.role}</strong>.
          </p>

          <div className="space-y-4">
            {user?.role === "signed_in" && (
              <div className="p-4 border border-neutral-200 rounded-md">
                <h3 className="font-medium mb-2">Request Verification</h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a signed-in user, you can request to become verified.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleVerifyRequest}
                >
                  Submit Verification Request
                </Button>
                {verifyMessage && (
                  <p className="mt-2 text-sm text-secondary-700">
                    {verifyMessage}
                  </p>
                )}
              </div>
            )}

            {user?.role === "verified" && (
              <div className="p-4 border border-neutral-200 rounded-md">
                <h3 className="font-medium mb-2">
                  Admin: Verification Requests
                </h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a verified user, you can review verification requests.
                </p>
                <Button size="sm" onClick={handleListVerificationRequests}>
                  Load Pending Requests
                </Button>
                {adminError && (
                  <p className="mt-2 text-sm text-error-dark">{adminError}</p>
                )}
                {verificationRequests.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {verificationRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-neutral-50 rounded-md flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            User: {req.user_id}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {req.evidence}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApprove(req.id)}
                        >
                          Approve
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {user?.role !== "verified" && (
              <div className="p-4 border border-error-light rounded-md bg-error-light/30">
                <h3 className="font-medium mb-2 text-error-dark">
                  Try Admin Endpoint
                </h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a {user?.role} user, you should get 403 Forbidden.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleListVerificationRequests}
                >
                  Try GET /admin/verification-requests
                </Button>
                {adminError && (
                  <p className="mt-2 text-sm text-error-dark">
                    Got: {adminError}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Quick Links</CardTitle>
          <div className="space-y-2 text-sm">
            <p>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                className="text-primary-600 hover:underline"
              >
                API Docs (Swagger UI)
              </a>
            </p>
            <p>
              <a
                href="http://localhost:8000/health"
                target="_blank"
                className="text-primary-600 hover:underline"
              >
                Health Check
              </a>
            </p>
            <p>
              <a
                href="http://localhost:9001"
                target="_blank"
                className="text-primary-600 hover:underline"
              >
                MinIO Console (minioadmin/minioadmin)
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
