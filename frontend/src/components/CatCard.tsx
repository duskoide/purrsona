"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { Card } from "./Card";

interface CatCardProps {
  id: string;
  name: string;
  tnrStatus: string;
  coatColor: string;
  patternType: string;
  latestPhoto: string | null;
}

export function CatCard({ id, name, tnrStatus, coatColor, patternType, latestPhoto }: CatCardProps) {
  return (
    <Link href={`/cats/${id}`}>
      <Card variant="standard" className="hover:shadow-lg motion-safe:transition-shadow cursor-pointer">
        <div className="flex flex-col gap-3">
          {latestPhoto ? (
            <img
              src={latestPhoto}
              alt={name}
              className="w-full h-48 object-cover border-2 border-neutral-900"
            />
          ) : (
            <div className="w-full h-48 bg-neutral-100 border-2 border-neutral-900 flex items-center justify-center">
              <span className="text-neutral-500 text-lg">No photo</span>
            </div>
          )}
          <div className="flex flex-col gap-2 p-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{name}</h3>
              <StatusBadge status={tnrStatus} />
            </div>
            <p className="text-neutral-600">
              {coatColor} {patternType}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
