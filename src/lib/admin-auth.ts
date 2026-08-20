import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  return { user: data.user, response: null };
}
