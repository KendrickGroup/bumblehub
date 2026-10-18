import {
  formatSignupWhen,
  type SignupReport,
} from "@/lib/radio/signup-report";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";

export function RadioSignupsPanel({ report }: { report: SignupReport }) {
  return (
    <SettingsGroup
      title="LATIGO RADIO SIGNUPS"
      hint="Emails from the 15% offer on the radio. Read only. Nothing here is sent to Klaviyo."
    >
      <div className="settings-signup-hero">
        <span className="settings-signup-num">
          {report.available ? report.total.toLocaleString("en-US") : "—"}
        </span>
        <span className="settings-signup-label">Total signups</span>
      </div>
      <SettingsRow
        title="Last 24 hours"
        value={report.available ? report.lastDay.toLocaleString("en-US") : "—"}
      />
      <SettingsRow
        title="Last 7 days"
        value={report.available ? report.lastWeek.toLocaleString("en-US") : "—"}
      />
      <SettingsRow
        title="Most recent"
        hint="Pacific time"
        value={
          report.available
            ? report.latest
              ? formatSignupWhen(report.latest)
              : "None yet"
            : "Unavailable"
        }
      />
      {report.available && report.recent.length > 0 ? (
        <table className="settings-signup-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Signed up</th>
            </tr>
          </thead>
          <tbody>
            {report.recent.map((row) => (
              <tr key={`${row.email}-${row.created_at}`}>
                <td>{row.email}</td>
                <td>{formatSignupWhen(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : report.available ? (
        <p className="settings-signup-empty">No signups yet.</p>
      ) : null}
      {report.available ? (
        <a className="settings-signup-download" href="/api/settings/radio-signups">
          Download CSV
        </a>
      ) : null}
    </SettingsGroup>
  );
}
