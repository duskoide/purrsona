"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

const TNR_STATUSES = [
  "unassessed", "needs_tnr", "scheduled", "in_progress", "completed", "ear_tipped",
];

interface TnrRecordModalProps {
  catId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isVerified: boolean;
}

export function TnrRecordModal({ catId, open, onClose, onSuccess, isVerified }: TnrRecordModalProps) {
  const [content, setContent] = useState("");
  const [statusChange, setStatusChange] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { cat_id: catId, content };
      if (statusChange) body.status_change = statusChange;

      const res = await fetch("/api/v1/tnr-records", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create TNR record");
      }

      setContent("");
      setStatusChange("");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add TNR Record">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="p-3 border-2 border-error-main bg-error-light text-error-main">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm mb-1">Record *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border-2 border-neutral-900 px-3 py-2 text-base h-24"
            placeholder="Describe the TNR activity..."
          />
        </div>

        <div>
          <label className="block text-sm mb-1">
            Status change {isVerified ? "" : "(verified users only)"}
          </label>
          <select
            value={statusChange}
            onChange={(e) => setStatusChange(e.target.value)}
            disabled={!isVerified}
            className="w-full border-2 border-neutral-900 px-3 py-2 text-base disabled:opacity-50"
          >
            <option value="">No status change</option>
            {TNR_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!content.trim() || loading}>
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}