export type RopedSong = {
  id: string;
  property_id: string;
  title: string;
  artist: string | null;
  artwork_url: string | null;
  spotify_track_id: string | null;
  spotify_track_uri: string | null;
  station_name: string | null;
  station_city: string | null;
  roped_by: string | null;
  created_at: string;
};

export const ROPED_SONG_COLUMNS =
  "id, property_id, title, artist, artwork_url, spotify_track_id, spotify_track_uri, station_name, station_city, roped_by, created_at";

export type LassoStatus = "roped" | "duplicate" | "not_found";

export type LassoInput = {
  title: string;
  artist: string | null;
  artworkUrl: string | null;
  stationName: string | null;
  stationCity: string | null;
};
