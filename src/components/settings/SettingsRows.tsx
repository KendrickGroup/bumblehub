import Link from "next/link";
import type { ReactNode } from "react";

export function SettingsGroup({
  title,
  children,
  hint,
}: {
  title: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="settings-group">
      <h4>{title}</h4>
      {children}
      {hint ? <p className="settings-hint">{hint}</p> : null}
    </div>
  );
}

export function SettingsRow({
  title,
  hint,
  href,
  value,
  needed,
  badge,
  children,
}: {
  title: string;
  hint?: string;
  href?: string;
  value?: string;
  needed?: boolean;
  badge?: string;
  children?: ReactNode;
}) {
  const navigates = Boolean(href);
  const body = (
    <>
      <span className="settings-lab">
        <b>{title}</b>
        {hint ? <span>{hint}</span> : null}
      </span>
      {needed ? (
        <span className="settings-badge warn">Needed</span>
      ) : badge ? (
        <span className="settings-badge">{badge}</span>
      ) : children ? (
        children
      ) : value ? (
        <span className="settings-value">{value}</span>
      ) : null}
      {navigates ? <span className="settings-chev" aria-hidden /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="settings-row settings-row-link">
        {body}
      </Link>
    );
  }

  return <div className="settings-row">{body}</div>;
}
