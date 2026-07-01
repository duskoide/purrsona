type Status = "verified" | "signed_in" | "public" | "pending" | "approved" | "rejected";

const statusStyles: Record<Status, string> = {
  verified: "bg-success-main text-white border-2 border-neutral-900",
  signed_in: "bg-secondary-400 text-neutral-900 border-2 border-neutral-900",
  public: "bg-neutral-200 text-neutral-900 border-2 border-neutral-900",
  pending: "bg-warning-main text-white border-2 border-neutral-900",
  approved: "bg-success-main text-white border-2 border-neutral-900",
  rejected: "bg-error-main text-white border-2 border-neutral-900",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = statusStyles[status as Status] || "bg-neutral-200 text-neutral-900 border-2 border-neutral-900";

  return (
    <span
      className={`inline-block px-3 py-0.5 text-sm font-bold ${style} ${className}`}
    >
      {status}
    </span>
  );
}
