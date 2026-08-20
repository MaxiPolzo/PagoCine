import crypto from "crypto";
import { paymentConfig } from "@/config/payment";
import type { PaymentStatus } from "@/lib/status";

export type Registration = {
  id: string;
  registration_code: string;
  first_name: string;
  last_name: string;
  whatsapp_phone: string | null;
  full_name: string;
  course: string;
  amount: number | null;
  payment_status: PaymentStatus;
  payment_date: string | null;
  payment_operation_id: string | null;
  payment_alias: string | null;
  payment_cvu: string | null;
  payment_holder: string | null;
  receipt_storage_path: string;
  receipt_original_filename: string;
  receipt_hash: string;
  ocr_text: string | null;
  verification_notes: string | null;
  verification_method: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export function makeRegistrationCode() {
  return `FERIA-${crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
}

export function receiptPath(code: string, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  return `receipts/${code}-${Date.now()}.${ext}`;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAmount(text: string) {
  const normalizeAmount = (raw: string) =>
    Number(raw.replace(/ars|\$/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(/,00$/, "").replace(",", "."));
  const currencyMatches = text.match(/(?:\$|ars)\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})(?:,00)?/gi);
  const fallbackMatches = text.match(/\b([0-9]{1,3}(?:[.,][0-9]{3})+)\b/g);
  const values = [...(currencyMatches || []), ...(fallbackMatches || [])]
    .map(normalizeAmount)
    .filter((value) => Number.isFinite(value) && value >= 1000);
  return values.find((value) => value === paymentConfig.amount) ?? values[0] ?? null;
}

export function extractOperationId(text: string) {
  const patterns = [
    /(?:n[uú]mero\s+de\s+operaci[oó]n|operaci[oó]n|referencia|id)\D{0,80}([0-9]{8,})/i,
    /\b([0-9]{8,})\b/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}
