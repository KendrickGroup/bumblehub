import "server-only";

/**
 * One call: Bulk Subscribe Profiles.
 *
 * Klaviyo is the mailing list; radio_subscribers is our receipt. This returns a
 * reason string instead of throwing, because a listener must never be shown a
 * Klaviyo problem — the caller records the reason and still says thank you.
 */

const KLAVIYO_URL = "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/";

/** Latest stable revision (GA 2026-07-15). The header is required. */
const KLAVIYO_REVISION = "2026-07-15";

const TIMEOUT_MS = 8000;

export type KlaviyoResult =
  | { ok: true }
  | { ok: false; skipped: boolean; reason: string };

export function klaviyoListId(): string {
  return (process.env.KLAVIYO_LIST_ID ?? "").trim();
}

export function klaviyoConfigured(): boolean {
  return Boolean((process.env.KLAVIYO_PRIVATE_KEY ?? "").trim() && klaviyoListId());
}

export async function subscribeToKlaviyo({
  email,
  stationCall,
}: {
  email: string;
  stationCall: string | null;
}): Promise<KlaviyoResult> {
  const key = (process.env.KLAVIYO_PRIVATE_KEY ?? "").trim();
  const listId = klaviyoListId();
  if (!key || !listId) {
    const missing = [
      key ? null : "KLAVIYO_PRIVATE_KEY",
      listId ? null : "KLAVIYO_LIST_ID",
    ]
      .filter(Boolean)
      .join(", ");
    return { ok: false, skipped: true, reason: `sync skipped: ${missing} not set` };
  }

  const body = {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        custom_source: "Latigo Radio",
        historical_import: false,
        profiles: {
          data: [
            {
              type: "profile",
              attributes: {
                email,
                properties: {
                  signup_source: "Latigo Radio",
                  first_station: stationCall ?? "",
                },
                subscriptions: {
                  email: { marketing: { consent: "SUBSCRIBED" } },
                },
              },
            },
          ],
        },
      },
      relationships: { list: { data: { type: "list", id: listId } } },
    },
  };

  try {
    const response = await fetch(KLAVIYO_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
        accept: "application/vnd.api+json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (response.ok) return { ok: true };

    const detail = (await response.text().catch(() => "")).slice(0, 400);
    return {
      ok: false,
      skipped: false,
      reason: `klaviyo ${response.status}: ${detail || "no body"}`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, skipped: false, reason: `klaviyo unreachable: ${reason}` };
  }
}
