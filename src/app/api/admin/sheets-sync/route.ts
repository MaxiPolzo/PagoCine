import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { syncRegistrationToGoogleSheet } from "@/lib/google-sheets";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    (data || []).map((registration) => syncRegistrationToGoogleSheet(registration, "created"))
  );
  const failed = results.filter((result) => !result.ok);

  if (failed.length > 0) {
    return NextResponse.json(
      { error: `No se pudieron sincronizar ${failed.length} registros.` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, count: data?.length || 0 });
}
