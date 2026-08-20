import { statusLabels, statusTone, type PaymentStatus } from "@/lib/status";

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
