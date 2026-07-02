"use client";

const COAT_COLORS = [
  "black", "white", "orange", "gray", "brown",
  "cream", "mixed_black_white", "mixed_orange_white", "other",
];

const PATTERN_TYPES = [
  "tabby", "calico", "tuxedo", "solid", "bicolor",
  "tortoiseshell", "pointed", "other",
];

const TNR_STATUSES = [
  "unassessed", "needs_tnr", "scheduled", "in_progress", "completed", "ear_tipped",
];

interface FilterBarProps {
  coatColor: string | null;
  patternType: string | null;
  tnrStatus: string | null;
  onChange: (filters: { coatColor?: string | null; patternType?: string | null; tnrStatus?: string | null }) => void;
}

export function FilterBar({ coatColor, patternType, tnrStatus, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <select
        value={coatColor || ""}
        onChange={(e) => onChange({ coatColor: e.target.value || null })}
        className="border-2 border-neutral-900 bg-neutral-0 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary-400"
      >
        <option value="">All coat colors</option>
        {COAT_COLORS.map((c) => (
          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
        ))}
      </select>

      <select
        value={patternType || ""}
        onChange={(e) => onChange({ patternType: e.target.value || null })}
        className="border-2 border-neutral-900 bg-neutral-0 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary-400"
      >
        <option value="">All patterns</option>
        {PATTERN_TYPES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select
        value={tnrStatus || ""}
        onChange={(e) => onChange({ tnrStatus: e.target.value || null })}
        className="border-2 border-neutral-900 bg-neutral-0 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary-400"
      >
        <option value="">All TNR statuses</option>
        {TNR_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
    </div>
  );
}
