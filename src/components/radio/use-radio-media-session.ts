"use client";

import { useEffect } from "react";
import type { RadioNowPlayingTrack } from "@/lib/radio/icy";
import type { RadioStation } from "@/lib/radio/types";
import { stationFace } from "@/lib/radio/parse-identity";
import { wxBadgeArtworkDataUrl } from "@/lib/radio/wx-artwork";
import {
  WX_NOW_PLAYING_CONTEXT,
  WX_NOW_PLAYING_TITLE,
  isWxBroadcast,
} from "@/lib/radio/wx-stream";
import {
  playRadio,
  stopRadioPlayback,
  useRadioPlayer,
} from "@/lib/radio/use-radio-player";

export function useRadioMediaSession(
  station: RadioStation | null,
  track: RadioNowPlayingTrack | null,
  feedTitle: string | null,
) {
  const player = useRadioPlayer();
  const wx = isWxBroadcast(player.stationId) || isWxBroadcast(station?.id);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const face = station ? stationFace(station) : null;
    const title = wx
      ? WX_NOW_PLAYING_TITLE
      : track?.title ||
        feedTitle ||
        (face
          ? `${face.readoutPrimary}${face.readoutFreq ? " " + face.readoutFreq : ""}`
          : "Ranch House Radio");
    const artist = wx
      ? WX_NOW_PLAYING_CONTEXT
      : track?.artist || station?.city_label || "Ranch House Radio";
    const wxArt = wx ? wxBadgeArtworkDataUrl() : "";
    const artwork = wx
      ? wxArt
        ? [{ src: wxArt, sizes: "512x512", type: "image/png" }]
        : []
      : track?.artworkUrl
        ? [{ src: track.artworkUrl, sizes: "512x512", type: "image/jpeg" }]
        : [{ src: "/radio/icon-512.png", sizes: "512x512", type: "image/png" }];

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: wx
          ? "Ranch House Radio"
          : station?.station_name || "Ranch House Radio",
        artwork,
      });
      navigator.mediaSession.playbackState =
        player.status === "playing" ? "playing" : "paused";
      navigator.mediaSession.setActionHandler("play", () => {
        if (station) playRadio(station);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        stopRadioPlayback();
      });
    } catch {
      // Older iOS may reject some handlers.
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
      } catch {
        // ignore
      }
    };
  }, [station, track, feedTitle, player.status, wx]);
}
