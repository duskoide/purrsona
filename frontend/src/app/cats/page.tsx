"use client";

import { useEffect, useState } from "react";
import { CatCard } from "@/components/CatCard";
import { FilterBar } from "@/components/FilterBar";
import { PixelSpinner } from "@/components/PixelSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";

interface Cat {
  id: string;
  name: string;
  tnr_status: string;
  coat_color: string;
  pattern_type: string;
  ear_tip_status: boolean;
  latest_photo: string | null;
}

export default function CatsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    coatColor: null as string | null,
    patternType: null as string | null,
    tnrStatus: null as string | null,
  });

  useEffect(() => {
    const fetchCats = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString(), per_page: "12" });
        if (filters.coatColor) params.set("coat_color", filters.coatColor);
        if (filters.patternType) params.set("pattern_type", filters.patternType);
        if (filters.tnrStatus) params.set("tnr_status", filters.tnrStatus);

        const res = await fetch(`/api/v1/cats?${params}`);
        if (!res.ok) throw new Error("Failed to fetch cats");
        const data = await res.json();
        setCats(data.cats);
        setTotal(data.total);
      } catch (err) {
        console.error("Failed to load cats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCats();
  }, [page, filters]);

  const handleFilterChange = (newFilters: { coatColor?: string | null; patternType?: string | null; tnrStatus?: string | null }) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary-500">
          COMMUNITY CATS
        </h1>

        <FilterBar
          coatColor={filters.coatColor}
          patternType={filters.patternType}
          tnrStatus={filters.tnrStatus}
          onChange={handleFilterChange}
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <PixelSpinner label="Loading cats..." />
          </div>
        ) : cats.length === 0 ? (
          <EmptyState
            title="No cats found"
            description="Try adjusting your filters or check back later."
            className="mt-6"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {cats.map((cat) => (
                <CatCard
                  key={cat.id}
                  id={cat.id}
                  name={cat.name}
                  tnrStatus={cat.tnr_status}
                  coatColor={cat.coat_color}
                  patternType={cat.pattern_type}
                  latestPhoto={cat.latest_photo}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  PREVIOUS
                </Button>
                <span className="font-bold text-neutral-600">
                  PAGE {page} OF {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  NEXT
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
