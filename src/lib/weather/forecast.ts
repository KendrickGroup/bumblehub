import { weatherCodeToBucket, weatherLabel, type WeatherBucket } from "./codes";
import type { TemperatureUnit } from "./open-meteo";

export type ForecastDay = {
  date: string;
  weekday: string;
  bucket: WeatherBucket;
  label: string;
  high: number;
  low: number;
  precipProb: number | null;
};

export async function fetchOpenMeteoDaily(
  latitude: number,
  longitude: number,
  temperatureUnit: TemperatureUnit,
  timezone: string,
): Promise<ForecastDay[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: temperatureUnit === "celsius" ? "celsius" : "fahrenheit",
    timezone: timezone || "auto",
    forecast_days: "7",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Open-Meteo daily request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max?: Array<number | null>;
    };
  };

  const daily = data.daily;
  if (!daily?.time?.length) return [];

  return daily.time.slice(0, 7).map((date, index) => {
    const code = daily.weather_code[index] ?? 3;
    const bucket = weatherCodeToBucket(code);
    const parsed = new Date(`${date}T12:00:00`);
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: timezone || undefined,
    }).format(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    const precip = daily.precipitation_probability_max?.[index];
    return {
      date,
      weekday: index === 0 ? "Today" : weekday,
      bucket,
      label: weatherLabel(bucket, true),
      high: Math.round(daily.temperature_2m_max[index] ?? 0),
      low: Math.round(daily.temperature_2m_min[index] ?? 0),
      precipProb: typeof precip === "number" ? Math.round(precip) : null,
    };
  });
}
