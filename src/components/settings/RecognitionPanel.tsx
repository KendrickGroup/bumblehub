import {
  RECOGNITION_ENABLED,
  auddMonthlyLimit,
  auddToken,
} from "@/lib/radio/recognition";
import { fetchAuddUsage } from "@/lib/radio/recognition-store";
import { SettingsGroup, SettingsRow } from "./SettingsRows";

export async function RecognitionPanel() {
  const usage = await fetchAuddUsage();
  const hasToken = Boolean(auddToken());
  const limit = auddMonthlyLimit();
  const reason = !RECOGNITION_ENABLED
    ? "Off. Set NEXT_PUBLIC_RECOGNITION_ENABLED to true in Vercel."
    : !hasToken
      ? "AUDD_API_TOKEN is not set. Recognition stays off."
      : usage.calls >= limit
        ? "This month's ceiling is hit. Falling back to metadata."
        : "AudD identifies a song only when a station sends no usable metadata. Public listeners read the cache and never spend a call.";

  return (
    <SettingsGroup title="SONG RECOGNITION" hint={reason}>
      <SettingsRow
        title="Recognition"
        hint="NEXT_PUBLIC_RECOGNITION_ENABLED"
        value={RECOGNITION_ENABLED ? "On" : "Off"}
      />
      <SettingsRow
        title="AudD token"
        hint="AUDD_API_TOKEN"
        value={hasToken ? "Set" : "Not set"}
        needed={RECOGNITION_ENABLED && !hasToken}
      />
      <SettingsRow
        title="Monthly ceiling"
        hint="AUDD_MONTHLY_LIMIT"
        value={String(limit)}
      />
      <SettingsRow
        title="Calls this month"
        hint={usage.month}
        value={`${usage.calls} / ${limit}`}
      />
      {usage.stations.length === 0 ? (
        <SettingsRow title="Stations that need it" value="None yet" />
      ) : (
        usage.stations.map((row) => (
          <SettingsRow
            key={row.stationCall}
            title={row.stationCall}
            hint="AudD calls this month"
            value={String(row.calls)}
          />
        ))
      )}
    </SettingsGroup>
  );
}
