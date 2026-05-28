import { getValidSpotifyAccessToken } from "./tokens";

export async function spotifyApiFetch(
  propertyId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const accessToken = await getValidSpotifyAccessToken(propertyId);
  const url = path.startsWith("https://")
    ? path
    : `https://api.spotify.com/v1${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
}
