import type { Registration } from "@/lib/registrations";

type SheetSyncPayload = Partial<Registration> & {
  sync_event: "created" | "reviewed" | "checked_in";
};

export async function syncRegistrationToGoogleSheet(
  registration: Partial<Registration>,
  syncEvent: SheetSyncPayload["sync_event"]
) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return { ok: true, skipped: true };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        ...registration,
        sync_event: syncEvent
      } satisfies SheetSyncPayload)
    });

    if (!response.ok) {
      return { ok: false, error: `Google Sheets responded with ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Google Sheets sync failed"
    };
  }
}
