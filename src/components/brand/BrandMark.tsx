type BrandMarkProps = {
  /** bee height in px */
  beeHeight?: number;
  /** wordmark height in px */
  wordmarkHeight?: number;
  className?: string;
  priority?: boolean;
};

/** Bee mark + wordmark side by side. */
export function BrandMark({
  beeHeight = 28,
  wordmarkHeight = 18,
  className = "",
  priority = false,
}: BrandMarkProps) {
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: 10 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/bee.png"
        alt=""
        height={beeHeight}
        className="w-auto object-contain"
        style={{ height: beeHeight }}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/wordmark.png"
        alt="BumbleHub"
        height={wordmarkHeight}
        className="w-auto object-contain"
        style={{ height: wordmarkHeight }}
      />
    </span>
  );
}
