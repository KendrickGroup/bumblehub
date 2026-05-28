import { weatherCodeToBucket, weatherLabel, type WeatherBucket } from "./codes";

export type TemperatureUnit = "fahrenheit" | "celsius";

export type WeatherSnapshot = {
  temperature: number;
  bucket: WeatherBucket;
  label: string;
  isDay: boolean;
  windSpeed: number;
};

type OpenMeteoCurrent = {
  temperature_2m: number;
  weather_code: number;
  is_day: number;
  wind_speed_10m: number;
};

type OpenMeteoResponse = {
  current: OpenMeteoCurrent;
};

export async function fetchOpenMeteoWeather(
  latitude: number,
  longitude: number,
  temperatureUnit: TemperatureUnit,
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,is_day,wind_speed_10m",
    temperature_unit: temperatureUnit === "celsius" ? "celsius" : "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Open-Meteo request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;
  const bucket = weatherCodeToBucket(current.weather_code);
  const isDay = current.is_day === 1;

  return {
    temperature: Math.round(current.temperature_2m),
    bucket,
    label: weatherLabel(bucket, isDay),
    isDay,
    windSpeed: Math.round(current.wind_speed_10m),
  };
}

export async function lookupUsZip(zip: string): Promise<{
  latitude: number;
  longitude: number;
  displayName: string;
}> {
  const normalized = zip.replace(/\D/g, "").slice(0, 5);
  if (normalized.length !== 5) {
    throw new Error("Enter a valid 5-digit US ZIP code.");
  }

  const response = await fetch(
    `https://api.zippopotam.us/us/${normalized}`,
    { next: { revalidate: 86400 } },
  );

  if (response.status === 404) {
    throw new Error("ZIP code not found.");
  }

  if (!response.ok) {
    throw new Error("Could not look up that ZIP code.");
  }

  const data = (await response.json()) as {
    places: Array<{
      latitude: string;
      longitude: string;
      "place name": string;
      "state abbreviation": string;
    }>;
  };

  const place = data.places[0];
  if (!place) {
    throw new Error("ZIP code not found.");
  }

  return {
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    displayName: `${place["place name"]}, ${place["state abbreviation"]}`,
  };
}
