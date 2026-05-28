import type { WeatherBucket } from "@/lib/weather/codes";

type IconProps = { className?: string };

export function WeatherIcon({
  bucket,
  isDay,
  className = "h-10 w-10",
}: {
  bucket: WeatherBucket;
  isDay: boolean;
  className?: string;
}) {
  switch (bucket) {
    case "clear":
      return isDay ? <SunIcon className={className} /> : <MoonIcon className={className} />;
    case "partly_cloudy":
      return <PartlyCloudyIcon className={className} />;
    case "cloudy":
      return <CloudIcon className={className} />;
    case "fog":
      return <FogIcon className={className} />;
    case "drizzle":
      return <RainIcon className={className} light />;
    case "rain":
      return <RainIcon className={className} />;
    case "snow":
      return <SnowIcon className={className} />;
    case "thunderstorm":
      return <StormIcon className={className} />;
    default:
      return <CloudIcon className={className} />;
  }
}

function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="9" fill="#F4B400" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="22"
          y="4"
          width="4"
          height="7"
          rx="2"
          fill="#F4B400"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        d="M28 8c-8 2-14 10-14 18s6 16 14 18c-10-2-17-12-17-22S18 10 28 8z"
        fill="#C8D4E8"
      />
      <circle cx="30" cy="14" r="2" fill="#E8EDF5" opacity="0.7" />
      <circle cx="34" cy="22" r="1.5" fill="#E8EDF5" opacity="0.5" />
    </svg>
  );
}

function CloudIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="22" cy="28" rx="14" ry="10" fill="#B8C4D4" />
      <ellipse cx="30" cy="26" rx="12" ry="9" fill="#A8B4C4" />
      <ellipse cx="26" cy="30" rx="16" ry="8" fill="#C4CEDC" />
    </svg>
  );
}

function PartlyCloudyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <circle cx="16" cy="16" r="7" fill="#F4B400" />
      <rect x="14" y="4" width="4" height="5" rx="2" fill="#F4B400" />
      <rect x="14" y="23" width="4" height="5" rx="2" fill="#F4B400" />
      <rect x="4" y="14" width="5" height="4" rx="2" fill="#F4B400" />
      <ellipse cx="30" cy="30" rx="14" ry="10" fill="#B8C4D4" />
      <ellipse cx="36" cy="28" rx="10" ry="8" fill="#A8B4C4" />
    </svg>
  );
}

function FogIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="20" rx="14" ry="9" fill="#C4CEDC" />
      <rect x="8" y="30" width="32" height="3" rx="1.5" fill="#A8B4C4" opacity="0.8" />
      <rect x="12" y="36" width="24" height="3" rx="1.5" fill="#98A4B4" opacity="0.7" />
      <rect x="10" y="42" width="28" height="3" rx="1.5" fill="#8894A4" opacity="0.6" />
    </svg>
  );
}

function RainIcon({ className, light }: IconProps & { light?: boolean }) {
  const drop = light ? "#7EB8E8" : "#4A9AD4";
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="18" rx="14" ry="10" fill="#A8B4C4" />
      <ellipse cx="30" cy="16" rx="10" ry="8" fill="#98A4B4" />
      <path d="M14 28 L11 36" stroke={drop} strokeWidth="3" strokeLinecap="round" />
      <path d="M22 28 L19 36" stroke={drop} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 28 L27 36" stroke={drop} strokeWidth="3" strokeLinecap="round" />
      <path d="M38 28 L35 36" stroke={drop} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SnowIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="16" rx="14" ry="9" fill="#D8E4F0" />
      <circle cx="14" cy="30" r="2.5" fill="#FFFFFF" stroke="#C8D8E8" strokeWidth="1" />
      <circle cx="24" cy="34" r="2.5" fill="#FFFFFF" stroke="#C8D8E8" strokeWidth="1" />
      <circle cx="34" cy="30" r="2.5" fill="#FFFFFF" stroke="#C8D8E8" strokeWidth="1" />
      <circle cx="19" cy="40" r="2" fill="#FFFFFF" stroke="#C8D8E8" strokeWidth="1" />
      <circle cx="29" cy="40" r="2" fill="#FFFFFF" stroke="#C8D8E8" strokeWidth="1" />
    </svg>
  );
}

function StormIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="16" rx="14" ry="10" fill="#6A7A8C" />
      <ellipse cx="30" cy="14" rx="10" ry="8" fill="#5A6A7C" />
      <path
        d="M26 24 L20 34 L24 34 L22 42 L30 30 L26 30 Z"
        fill="#F4B400"
      />
    </svg>
  );
}
