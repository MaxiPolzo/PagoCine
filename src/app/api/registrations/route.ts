import { NextResponse } from "next/server";
import { paymentConfig } from "@/config/payment";
import { syncRegistrationToGoogleSheet } from "@/lib/google-sheets";
import { analyzeReceipt } from "@/lib/receipt-analysis";
import { makeRegistrationCode, receiptPath } from "@/lib/registrations";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { acceptedMimeTypes, MAX_RECEIPT_BYTES, registrationSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const parsed = registrationSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      whatsappPhone: formData.get("whatsappPhone"),
      course: formData.get("course")
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
    }

    const receipt = formData.get("receipt");
    if (!(receipt instanceof File)) {
      return NextResponse.json({ error: "Subí el comprobante de pago" }, { status: 400 });
    }

    if (!acceptedMimeTypes.includes(receipt.type)) {
      return NextResponse.json({ error: "El comprobante debe ser PDF" }, { status: 400 });
    }

    if (receipt.size > MAX_RECEIPT_BYTES) {
      return NextResponse.json({ error: "El comprobante supera el tamaño máximo de 8 MB" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const buffer = Buffer.from(await receipt.arrayBuffer());
    const analysis = await analyzeReceipt(buffer, receipt.type);

    const { data: duplicateRows, error: duplicateError } = await supabase
      .from("registrations")
      .select("id, registration_code")
      .or(
        [
          `receipt_hash.eq.${analysis.hash}`,
          analysis.operationId ? `payment_operation_id.eq.${analysis.operationId}` : ""
        ]
          .filter(Boolean)
          .join(",")
      )
      .limit(1);

    if (duplicateError) {
      throw duplicateError;
    }

    const duplicate = duplicateRows?.[0];
    const registrationCode = makeRegistrationCode();
    const storagePath = receiptPath(registrationCode, receipt.name);

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, buffer, {
        contentType: receipt.type,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const finalStatus = duplicate ? "duplicate" : analysis.status;
    const notes = duplicate
      ? `Este comprobante ya fue utilizado en el registro ${duplicate.registration_code}.`
      : analysis.notes;

    const registrationInsert = {
      registration_code: registrationCode,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      whatsapp_phone: parsed.data.whatsappPhone,
      full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      course: parsed.data.course,
      amount: analysis.amount ?? paymentConfig.amount,
      payment_status: finalStatus,
      payment_operation_id: analysis.operationId,
      payment_alias: analysis.alias,
      payment_cvu: analysis.cvu,
      payment_holder: analysis.holder,
      receipt_storage_path: storagePath,
      receipt_original_filename: receipt.name,
      receipt_hash: analysis.hash,
      ocr_text: analysis.ocrText,
      verification_notes: notes,
      verification_method: duplicate ? "duplicate_detection" : analysis.method
    };

    let insertResult = await supabase
      .from("registrations")
      .insert(registrationInsert)
      .select("*")
      .single();

    if (insertResult.error?.message.includes("whatsapp_phone")) {
      const insertWithoutWhatsapp: Omit<typeof registrationInsert, "whatsapp_phone"> = {
        registration_code: registrationInsert.registration_code,
        first_name: registrationInsert.first_name,
        last_name: registrationInsert.last_name,
        full_name: registrationInsert.full_name,
        course: registrationInsert.course,
        amount: registrationInsert.amount,
        payment_status: registrationInsert.payment_status,
        payment_operation_id: registrationInsert.payment_operation_id,
        payment_alias: registrationInsert.payment_alias,
        payment_cvu: registrationInsert.payment_cvu,
        payment_holder: registrationInsert.payment_holder,
        receipt_storage_path: registrationInsert.receipt_storage_path,
        receipt_original_filename: registrationInsert.receipt_original_filename,
        receipt_hash: registrationInsert.receipt_hash,
        ocr_text: registrationInsert.ocr_text,
        verification_notes: registrationInsert.verification_notes,
        verification_method: registrationInsert.verification_method
      };
      insertResult = await supabase
        .from("registrations")
        .insert(insertWithoutWhatsapp)
        .select("*")
        .single();
    }

    if (insertResult.error?.message.includes("email")) {
      const legacyInsert = {
        registration_code: registrationInsert.registration_code,
        first_name: registrationInsert.first_name,
        last_name: registrationInsert.last_name,
        full_name: registrationInsert.full_name,
        course: registrationInsert.course,
        amount: registrationInsert.amount,
        payment_status: registrationInsert.payment_status,
        payment_operation_id: registrationInsert.payment_operation_id,
        payment_alias: registrationInsert.payment_alias,
        payment_cvu: registrationInsert.payment_cvu,
        payment_holder: registrationInsert.payment_holder,
        receipt_storage_path: registrationInsert.receipt_storage_path,
        receipt_original_filename: registrationInsert.receipt_original_filename,
        receipt_hash: registrationInsert.receipt_hash,
        ocr_text: registrationInsert.ocr_text,
        verification_notes: registrationInsert.verification_notes,
        verification_method: registrationInsert.verification_method
      };
      insertResult = await supabase
        .from("registrations")
        .insert(legacyInsert)
        .select("*")
        .single();
    }

    if (insertResult.error) {
      throw insertResult.error;
    }

    const registrationWithWhatsapp = { ...insertResult.data, whatsapp_phone: parsed.data.whatsappPhone };

    await syncRegistrationToGoogleSheet(registrationWithWhatsapp, "created");

    return NextResponse.json({ registration: registrationWithWhatsapp });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la entrada";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
