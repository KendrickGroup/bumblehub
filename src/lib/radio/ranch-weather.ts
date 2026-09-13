import {
  weatherCodeToBucket,
  weatherLabel,
  type WeatherBucket,
} from "@/lib/weather/codes";

export type RanchWeather = {
  temperature: number;
  label: string;
  bucket: WeatherBucket;
  isDay: boolean;
  windSpeed: number;
  windDir: string;
  humidity: number | null;
  sunset: string | null;
  high: number | null;
  low: number | null;
  tomorrowLine: string;
};

function compass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[i]!;
}

function formatClock(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function fetchRanchWeather(
  latitude: number,
  longitude: number,
  timeZone = "America/Los_Angeles",
): Promise<RanchWeather> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,relative_humidity_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunset,wind_speed_10m_max,wind_direction_10m_dominant",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: timeZone,
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    current: {
      temperature_2m: number;
      weather_code: number;
      is_day: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
      relative_humidity_2m?: number;
    };
    daily: {
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      sunset: string[];
      wind_speed_10m_max: number[];
      wind_direction_10m_dominant: number[];
    };
  };

  const current = data.current;
  const isDay = current.is_day === 1;
  const bucket = weatherCodeToBucket(current.weather_code);
  const tomorrowBucket = weatherCodeToBucket(data.daily.weather_code[1] ?? current.weather_code);
  const tHigh = data.daily.temperature_2m_max[1];
  const tLow = data.daily.temperature_2m_min[1];
  const tWind = data.daily.wind_speed_10m_max[1];
  const tDir = data.daily.wind_direction_10m_dominant[1];
  const tomorrowLine = [
    "TOMORROW —",
    weatherLabel(tomorrowBucket, true),
    tHigh != null && tLow != null
      ? `${Math.round(tHigh)}°/${Math.round(tLow)}°`
      : null,
    tWind != null
      ? `wind ${tDir != null ? compass(tDir) + " " : ""}${Math.round(tWind)}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    temperature: Math.round(current.temperature_2m),
    label: weatherLabel(bucket, isDay),
    bucket,
    isDay,
    windSpeed: Math.round(current.wind_speed_10m),
    windDir: compass(current.wind_direction_10m),
    humidity:
      typeof current.relative_humidity_2m === "number"
        ? Math.round(current.relative_humidity_2m)
        : null,
    sunset: formatClock(data.daily.sunset[0], timeZone),
    high:
      typeof data.daily.temperature_2m_max[0] === "number"
        ? Math.round(data.daily.temperature_2m_max[0]!)
        : null,
    low:
      typeof data.daily.temperature_2m_min[0] === "number"
        ? Math.round(data.daily.temperature_2m_min[0]!)
        : null,
    tomorrowLine,
  };
}
