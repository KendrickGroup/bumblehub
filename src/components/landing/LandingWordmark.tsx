/** Landing / marketing text wordmark — no images. */
export function LandingWordmark({
  className = "",
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={`font-[family-name:var(--font-bricolage)] leading-none ${className}`}
      style={{ fontSize: size, fontWeight: 700 }}
      aria-label="BumbleHub"
    >
      <span style={{ color: "#1a1a1a" }}>Bumble</span>
      <span style={{ color: "#E0972B" }}>Hub</span>
    </span>
  );
}
