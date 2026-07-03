# Frontend Feeding, TNR, Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build frontend forms for feeding spot creation, TNR record submission, and content reporting.

**Architecture:** Feeding spot form as separate page with location picker. TNR record and report as modals on cat profile page. All use existing Modal component and backend API endpoints.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/TnrRecordModal.tsx` | Create | TNR record creation modal |
| `frontend/src/components/ReportModal.tsx` | Create | Content report modal |
| `frontend/src/app/feeding-spots/new/page.tsx` | Create | Feeding spot form page |
| `frontend/src/app/cats/[cat_id]/page.tsx` | Modify | Add TNR button + report buttons |
| `frontend/src/components/NavigationBar.tsx` | Modify | Add FEEDING SPOTS link |

---

### Task 1: TnrRecordModal Component

**Files:**
- Create: `frontend/src/components/TnrRecordModal.tsx`

- [ ] **Step 1: Create TnrRecordModal component**

```typescript
// frontend/src/components/TnrRecordModal.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TnrRecordModal.tsx
git commit -m "feat: add TnrRecordModal component"
```

---

### Task 2: ReportModal Component

**Files:**
- Create: `frontend/src/components/ReportModal.tsx`

- [ ] **Step 1: Create ReportModal component**

```typescript
// frontend/src/components/ReportModal.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ReportModal.tsx
git commit -m "feat: add ReportModal component"
```

---

### Task 3: Feeding Spot Form Page

**Files:**
- Create: `frontend/src/app/feeding-spots/new/page.tsx`

- [ ] **Step 1: Create feeding spot form page**

```typescript
// frontend/src/app/feeding-spots/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LocationPicker } from "@/components/LocationPicker";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function NewFeedingSpotPage() {
  const router = useRouter();
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!location) return;
    setLoading(true);
    setError(null);

    try {
      let parsedDetails = {};
      if (details.trim()) {
        try {
          parsedDetails = JSON.parse(details);
        } catch {
          parsedDetails = { description: details };
        }
      }

      const res = await fetch("/api/v1/feeding-spots", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location[0],
          longitude: location[1],
          details: parsedDetails,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create feeding spot");
      }

      router.push("/map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Add Feeding Spot</h1>

        {error && (
          <div className="mb-4 p-3 border-2 border-error-main bg-error-light text-error-main">
            {error}
          </div>
        )}

        <Card variant="standard">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm mb-2">Location *</label>
              <LocationPicker onLocationSelect={(lat, lng) => setLocation([lat, lng])} selectedLocation={location} />
            </div>

            <div>
              <label className="block text-sm mb-1">Details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full border-2 border-neutral-900 px-3 py-2 text-base h-24"
                placeholder='{"description": "Under the red awning", "schedule": "Daily 7am", "food_type": "dry kibble"}'
              />
              <p className="text-xs text-neutral-500 mt-1">JSON object or plain text description</p>
            </div>

            <div className="flex justify-between mt-4">
              <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={!location || loading}>
                {loading ? "Creating..." : "Create Feeding Spot"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/feeding-spots/new/page.tsx
git commit -m "feat: add feeding spot form page"
```

---

### Task 4: Add TNR + Report Buttons to Cat Profile

**Files:**
- Modify: `frontend/src/app/cats/[cat_id]/page.tsx`

- [ ] **Step 1: Add TNR record button and report buttons**

Read `frontend/src/app/cats/[cat_id]/page.tsx`. Add:

1. Imports for TnrRecordModal, ReportModal, useAuthContext, Button
2. State for modal open/close
3. "Add TNR Record" button (visible to signed-in users)
4. "Report" buttons on sighting history cards and TNR record cards
5. Render TnrRecordModal and ReportModal components

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/cats/[cat_id]/page.tsx
git commit -m "feat: add TNR record and report buttons to cat profile"
```

---

### Task 5: Update NavigationBar

**Files:**
- Modify: `frontend/src/components/NavigationBar.tsx`

- [ ] **Step 1: Add FEEDING SPOTS link**

Add "FEEDING SPOTS" link (href="/feeding-spots/new") visible to authenticated users, alongside DASHBOARD and REPORT SIGHTING.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NavigationBar.tsx
git commit -m "feat: add FEEDING SPOTS link to navigation"
```
