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
