import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { path } = (await request.json()) as { path?: string };
  if (!path) return NextResponse.json({ error: "Ruta requerida" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl });
}
