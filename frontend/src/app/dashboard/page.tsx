"use client";

import { useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/Button";
import { Card, CardTitle, CardScore } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";

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
  const [showVerifyModal, setShowVerifyModal] = useState(false);

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
      setShowVerifyModal(false);
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
        <h1 className="text-3xl font-bold mb-8 text-primary-500">
          PLAYER DASHBOARD
        </h1>

        {/* Player profile - score card */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card variant="score">
            <CardScore value={user?.role?.toUpperCase() || "PUBLIC"} label="RANK" />
          </Card>
          <Card variant="score">
            <CardScore value="1" label="LEVEL" />
          </Card>
        </div>

        <Card variant="featured" className="mb-6">
          <CardTitle>YOUR PROFILE</CardTitle>
          <div className="space-y-2">
            <p className="font-bold">
              EMAIL: <span className="font-normal text-base">{user?.email}</span>
            </p>
            <p className="font-bold flex items-center gap-2">
              STATUS: <StatusBadge status={user?.role || "public"} />
            </p>
          </div>
        </Card>

        <Card className="mb-6">
          <CardTitle>RBAC TEST</CardTitle>
          <p className="text-sm text-neutral-600 mb-4">
            Current role: <strong>{user?.role}</strong>
          </p>

          <div className="space-y-4">
            {user?.role === "signed_in" && (
              <div className="p-4 border-2 border-neutral-900">
                <h3 className="font-bold mb-2">REQUEST VERIFICATION</h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a signed-in player, you can request verified status.
                </p>
                <Button variant="secondary" size="sm" onClick={() => setShowVerifyModal(true)}>
                  SUBMIT REQUEST
                </Button>
                {verifyMessage && (
                  <p className="mt-2 text-sm text-success-main font-bold">
                    {verifyMessage}
                  </p>
                )}
              </div>
            )}

            {user?.role === "verified" && (
              <div className="p-4 border-2 border-neutral-900">
                <h3 className="font-bold mb-2">ADMIN: VERIFICATION REQUESTS</h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a verified player, you can review requests.
                </p>
                <Button size="sm" onClick={handleListVerificationRequests}>
                  LOAD PENDING
                </Button>
                {adminError && (
                  <p className="mt-2 text-sm text-error-main font-bold">{adminError}</p>
                )}
                {verificationRequests.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {verificationRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-neutral-50 border-2 border-neutral-900 flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-bold">PLAYER: {req.user_id}</p>
                          <p className="text-xs text-neutral-500">{req.evidence}</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApprove(req.id)}
                        >
                          APPROVE
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No pending requests."
                    description="All caught up."
                    className="mt-3"
                  />
                )}
              </div>
            )}

            {user?.role !== "verified" && (
              <div className="p-4 border-2 border-error-main bg-error-light">
                <h3 className="font-bold mb-2 text-error-main">
                  TRY ADMIN ENDPOINT
                </h3>
                <p className="text-sm text-neutral-500 mb-3">
                  As a {user?.role} player, you should get 403 FORBIDDEN.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleListVerificationRequests}
                >
                  TRY /admin/verification-requests
                </Button>
                {adminError && (
                  <p className="mt-2 text-sm text-error-main font-bold">
                    GOT: {adminError}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>QUICK LINKS</CardTitle>
          <div className="space-y-2 text-sm">
            <p>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                className="text-primary-500 font-bold hover:underline
                  focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
              >
                API DOCS (SWAGGER)
              </a>
            </p>
            <p>
              <a
                href="http://localhost:8000/health"
                target="_blank"
                className="text-primary-500 font-bold hover:underline
                  focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
              >
                HEALTH CHECK
              </a>
            </p>
            <p>
              <a
                href="http://localhost:9001"
                target="_blank"
                className="text-primary-500 font-bold hover:underline
                  focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
              >
                MINIO CONSOLE (minioadmin/minioadmin)
              </a>
            </p>
          </div>
        </Card>

        {/* Verification confirmation modal */}
        <Modal
          open={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
          title="SUBMIT VERIFICATION?"
        >
          <p className="text-sm text-neutral-600 mb-4">
            Request verified status to unlock TNR updates and cat profile editing.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowVerifyModal(false)}>
              CANCEL
            </Button>
            <Button size="sm" onClick={handleVerifyRequest}>
              CONFIRM
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
