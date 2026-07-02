# Frontend Sighting Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-step sighting submission wizard: photo upload, location picker, cat description, match review + confirm.

**Architecture:** Multi-step form with client-side state. Photo uploaded as multipart to POST /sightings/initiate. Location picked via map click. Match candidates displayed for user selection. Confirmation via POST /sightings/confirm.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Leaflet

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/ImageUpload.tsx` | Create | File input with preview |
| `frontend/src/components/TagSelector.tsx` | Create | Condition tag checkboxes |
| `frontend/src/components/LocationPicker.tsx` | Create | Map with click-to-pin |
| `frontend/src/components/MapContainer.tsx` | Modify | Add onClick prop |
| `frontend/src/components/SightingWizard.tsx` | Create | Step manager + wizard logic |
| `frontend/src/app/sightings/new/page.tsx` | Create | Wizard page |
| `frontend/src/components/NavigationBar.tsx` | Modify | Add "REPORT SIGHTING" link |

---

### Task 1: ImageUpload and TagSelector Components

**Files:**
- Create: `frontend/src/components/ImageUpload.tsx`
- Create: `frontend/src/components/TagSelector.tsx`

- [ ] **Step 1: Create ImageUpload component**

```typescript
// frontend/src/components/ImageUpload.tsx
"use client";

import { useRef } from "react";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  preview: string | null;
}

export function ImageUpload({ onImageSelect, preview }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageSelect(file);
  };

  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        <img
          src={preview}
          alt="Preview"
          className="max-w-full h-64 object-contain border-2 border-neutral-900"
        />
      ) : (
        <div
          className="w-full h-64 border-2 border-dashed border-neutral-900 flex items-center justify-center cursor-pointer bg-neutral-100"
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-neutral-500 text-lg">Click to upload photo</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />
      {preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-primary-500 underline text-sm"
        >
          Change photo
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create TagSelector component**

```typescript
// frontend/src/components/TagSelector.tsx
"use client";

const CONDITION_TAGS = [
  "healthy", "friendly", "skittish", "injured", "hiding", "eating", "other",
];

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagSelector({ selectedTags, onChange }: TagSelectorProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {CONDITION_TAGS.map((tag) => (
        <label
          key={tag}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selectedTags.includes(tag)}
            onChange={() => toggleTag(tag)}
            className="w-5 h-5 border-2 border-neutral-900 accent-primary-500"
          />
          <span className="text-base capitalize">{tag}</span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ImageUpload.tsx frontend/src/components/TagSelector.tsx
git commit -m "feat: add ImageUpload and TagSelector components"
```

---

### Task 2: LocationPicker Component

**Files:**
- Modify: `frontend/src/components/MapContainer.tsx`
- Create: `frontend/src/components/LocationPicker.tsx`

- [ ] **Step 1: Add onClick prop to MapContainer**

Read `frontend/src/components/MapContainer.tsx`. Add an optional `onClick` prop that fires with `{lat, lng}` when the map is clicked.

Add to the interface:
```typescript
onClick?: (lat: number, lng: number) => void;
```

In the useEffect, add:
```typescript
if (onClick) {
  map.on("click", (e: L.LeafletMouseEvent) => {
    onClick(e.latlng.lat, e.latlng.lng);
  });
}
```

- [ ] **Step 2: Create LocationPicker component**

```typescript
// frontend/src/components/LocationPicker.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import { PixelSpinner } from "./PixelSpinner";

const MapContainer = dynamic(
  () => import("./MapContainer").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <PixelSpinner label="Loading map..." /> }
);

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: [number, number] | null;
}

export function LocationPicker({ onLocationSelect, selectedLocation }: LocationPickerProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-80 w-full border-2 border-neutral-900">
        <MapContainer
          center={selectedLocation || [40.7128, -74.006]}
          zoom={14}
          onClick={onLocationSelect}
        />
      </div>
      {selectedLocation && (
        <p className="text-sm text-neutral-600">
          Location: {selectedLocation[0].toFixed(4)}, {selectedLocation[1].toFixed(4)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MapContainer.tsx frontend/src/components/LocationPicker.tsx
git commit -m "feat: add LocationPicker with map click-to-pin"
```

---

### Task 3: SightingWizard Component

**Files:**
- Create: `frontend/src/components/SightingWizard.tsx`

- [ ] **Step 1: Create SightingWizard step manager**

```typescript
// frontend/src/components/SightingWizard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { Card } from "./Card";
import { ImageUpload } from "./ImageUpload";
import { LocationPicker } from "./LocationPicker";
import { TagSelector } from "./TagSelector";
import { PixelSpinner } from "./PixelSpinner";

const COAT_COLORS = [
  "black", "white", "orange", "gray", "brown",
  "cream", "mixed_black_white", "mixed_orange_white", "other",
];
const PATTERN_TYPES = [
  "tabby", "calico", "tuxedo", "solid", "bicolor",
  "tortoiseshell", "pointed", "other",
];
const BODY_SIZES = ["small", "medium", "large"];

interface MatchCandidate {
  cat_id: string;
  name: string;
  similarity: number;
  coat_color: string;
  pattern_type: string;
}

export function SightingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [coatColor, setCoatColor] = useState("");
  const [patternType, setPatternType] = useState("");
  const [bodySize, setBodySize] = useState("");
  const [earTip, setEarTip] = useState(false);
  const [markings, setMarkings] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [conditionTags, setConditionTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [draftId, setDraftId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!imageFile || !location) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("latitude", location[0].toString());
      formData.append("longitude", location[1].toString());
      formData.append("observed_at", observedAt);
      formData.append("condition_tags", JSON.stringify(conditionTags));
      formData.append("coat_color", coatColor);
      formData.append("pattern_type", patternType);
      if (bodySize) formData.append("body_size", bodySize);
      if (earTip) formData.append("ear_tip_status", "true");
      if (markings) formData.append("notable_markings", markings);
      if (notes) formData.append("notes", notes);

      const res = await fetch("/api/v1/sightings/initiate", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to submit sighting");
      }

      const data = await res.json();
      setDraftId(data.draft_id);
      setCandidates(data.candidates || []);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (catId: string | null) => {
    if (!draftId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/sightings/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_id: draftId, cat_id: catId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to confirm sighting");
      }

      const data = await res.json();
      router.push(`/cats/${data.cat_profile_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return imageFile !== null;
      case 2: return location !== null;
      case 3: return coatColor && patternType && conditionTags.length > 0 && observedAt;
      default: return true;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 ${s <= step ? "bg-primary-500" : "bg-neutral-200"}`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 border-2 border-error-main bg-error-light text-error-main">
          {error}
        </div>
      )}

      <Card variant="standard">
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Upload Photo</h2>
            <ImageUpload onImageSelect={handleImageSelect} preview={imagePreview} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Pick Location</h2>
            <LocationPicker onLocationSelect={setLocation} selectedLocation={location} />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold mb-2">Cat Description</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Coat color *</label>
                <select value={coatColor} onChange={(e) => setCoatColor(e.target.value)}
                  className="w-full border-2 border-neutral-900 px-3 py-2 text-base">
                  <option value="">Select...</option>
                  {COAT_COLORS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Pattern type *</label>
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

            <div>
              <label className="block text-sm mb-1">Observed at *</label>
              <input type="datetime-local" value={observedAt} onChange={(e) => setObservedAt(e.target.value)}
                className="w-full border-2 border-neutral-900 px-3 py-2 text-base" />
            </div>

            <div>
              <label className="block text-sm mb-1">Condition tags *</label>
              <TagSelector selectedTags={conditionTags} onChange={setConditionTags} />
            </div>

            <div>
              <label className="block text-sm mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full border-2 border-neutral-900 px-3 py-2 text-base h-24" placeholder="Optional notes..." />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Review & Confirm</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <PixelSpinner label="Processing..." />
              </div>
            ) : candidates.length > 0 ? (
              <div>
                <p className="mb-4">We found these possible matches:</p>
                <div className="space-y-3">
                  {candidates.map((c) => (
                    <button
                      key={c.cat_id}
                      onClick={() => handleConfirm(c.cat_id)}
                      className="w-full p-4 border-2 border-neutral-900 text-left hover:bg-neutral-100"
                    >
                      <p className="font-bold">{c.name || "Unknown"}</p>
                      <p className="text-sm text-neutral-600">
                        {c.coat_color} {c.pattern_type} — {(c.similarity * 100).toFixed(0)}% match
                      </p>
                    </button>
                  ))}
                  <button
                    onClick={() => handleConfirm(null)}
                    className="w-full p-4 border-2 border-dashed border-neutral-900 text-left hover:bg-neutral-100"
                  >
                    <p className="font-bold">None of these — create new cat</p>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-4">No matches found. A new cat profile will be created.</p>
                <Button variant="primary" onClick={() => handleConfirm(null)}>
                  Confirm & Create Cat
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {step < 4 && (
        <div className="flex justify-between mt-6">
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
            Back
          </Button>
          {step === 3 ? (
            <Button variant="primary" onClick={handleSubmit} disabled={!canProceed() || loading}>
              {loading ? "Submitting..." : "Submit Sighting"}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SightingWizard.tsx
git commit -m "feat: add SightingWizard step manager with 4-step flow"
```

---

### Task 4: Wizard Page

**Files:**
- Create: `frontend/src/app/sightings/new/page.tsx`

- [ ] **Step 1: Create wizard page**

```typescript
// frontend/src/app/sightings/new/page.tsx
"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SightingWizard } from "@/components/SightingWizard";

export default function NewSightingPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Report a Cat Sighting</h1>
        <SightingWizard />
      </div>
    </ProtectedRoute>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/sightings/new/page.tsx
git commit -m "feat: add sighting wizard page with auth guard"
```

---

### Task 5: Update NavigationBar

**Files:**
- Modify: `frontend/src/components/NavigationBar.tsx`

- [ ] **Step 1: Add REPORT SIGHTING link**

Read the current NavigationBar. Add a "REPORT SIGHTING" link (href="/sightings/new") that is only visible to authenticated users (inside the auth conditional block, alongside DASHBOARD).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NavigationBar.tsx
git commit -m "feat: add REPORT SIGHTING link to navigation"
```
