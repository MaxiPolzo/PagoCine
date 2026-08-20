import { NextResponse } from "next/server";
import { paymentConfig } from "@/config/payment";
import { requireAdmin } from "@/lib/admin-auth";
import { syncRegistrationToGoogleSheet } from "@/lib/google-sheets";
import { makeRegistrationCode } from "@/lib/registrations";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { registrationSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const course = searchParams.get("course");
  const q = searchParams.get("q")?.trim();

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("registrations").select("*").order("created_at", { ascending: false });

  if (status) query = query.eq("payment_status", status);
  if (course) query = query.eq("course", course);
  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,registration_code.ilike.%${q}%,payment_operation_id.ilike.%${q}%`
    );
  }

  const { data, error } = await query.limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ registrations: data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const parsed = registrationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  }

  const registrationCode = makeRegistrationCode();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("registrations")
    .insert({
      registration_code: registrationCode,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      whatsapp_phone: parsed.data.whatsappPhone,
      full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      course: parsed.data.course,
      amount: paymentConfig.amount,
      payment_status: "approved",
      receipt_storage_path: `manual/${registrationCode}`,
      receipt_original_filename: "Ingreso manual",
      receipt_hash: `manual-${registrationCode}`,
      verification_notes: "Ingreso manual cargado desde el panel administrativo.",
      verification_method: "manual_door_payment",
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user!.email
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncRegistrationToGoogleSheet(data, "created");
  return NextResponse.json({ registration: data });
}
