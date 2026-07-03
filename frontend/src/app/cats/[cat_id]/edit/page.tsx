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
        const res = await fetch(`/api/v1/cats/${catId}`, { credentials: "include" });
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
