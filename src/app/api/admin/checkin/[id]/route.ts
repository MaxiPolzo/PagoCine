import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { syncRegistrationToGoogleSheet } from "@/lib/google-sheets";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("registrations")
    .update({
      checked_in: true,
      checked_in_at: new Date().toISOString(),
      checked_in_by: auth.user!.email
    })
    .eq("id", id)
    .eq("payment_status", "approved")
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncRegistrationToGoogleSheet(data, "checked_in");
  return NextResponse.json({ registration: data });
}
