type Status =
  // Account/role statuses
  | "verified"
  | "signed_in"
  | "public"
  | "pending"
  | "approved"
  | "rejected"
  // TNR (Trap-Neuter-Return) statuses for cat profiles
  | "unassessed"
  | "needs_tnr"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "ear_tipped";

const statusStyles: Record<Status, string> = {
  verified: "bg-success-main text-white border-2 border-neutral-900",
  signed_in: "bg-secondary-400 text-neutral-900 border-2 border-neutral-900",
  public: "bg-neutral-200 text-neutral-900 border-2 border-neutral-900",
  pending: "bg-warning-main text-white border-2 border-neutral-900",
  approved: "bg-success-main text-white border-2 border-neutral-900",
  rejected: "bg-error-main text-white border-2 border-neutral-900",
  unassessed: "bg-neutral-200 text-neutral-900 border-2 border-neutral-900",
  needs_tnr: "bg-warning-main text-white border-2 border-neutral-900",
  scheduled: "bg-warning-main text-white border-2 border-neutral-900",
  in_progress: "bg-warning-main text-white border-2 border-neutral-900",
  completed: "bg-success-main text-white border-2 border-neutral-900",
  ear_tipped: "bg-success-main text-white border-2 border-neutral-900",
};

const statusLabels: Record<Status, string> = {
  verified: "VERIFIED",
  signed_in: "SIGNED IN",
  public: "PUBLIC",
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
  unassessed: "UNASSESSED",
  needs_tnr: "NEEDS TNR",
  scheduled: "TNR SCHEDULED",
  in_progress: "TNR IN PROGRESS",
  completed: "TNR COMPLETED",
  ear_tipped: "EAR TIPPED",
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
