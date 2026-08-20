import crypto from "crypto";
import { paymentConfig } from "@/config/payment";
import { extractOperationId, normalizeText, parseAmount } from "@/lib/registrations";
import type { PaymentStatus } from "@/lib/status";

export type ReceiptAnalysis = {
  status: PaymentStatus;
  amount: number | null;
  alias: string | null;
  cvu: string | null;
  holder: string | null;
  operationId: string | null;
  ocrText: string;
  notes: string;
  method: string;
  hash: string;
};

export function hashBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function hasConfiguredCvu(text: string) {
  const receiptDigits = digitsOnly(text);
  const configuredDigits = digitsOnly(paymentConfig.cvu);

  return (
    receiptDigits.includes(configuredDigits) ||
    receiptDigits.includes(configuredDigits.replace(/^0+/, "")) ||
    receiptDigits.replace(/^0+/, "").includes(configuredDigits.replace(/^0+/, ""))
  );
}

async function extractReceiptText(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const text = parsed.text?.trim() || "";
      if (text) return text;
      return "PDF recibido sin texto extraíble. Requiere revisión manual.";
    } finally {
      await parser.destroy();
    }
  }

  if (!mimeType.startsWith("image/")) {
    return "Archivo recibido en formato no compatible. Requiere revisión manual.";
  }

  return "La app está configurada para leer comprobantes PDF. Requiere revisión manual.";
}

export async function analyzeReceipt(buffer: Buffer, mimeType: string): Promise<ReceiptAnalysis> {
  const hash = hashBuffer(buffer);
  let ocrText = "";

  try {
    ocrText = await extractReceiptText(buffer, mimeType);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar OCR.";
    return {
      status: "manual_review",
      amount: null,
      alias: null,
      cvu: null,
      holder: null,
      operationId: null,
      ocrText: "",
      notes: `Lectura de PDF no disponible: ${message}. Requiere revisión manual.`,
      method: "pdf_read_failed_manual_review",
      hash
    };
  }

  const normalized = normalizeText(ocrText);
  const amount = parseAmount(ocrText);
  const aliasFound = normalized.includes(paymentConfig.alias);
  const cvuFound = normalized.includes(paymentConfig.cvu) || hasConfiguredCvu(ocrText);
  const holderFound = normalizeText(paymentConfig.holder)
    .split(" ")
    .filter(Boolean)
    .every((part) => normalized.includes(part));
  const operationId = extractOperationId(ocrText);

  if (amount !== null && amount !== paymentConfig.amount) {
    return {
      status: "rejected",
      amount,
      alias: aliasFound ? paymentConfig.alias : null,
      cvu: cvuFound ? paymentConfig.cvu : null,
      holder: holderFound ? paymentConfig.holder : null,
      operationId,
      ocrText,
      notes: "RECHAZADO - Importe incorrecto detectado en el comprobante.",
      method: "pdf_text_rules",
      hash
    };
  }

  if (amount === paymentConfig.amount && (aliasFound || cvuFound) && holderFound) {
    return {
      status: "approved",
      amount,
      alias: aliasFound ? paymentConfig.alias : null,
      cvu: cvuFound ? paymentConfig.cvu : null,
      holder: paymentConfig.holder,
      operationId,
      ocrText,
      notes: "Pago confirmado automáticamente: el PDF coincide con importe, destinatario y datos configurados.",
      method: "pdf_text_rules",
      hash
    };
  }

  return {
    status: "pending",
    amount,
    alias: aliasFound ? paymentConfig.alias : null,
    cvu: cvuFound ? paymentConfig.cvu : null,
    holder: holderFound ? paymentConfig.holder : null,
    operationId,
    ocrText,
    notes: "No se pudo confirmar coincidencia suficiente desde el PDF. Pendiente de revisión.",
    method: "pdf_text_prevalidation",
    hash
  };
}
