export type WeatherBucket =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm";

export function weatherCodeToBucket(code: number): WeatherBucket {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly_cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (
    (code >= 61 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) {
    return "rain";
  }
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "cloudy";
}

export function weatherLabel(
  bucket: WeatherBucket,
  isDay: boolean,
): string {
  switch (bucket) {
    case "clear":
      return isDay ? "Sunny" : "Clear";
    case "partly_cloudy":
      return "Partly";
    case "cloudy":
      return "Cloudy";
    case "fog":
      return "Fog";
    case "drizzle":
      return "Drizzle";
    case "rain":
      return "Rain";
    case "snow":
      return "Snow";
    case "thunderstorm":
      return "Storm";
    default:
      return "Cloudy";
  }
}
