type Status = "verified" | "signed_in" | "public" | "pending" | "approved" | "rejected";

const statusStyles: Record<Status, string> = {
  verified: "bg-success-main text-white border-2 border-neutral-900",
  signed_in: "bg-secondary-400 text-neutral-900 border-2 border-neutral-900",
  public: "bg-neutral-200 text-neutral-900 border-2 border-neutral-900",
  pending: "bg-warning-main text-white border-2 border-neutral-900",
  approved: "bg-success-main text-white border-2 border-neutral-900",
  rejected: "bg-error-main text-white border-2 border-neutral-900",
};

const statusLabels: Record<Status, string> = {
  verified: "VERIFIED",
  signed_in: "SIGNED IN",
  public: "PUBLIC",
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const key = status as Status;
  const style = statusStyles[key] || "bg-neutral-200 text-neutral-900 border-2 border-neutral-900";
  const label = statusLabels[key] || status.toUpperCase();

  return (
    <span
      className={`inline-block px-3 py-0.5 text-sm font-bold ${style} ${className}`}
      role="status"
    >
      {label}
    </span>
  );
}
