import type { PlayReport } from "@/lib/radio/play-report";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";

function num(available: boolean, value: number): string {
  return available ? value.toLocaleString("en-US") : "—";
}

export function RadioPlaysPanel({ report }: { report: PlayReport }) {
  return (
    <SettingsGroup
      title="RADIO PLAYS"
      hint="One count each time a station starts. Listeners are anonymous. Earlier plays were never recorded."
    >
      <div className="settings-signup-hero">
        <span className="settings-signup-num">{num(report.available, report.total)}</span>
        <span className="settings-signup-label">Total plays</span>
      </div>
      <SettingsRow title="Last 24 hours" value={num(report.available, report.lastDay)} />
      <SettingsRow title="Last 7 days" value={num(report.available, report.lastWeek)} />
      <SettingsRow
        title="Unique listeners"
        hint="Anonymous browsers"
        value={num(report.available, report.listeners)}
      />
      {report.available && report.top.length > 0 ? (
        <table className="settings-signup-table">
          <thead>
            <tr>
              <th>Top stations</th>
              <th>Plays</th>
            </tr>
          </thead>
          <tbody>
            {report.top.map((row) => (
              <tr key={row.station}>
                <td>{row.station}</td>
                <td>{row.plays.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : report.available ? (
        <p className="settings-signup-empty">No plays yet.</p>
      ) : null}
    </SettingsGroup>
  );
}
