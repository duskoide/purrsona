# Cat Profile Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build backend PATCH endpoint for cat metadata updates and frontend edit form.

**Architecture:** Service layer builds dynamic UPDATE query from provided fields. Single PATCH endpoint for partial updates. Frontend edit form pre-fills with current data.

**Tech Stack:** Python 3.11, FastAPI, asyncpg, Next.js 14, React 18, TypeScript

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/services/cat_service.py` | Create | Cat update logic |
| `backend/app/api/cats.py` | Modify | Add PATCH endpoint |
| `frontend/src/app/cats/[cat_id]/edit/page.tsx` | Create | Edit form page |
| `frontend/src/app/cats/[cat_id]/page.tsx` | Modify | Add EDIT button |

---

### Task 1: Cat Service (Backend)

**Files:**
- Create: `backend/app/services/cat_service.py`

- [ ] **Step 1: Create cat service**

```python
# backend/app/services/cat_service.py

from __future__ import annotations

from typing import Any

import asyncpg
from fastapi import HTTPException

from app.core.error_handlers import error_response

VALID_COAT_COLORS = {
    "black", "white", "orange", "gray", "brown",
    "cream", "mixed_black_white", "mixed_orange_white", "other",
}
VALID_PATTERN_TYPES = {
    "tabby", "calico", "tuxedo", "solid", "bicolor",
    "tortoiseshell", "pointed", "other",
}
VALID_BODY_SIZES = {"small", "medium", "large"}

ALLOWED_FIELDS = {"name", "coat_color", "pattern_type", "body_size", "ear_tip_status", "notable_markings"}


async def update_cat_profile(
    db: asyncpg.Pool,
    cat_id: str,
    updates: dict[str, Any],
) -> dict[str, Any] | None:
    """Update cat profile metadata. Returns updated profile or None if not found.

    Only fields in ALLOWED_FIELDS are processed. Validates enum values.
    """
    if not updates:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "No fields to update"),
        )

    # Validate enum values
    errors = []
    if "coat_color" in updates and updates["coat_color"] not in VALID_COAT_COLORS:
        errors.append({"field": "coat_color", "message": f"Must be one of: {', '.join(sorted(VALID_COAT_COLORS))}"})
    if "pattern_type" in updates and updates["pattern_type"] not in VALID_PATTERN_TYPES:
        errors.append({"field": "pattern_type", "message": f"Must be one of: {', '.join(sorted(VALID_PATTERN_TYPES))}"})
    if "body_size" in updates and updates["body_size"] not in VALID_BODY_SIZES:
        errors.append({"field": "body_size", "message": f"Must be one of: {', '.join(sorted(VALID_BODY_SIZES))}"})
    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid parameters", details=errors),
        )

    # Filter to allowed fields only
    filtered = {k: v for k, v in updates.items() if k in ALLOWED_FIELDS}
    if not filtered:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "No valid fields to update"),
        )

    # Build dynamic UPDATE
    set_clauses = []
    params: list[Any] = []
    for i, (field, value) in enumerate(filtered.items(), 1):
        set_clauses.append(f"{field} = ${i}")
        params.append(value)

    params.append(cat_id)
    query = f"""
        UPDATE cat_profiles
        SET {', '.join(set_clauses)}
        WHERE id = ${len(params)}
        RETURNING id, name, coat_color, pattern_type, body_size, ear_tip_status, notable_markings, tnr_status
    """

    row = await db.fetchrow(query, *params)
    if row is None:
        return None

    return {
        "id": str(row["id"]),
        "name": row["name"],
        "coat_color": row["coat_color"],
        "pattern_type": row["pattern_type"],
        "body_size": row["body_size"],
        "ear_tip_status": row["ear_tip_status"],
        "notable_markings": row["notable_markings"],
        "tnr_status": row["tnr_status"],
    }
```

- [ ] **Step 2: Verify imports**

Run: `cd backend && python -c "from app.services.cat_service import update_cat_profile; print('ok')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/cat_service.py
git commit -m "feat: add cat service with update_cat_profile"
```

---

### Task 2: PATCH Endpoint (Backend)

**Files:**
- Modify: `backend/app/api/cats.py`

- [ ] **Step 1: Add PATCH endpoint to existing cats router**

Read `backend/app/api/cats.py`. Add:

```python
from app.services.cat_service import update_cat_profile

class CatUpdateRequest(BaseModel):
    name: str | None = None
    coat_color: str | None = None
    pattern_type: str | None = None
    body_size: str | None = None
    ear_tip_status: bool | None = None
    notable_markings: str | None = None


@router.patch("/{cat_id}")
async def cat_update_endpoint(
    cat_id: str,
    body: CatUpdateRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Update cat profile metadata."""
    updates = body.model_dump(exclude_none=True)
    result = await update_cat_profile(db, cat_id, updates)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=error_response(404, "Cat not found"),
        )
    return result
```

- [ ] **Step 2: Verify imports**

Run: `cd backend && python -c "from app.api.cats import router; print('ok')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/cats.py
git commit -m "feat: add PATCH /api/v1/cats/{cat_id} endpoint"
```

---

### Task 3: Edit Form Page (Frontend)

**Files:**
- Create: `frontend/src/app/cats/[cat_id]/edit/page.tsx`

- [ ] **Step 1: Create edit form page**

```typescript
// frontend/src/app/cats/[cat_id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PixelSpinner } from "@/components/PixelSpinner";

const COAT_COLORS = [
  "black", "white", "orange", "gray", "brown",
  "cream", "mixed_black_white", "mixed_orange_white", "other",
];
const PATTERN_TYPES = [
  "tabby", "calico", "tuxedo", "solid", "bicolor",
  "tortoiseshell", "pointed", "other",
];
const BODY_SIZES = ["small", "medium", "large"];

export default function EditCatPage() {
  const params = useParams();
  const router = useRouter();
  const catId = params.cat_id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [coatColor, setCoatColor] = useState("");
  const [patternType, setPatternType] = useState("");
  const [bodySize, setBodySize] = useState("");
  const [earTip, setEarTip] = useState(false);
  const [markings, setMarkings] = useState("");

  useEffect(() => {
    const fetchCat = async () => {
      try {
        const res = await fetch(`/api/v1/cats/${catId}`);
        if (!res.ok) throw new Error("Failed to fetch cat");
        const data = await res.json();
        setName(data.name || "");
        setCoatColor(data.coat_color || "");
        setPatternType(data.pattern_type || "");
        setBodySize(data.body_size || "");
        setEarTip(data.ear_tip_status);
        setMarkings(data.notable_markings || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cat");
      } finally {
        setLoading(false);
      }
    };
    fetchCat();
  }, [catId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};
      if (name) body.name = name;
      if (coatColor) body.coat_color = coatColor;
      if (patternType) body.pattern_type = patternType;
      if (bodySize) body.body_size = bodySize;
      body.ear_tip_status = earTip;
      if (markings) body.notable_markings = markings;

      const res = await fetch(`/api/v1/cats/${catId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to update cat");
      }

      router.push(`/cats/${catId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <PixelSpinner label="Loading cat..." />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Edit Cat Profile</h1>

        {error && (
          <div className="mb-4 p-3 border-2 border-error-main bg-error-light text-error-main">
            {error}
          </div>
        )}

        <Card variant="standard">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border-2 border-neutral-900 px-3 py-2 text-base"
                placeholder="Cat name (leave empty for Unknown)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Coat color</label>
                <select value={coatColor} onChange={(e) => setCoatColor(e.target.value)}
                  className="w-full border-2 border-neutral-900 px-3 py-2 text-base">
                  <option value="">Select...</option>
                  {COAT_COLORS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Pattern type</label>
                <select value={patternType} onChange={(e) => setPatternType(e.target.value)}
                  className="w-full border-2 border-neutral-900 px-3 py-2 text-base">
                  <option value="">Select...</option>
                  {PATTERN_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Body size</label>
                <select value={bodySize} onChange={(e) => setBodySize(e.target.value)}
                  className="w-full border-2 border-neutral-900 px-3 py-2 text-base">
                  <option value="">Select...</option>
                  {BODY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={earTip} onChange={(e) => setEarTip(e.target.checked)}
                  className="w-5 h-5 border-2 border-neutral-900 accent-primary-500" />
                <label className="text-base">Ear tipped</label>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Notable markings</label>
              <input type="text" value={markings} onChange={(e) => setMarkings(e.target.value)}
                className="w-full border-2 border-neutral-900 px-3 py-2 text-base" placeholder="e.g., white chest, scar on left ear" />
            </div>

            <div className="flex justify-between mt-4">
              <Link href={`/cats/${catId}`}>
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/cats/[cat_id]/edit/page.tsx
git commit -m "feat: add cat edit form page"
```

---

### Task 4: Edit Button on Cat Profile (Frontend)

**Files:**
- Modify: `frontend/src/app/cats/[cat_id]/page.tsx`

- [ ] **Step 1: Add EDIT button**

Read `frontend/src/app/cats/[cat_id]/page.tsx`. Add an "EDIT" button that links to `/cats/{cat_id}/edit`. It should be visible only to signed-in users. Use `useAuthContext()` to check if user is authenticated.

Add the import:
```typescript
import Link from "next/link";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/contexts/AuthContext";
```

Add in the component:
```typescript
const { user } = useAuthContext();
```

Add the EDIT button near the top of the profile (after the name + TNR badge):
```typescript
{user && (
  <Link href={`/cats/${catId}/edit`}>
    <Button variant="secondary" size="sm">Edit</Button>
  </Link>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/cats/[cat_id]/page.tsx
git commit -m "feat: add EDIT button to cat profile page"
```
