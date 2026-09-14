import { WX_BADGE_INK, WX_BADGE_OLIVE } from "@/lib/radio/wx-stream";

type Props = {
  size?: number;
  className?: string;
};

/** Olive rounded-square WX mark for now-playing art slots. */
export function WxBroadcastBadge({ size = 40, className }: Props) {
  const radius = Math.max(6, Math.round(size * 0.22));
  const typeSize = Math.max(11, Math.round(size * 0.38));
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-extrabold tracking-[0.04em] ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: WX_BADGE_OLIVE,
        color: WX_BADGE_INK,
        fontSize: typeSize,
        lineHeight: 1,
      }}
      aria-hidden
    >
      WX
    </span>
  );
}
