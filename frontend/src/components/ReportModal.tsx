"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

const REASONS = ["inaccurate", "abusive", "unsafe", "other"];

interface ReportModalProps {
  contentType: string;
  contentId: string;
  open: boolean;
  onClose: () => void;
}

export function ReportModal({ contentType, contentId, open, onClose }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        content_type: contentType,
        content_id: contentId,
        reason,
      };
      if (details) body.details = details;

      const res = await fetch("/api/v1/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to submit report");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setDetails("");
    setSubmitted(false);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Report Content">
      <div className="flex flex-col gap-4">
        {submitted ? (
          <div className="text-center py-4">
            <p className="text-lg font-bold mb-2">Report submitted</p>
            <p className="text-neutral-600">Thank you for helping keep the community safe.</p>
            <Button variant="primary" onClick={handleClose} className="mt-4">Close</Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 border-2 border-error-main bg-error-light text-error-main">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm mb-1">Reason *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border-2 border-neutral-900 px-3 py-2 text-base"
              >
                <option value="">Select a reason...</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Details (optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full border-2 border-neutral-900 px-3 py-2 text-base h-24"
                placeholder="Provide additional context..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={!reason || loading}>
                {loading ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
