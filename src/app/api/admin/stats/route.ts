import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("registrations").select("payment_status, amount");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = {
    total: data.length,
    approved: data.filter((row) => row.payment_status === "approved").length,
    pending: data.filter((row) => row.payment_status === "pending" || row.payment_status === "manual_review").length,
    rejected: data.filter((row) => row.payment_status === "rejected" || row.payment_status === "duplicate").length,
    revenue: data
      .filter((row) => row.payment_status === "approved")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
  };

  return NextResponse.json({ stats });
}
