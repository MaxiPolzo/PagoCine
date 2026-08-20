export type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "duplicate"
  | "manual_review";

export const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  approved: "Pago confirmado",
  rejected: "Rechazado",
  duplicate: "Duplicado",
  manual_review: "Revisión manual"
};

export const statusTone: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800 ring-amber-200",
  approved: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-100 text-rose-800 ring-rose-200",
  duplicate: "bg-orange-100 text-orange-800 ring-orange-200",
  manual_review: "bg-sky-100 text-sky-800 ring-sky-200"
};

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(amount);
}
