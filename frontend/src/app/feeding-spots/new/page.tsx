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
