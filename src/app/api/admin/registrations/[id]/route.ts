import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { syncRegistrationToGoogleSheet } from "@/lib/google-sheets";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { reviewSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisión inválida" }, { status: 400 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("registrations")
    .update({
      payment_status: parsed.data.status,
      verification_notes: parsed.data.notes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user!.email
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncRegistrationToGoogleSheet(data, "reviewed");

  return NextResponse.json({ registration: data });
}
