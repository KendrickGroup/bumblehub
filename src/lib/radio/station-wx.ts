export type StationWx = {
  temperature: number;
  condition: string;
};

const cache = new Map<string, { at: number; weather: StationWx | null }>();
const TTL_MS = 60 * 60 * 1000;

export function stationWxCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function readStationWxCache(key: string): StationWx | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at >= TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.weather;
}

export function writeStationWxCache(key: string, weather: StationWx | null) {
  cache.set(key, { at: Date.now(), weather });
}

/** Short lowercase Open-Meteo condition, e.g. "light rain". */
export function wmoConditionText(code: number): string {
  if (code === 0) return "clear";
  if (code === 1) return "mainly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code === 51 || code === 56) return "light drizzle";
  if (code === 53) return "drizzle";
  if (code === 55 || code === 57) return "heavy drizzle";
  if (code === 61 || code === 66) return "light rain";
  if (code === 63) return "rain";
  if (code === 65 || code === 67) return "heavy rain";
  if (code === 71) return "light snow";
  if (code === 73 || code === 77) return "snow";
  if (code === 75) return "heavy snow";
  if (code === 80) return "light showers";
  if (code === 81) return "showers";
  if (code === 82) return "heavy showers";
  if (code === 85) return "light snow showers";
  if (code === 86) return "snow showers";
  if (code === 95) return "thunderstorm";
  if (code === 96 || code === 99) return "thunderstorm with hail";
  return "cloudy";
}

export async function fetchStationWx(
  latitude: number,
  longitude: number,
): Promise<StationWx | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code",
    temperature_unit: "fahrenheit",
    timezone: "auto",
  });
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const temp = data.current?.temperature_2m;
  const code = data.current?.weather_code;
  if (typeof temp !== "number" || typeof code !== "number") return null;
  return {
    temperature: Math.round(temp),
    condition: wmoConditionText(code),
  };
}
