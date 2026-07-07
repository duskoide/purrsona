"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/Card";
import { PixelSpinner } from "@/components/PixelSpinner";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/contexts/AuthContext";
import { TnrRecordModal } from "@/components/TnrRecordModal";
import { ReportModal } from "@/components/ReportModal";

interface CatProfile {
  id: string;
  name: string | null;
  photos: string[];
  tnr_status: string;
  coat_color: string | null;
  pattern_type: string | null;
  notable_markings: string | null;
  ear_tip_status: boolean;
  body_size: string | null;
  status_tags: string[];
  sighting_history: Array<{
    id: string;
    blurred_location: { latitude: number; longitude: number };
    observed_at: string;
    condition_tags: string[];
    photo_url: string;
    notes: string | null;
  }>;
  tnr_records: Array<{
    id: string;
    status_change: string;
    notes: string;
    created_at: string;
  }>;
}

export default function CatProfilePage() {
  const params = useParams();
  const catId = params.cat_id as string;
  const [cat, setCat] = useState<CatProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { user } = useAuthContext();
  const [tnrModalOpen, setTnrModalOpen] = useState(false);
  const [reportModal, setReportModal] = useState<{ type: string; id: string } | null>(null);

  useEffect(() => {
    const fetchCat = async () => {
      try {
        const res = await fetch(`/api/v1/cats/${catId}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch cat");
        const data = await res.json();
        setCat(data);
      } catch (err) {
        console.error("Failed to load cat:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCat();
  }, [catId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <PixelSpinner label="Loading cat profile..." />
      </div>
    );
  }

  if (notFound || !cat) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="Cat not found"
          description="This cat profile doesn't exist."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3">
          {cat.photos[0] ? (
            <img
              src={cat.photos[0]}
              alt={cat.name || "Unknown"}
              className="w-full border-2 border-neutral-900"
            />
          ) : (
            <div className="w-full h-64 bg-neutral-100 border-2 border-neutral-900 flex items-center justify-center">
              <span className="text-neutral-500 text-lg">No photo</span>
            </div>
          )}
        </div>

        <div className="lg:w-2/3">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-3xl font-bold">{cat.name || "Unknown"}</h1>
            <StatusBadge status={cat.tnr_status} />
            {user && (
              <Link href={`/cats/${catId}/edit`}>
                <Button variant="secondary" size="sm">Edit</Button>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {cat.coat_color && (
              <div>
                <span className="text-neutral-600">Coat:</span>{" "}
                <span className="font-bold">{cat.coat_color}</span>
              </div>
            )}
            {cat.pattern_type && (
              <div>
                <span className="text-neutral-600">Pattern:</span>{" "}
                <span className="font-bold">{cat.pattern_type}</span>
              </div>
            )}
            {cat.body_size && (
              <div>
                <span className="text-neutral-600">Size:</span>{" "}
                <span className="font-bold">{cat.body_size}</span>
              </div>
            )}
            <div>
              <span className="text-neutral-600">Ear tip:</span>{" "}
              <span className="font-bold">{cat.ear_tip_status ? "Yes" : "No"}</span>
            </div>
          </div>

          {cat.notable_markings && (
            <p className="mb-4">
              <span className="text-neutral-600">Markings:</span> {cat.notable_markings}
            </p>
          )}

          {cat.status_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {cat.status_tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 border-2 border-neutral-900 bg-neutral-100 text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {cat.sighting_history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Sighting History</h2>
          <div className="space-y-4">
            {cat.sighting_history.map((sighting) => (
              <Card key={sighting.id} variant="standard">
                <div className="flex gap-4">
                  <img
                    src={sighting.photo_url}
                    alt="Sighting"
                    className="w-24 h-24 object-cover border-2 border-neutral-900"
                  />
                  <div>
                    <p className="text-sm text-neutral-600">
                      {new Date(sighting.observed_at).toLocaleDateString()}
                    </p>
                    {sighting.notes && <p>{sighting.notes}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sighting.condition_tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1 py-0.5 border border-neutral-900 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {user && (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setReportModal({ type: "sighting", id: sighting.id })}>
                        Report
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold">TNR Records</h2>
          {user && (
            <Button variant="secondary" size="sm" onClick={() => setTnrModalOpen(true)}>
              Add TNR Record
            </Button>
          )}
        </div>
        {cat.tnr_records.length > 0 ? (
          <div className="space-y-4">
            {cat.tnr_records.map((record) => (
              <Card key={record.id} variant="standard">
                <div>
                  <p className="font-bold">{record.status_change}</p>
                  <p className="text-sm text-neutral-600">
                    {new Date(record.created_at).toLocaleDateString()}
                  </p>
                  {record.notes && <p className="mt-2">{record.notes}</p>}
                  {user && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setReportModal({ type: "tnr_record", id: record.id })}>
                      Report
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-neutral-600">No TNR records yet.</p>
        )}
      </div>
      <TnrRecordModal
        catId={catId}
        open={tnrModalOpen}
        onClose={() => setTnrModalOpen(false)}
        onSuccess={() => window.location.reload()}
        isVerified={user?.role === "verified"}
      />
      {reportModal && (
        <ReportModal
          contentType={reportModal.type}
          contentId={reportModal.id}
          open={!!reportModal}
          onClose={() => setReportModal(null)}
        />
      )}
    </div>
  );
}
