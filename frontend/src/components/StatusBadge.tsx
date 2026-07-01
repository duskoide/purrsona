type Status = "verified" | "signed_in" | "public" | "pending" | "approved" | "rejected";

const statusStyles: Record<Status, string> = {
  verified: "bg-success-light text-success-dark",
  signed_in: "bg-primary-100 text-primary-700",
  public: "bg-neutral-200 text-neutral-700",
  pending: "bg-warning-light text-warning-dark",
  approved: "bg-success-light text-success-dark",
  rejected: "bg-error-light text-error-dark",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = statusStyles[status as Status] || "bg-neutral-200 text-neutral-700";

  return (
    <span
      className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${style} ${className}`}
    >
      {status}
    </span>
  );
}
