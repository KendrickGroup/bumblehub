"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Play, Square } from "lucide-react";
import { RoundupRopeMark } from "@/components/music/AudioSourceMarks";
import { formatTunedPlace } from "@/lib/radio/format-place";
import { stationFace } from "@/lib/radio/parse-identity";
import {
  loadFeedEpisodes,
} from "@/lib/radio/feed-cache";
import type { RanchWeather } from "@/lib/radio/ranch-weather";
import type { StationWx } from "@/lib/radio/station-wx";
import {
  chartArtUrlFor,
} from "@/lib/radio/chart-art";
import {
  formatMiles,
  milesFromRanch,
  needlePercent,
  presetsForBand,
  PUBLIC_ROUNDUP_PLAYLIST_URL,
  spotifySearchUrl,
  stateCodeFromLabel,
  type RadioBand,
  type RadioFaceBand,
} from "@/lib/radio/ranch";
import {
  MAX_VISIBLE_STATIONS,
  type RadioStation,
} from "@/lib/radio/types";
import {
  playStaticCrackle,
  unlockStaticCrackle,
} from "@/lib/radio/static-crackle";
import { useRadioNowPlaying } from "@/lib/radio/use-radio-now-playing";
import {
  getRadioFeedNow,
  getRadioPlayerState,
  playRadio,
  radioIsLive,
  rememberTunedStation,
  setRadioVolume,
  stopRadioPlayback,
  useRadioPlayer,
} from "@/lib/radio/use-radio-player";
import {
  useRadioStations,
  useTunedStationId,
} from "@/lib/radio/use-radio-stations";
import { RadioHandleModal } from "@/components/radio/RadioHandleModal";
import { chartTitle, StationChart } from "@/components/radio/StationChart";
import { StateFlagIcon } from "@/components/radio/StateFlagIcon";
import { useRadioMediaSession } from "@/components/radio/use-radio-media-session";
import {
  WX_NOW_PLAYING_CONTEXT,
  WX_NOW_PLAYING_TITLE,
  WX_STATION_ID,
  makeWxStation,
} from "@/lib/radio/wx-stream";

const NEEDLE_EASE = "left 550ms cubic-bezier(0.4, 0.1, 0.2, 1)";
const VOLUME_STEPS = [0.2, 0.4, 0.6, 0.8, 1] as const;
const FM_NUMS = ["88", "92", "96", "100", "104", "108"];
const AM_NUMS = ["540", "700", "900", "1100", "1400", "1700"];

function volumeRotation(volume: number): number {
  return -135 + Math.min(1, Math.max(0, volume)) * 270;
}

function bandLabel(band: RadioFaceBand): string {
  if (band === "wx") return "WX";
  return band.toUpperCase();
}

function stationTown(cityLabel: string | null | undefined): string {
  if (!cityLabel) return "";
  return cityLabel.split(",")[0]?.trim() || cityLabel.trim();
}

export function RadioDial({ publicMode = false }: { publicMode?: boolean }) {
  const { visible, loaded, wxStreamUrl, chartArt } = useRadioStations({ publicMode });
  const tunedId = useTunedStationId();
  const player = useRadioPlayer();
  const [crackle, setCrackle] = useState(false);
  const [browseBand, setBrowseBand] = useState<RadioFaceBand>("fm");
  const [presetBand, setPresetBand] = useState<RadioBand>("fm");
  const [handleOpen, setHandleOpen] = useState(false);
  const [weather, setWeather] = useState<RanchWeather | null>(null);
  const [stationWx, setStationWx] = useState<StationWx | null>(null);
  const [lassoBusy, setLassoBusy] = useState(false);
  const [lassoNote, setLassoNote] = useState<string | null>(null);
  const [lastRealId, setLastRealId] = useState<string | null>(null);

  const wxStation = useMemo(
    () => (wxStreamUrl.trim() ? makeWxStation(wxStreamUrl.trim()) : null),
    [wxStreamUrl],
  );

  if (tunedId && tunedId !== WX_STATION_ID && lastRealId !== tunedId) {
    setLastRealId(tunedId);
  }

  const playingStation =
    player.stationId === WX_STATION_ID
      ? wxStation
      : (visible.find((s) => s.id === player.stationId) ?? null);
  const selected =
    visible.find((s) => s.id === tunedId) ??
    visible.find((s) => s.id === lastRealId) ??
    (loaded ? (visible[0] ?? null) : null);

  const displayStation = selected;
  const playing = player.status === "playing";
  const buffering = player.status === "buffering";
  const reconnecting = player.reconnectAttempt > 0;
  const failed =
    player.status === "failed" && player.stationId === selected?.id;
  const live = playing || buffering;
  const isFeed = selected?.station_type === "feed";
  const wxFace = browseBand === "wx";
  const archiveFace = Boolean(isFeed && !wxFace);
  const wxPlaying = player.stationId === WX_STATION_ID;
  const wxBroadcastFailed =
    Boolean(wxStreamUrl.trim()) &&
    wxPlaying &&
    player.status === "failed";

  const song = useRadioNowPlaying(
    !isFeed && !wxPlaying && playing ? (playingStation?.stream_url ?? null) : null,
    Boolean(!isFeed && !wxPlaying && playing),
  );
  const feedNow = isFeed && !wxPlaying ? getRadioFeedNow() : null;

  useRadioMediaSession(
    playingStation ?? displayStation,
    song,
    wxPlaying ? null : (feedNow?.title ?? null),
  );

  useEffect(() => {
    for (const station of visible) {
      if (station.station_type === "feed") {
        void loadFeedEpisodes(station.stream_url);
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!selected) return;
    if (selected.band === "fm" || selected.band === "am") {
      /* Keep the flags on a newly tuned station; leave WX browse in place. */
      /* eslint-disable react-hooks/set-state-in-effect */
      setBrowseBand((current) => (current === "wx" ? current : selected.band));
      setPresetBand(selected.band);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [selected?.id, selected?.band]);

  useEffect(() => {
    if (!wxFace) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/radio/public/weather", {
          cache: "no-store",
        });
        const body = (await response.json()) as RanchWeather & {
          status?: string;
        };
        if (!cancelled && body.status !== "error") setWeather(body);
      } catch {
        // keep last
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wxFace]);

  useEffect(() => {
    if (wxFace || archiveFace) {
      setStationWx(null);
      return;
    }
    const lat = displayStation?.latitude;
    const lon = displayStation?.longitude;
    if (lat == null || lon == null) {
      setStationWx(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/radio/stationwx?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
          { cache: "no-store" },
        );
        const body = (await response.json()) as { weather?: StationWx | null };
        if (!cancelled) setStationWx(body.weather ?? null);
      } catch {
        if (!cancelled) setStationWx(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wxFace, archiveFace, displayStation?.latitude, displayStation?.longitude]);

  const presets = useMemo(() => {
    const band: RadioBand =
      browseBand === "wx" ? presetBand : browseBand;
    return presetsForBand(visible, band, MAX_VISIBLE_STATIONS);
  }, [visible, browseBand, presetBand]);

  const parked = !loaded;
  const face = displayStation ? stationFace(displayStation) : null;
  const chartMode = wxFace ? "wx" : archiveFace ? "sports" : "station";
  const stateCode =
    displayStation?.state_code ??
    stateCodeFromLabel(displayStation?.city_label ?? null);

  const spinTitle = wxFace
    ? WX_NOW_PLAYING_TITLE
    : isFeed
      ? feedNow?.title || "Classic Baseball on the Radio"
      : song?.title ||
        (face
          ? `${face.readoutPrimary}${face.readoutFreq ? " " + face.readoutFreq : ""}`
          : "Ranch House Radio");
  const spinArtist = wxFace
    ? WX_NOW_PLAYING_CONTEXT
    : isFeed
      ? displayStation?.station_name || "From the Archive"
      : song?.artist ||
        (displayStation ? formatTunedPlace(displayStation.city_label) : "");

  const showLasso = Boolean(!wxFace && !isFeed && song?.title);

  const retuneFx = useCallback(() => {
    setCrackle(false);
    window.requestAnimationFrame(() => setCrackle(true));
  }, []);

  const onPreset = (station: RadioStation) => {
    setBrowseBand(station.band);
    setPresetBand(station.band);
    const switching = getRadioPlayerState().stationId !== station.id;
    if (radioIsLive()) {
      playRadio(station);
    } else {
      rememberTunedStation(station);
    }
    unlockStaticCrackle();
    if (switching) {
      retuneFx();
      playStaticCrackle();
    }
  };

  const onPlayToggle = () => {
    if (radioIsLive()) {
      stopRadioPlayback();
      return;
    }
    if (wxFace && wxStation) {
      playRadio(wxStation);
      unlockStaticCrackle();
      retuneFx();
      playStaticCrackle();
      return;
    }
    if (!selected) return;
    playRadio(selected);
    unlockStaticCrackle();
    retuneFx();
    playStaticCrackle();
  };

  const cycleVolume = () => {
    const prev = getRadioPlayerState().volume;
    const i = VOLUME_STEPS.findIndex((step) => Math.abs(step - prev) < 0.05);
    const next = VOLUME_STEPS[(i + 1) % VOLUME_STEPS.length]!;
    setRadioVolume(next);
  };

  const onBand = (band: RadioFaceBand) => {
    setBrowseBand(band);
    if (band !== "wx") {
      setPresetBand(band);
      return;
    }
    if (!wxStation) return;
    const switching = getRadioPlayerState().stationId !== WX_STATION_ID;
    playRadio(wxStation);
    unlockStaticCrackle();
    if (switching) {
      retuneFx();
      playStaticCrackle();
    }
  };

  const onLasso = async () => {
    if (!song || lassoBusy) return;
    if (publicMode) {
      window.open(spotifySearchUrl(song.title, song.artist), "_blank", "noopener");
      setLassoNote("Find more ropes on The Latigo Roundup");
      window.setTimeout(() => setLassoNote(null), 2800);
      return;
    }
    setLassoBusy(true);
    try {
      const response = await fetch("/api/radio/lasso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: song.title,
          artist: song.artist,
          artworkUrl: song.artworkUrl,
          stationName: selected?.station_name,
          stationCity: selected?.city_label,
        }),
      });
      const body = (await response.json()) as { status?: string };
      setLassoNote(
        body.status === "duplicate"
          ? "Already in your Roundup"
          : body.status === "roped"
            ? "Roped! Saved to The Latigo Roundup"
            : "Couldn't lasso this one just now.",
      );
      window.setTimeout(() => setLassoNote(null), 2800);
    } catch {
      setLassoNote("Couldn't lasso this one just now.");
      window.setTimeout(() => setLassoNote(null), 2800);
    } finally {
      setLassoBusy(false);
    }
  };

  const miles =
    displayStation?.latitude != null && displayStation?.longitude != null
      ? formatMiles(
          milesFromRanch(displayStation.latitude, displayStation.longitude),
        )
      : "—";

  const scaleBand: RadioFaceBand | "feed" = wxFace
    ? "wx"
    : archiveFace
      ? "feed"
      : (displayStation?.band ?? browseBand);
  const scaleNums = scaleBand === "am" ? AM_NUMS : FM_NUMS;
  const needle = wxFace
    ? needlePercent("wx", null)
    : archiveFace
      ? 50
      : needlePercent(displayStation?.band ?? browseBand, displayStation?.frequency);

  const glassCall = wxFace
    ? "LATIGO"
    : archiveFace
      ? "BASEBALL"
      : face?.readoutPrimary || "—";
  const glassFreq = wxFace
    ? "WX"
    : archiveFace
      ? "CLASSIC"
      : face?.readoutFreq;
  const glassPlace = wxFace
    ? "Ranch House Weather Bureau — Sutter Creek, Calif."
    : archiveFace
      ? "From the Archive"
      : displayStation
        ? formatTunedPlace(displayStation.city_label)
        : "";

  const readoutClass = wxFace ? "is-wx" : archiveFace ? "is-sports" : "";
  const flagCode = chartMode === "sports" ? null : chartMode === "wx" ? "CA" : stateCode;
  const mapArtUrl = chartArtUrlFor(chartArt, chartMode, stateCode);
  const wordsCall = `${glassCall}${glassFreq ? ` ${glassFreq}` : ""}`;
  const wordsCity = glassPlace;
  const wxTown = stationTown(displayStation?.city_label);
  const signal = archiveFace
    ? { text: "● ARCHIVE", className: "radio-sig-archive" }
    : failed
      ? { text: "○ OFF AIR", className: "radio-sig-off" }
      : { text: "● LIVE", className: "radio-sig-live" };
  const plaqueArt = !wxFace && !isFeed ? song?.artworkUrl ?? null : null;

  return (
    <section className={`radio-world mx-auto w-full max-w-[900px] max-sm:h-full max-sm:min-h-0 ${publicMode ? "h-full" : "app-radio"}`}>
      <div
        className={`radio-case ${parked ? "pointer-events-none opacity-40" : ""}`}
      >
        <button
          type="button"
          className={`radio-carry ${publicMode ? "" : "max-sm:hidden"}`}
          onClick={() => setHandleOpen(true)}
          aria-label="Take the Ranch House Radio to go"
        >
          <span className="radio-ring" aria-hidden />
          <span className="radio-handle-bar">To-Go</span>
          <span className="radio-ring" aria-hidden />
        </button>

        <div className="radio-face">
          <div className="radio-maplid">
            <span className="radio-maplid-label">
              <StateFlagIcon code={flagCode} />
              {chartTitle(chartMode, stateCode)}
            </span>
            {!wxFace && !archiveFace && stationWx ? (
              <span className="radio-wxcorner">
                <span className="t">{stationWx.temperature}°</span>
                <span className="c">
                  {stationWx.condition}
                  {wxTown ? (
                    <span className="radio-wxcorner-town">{` in ${wxTown}`}</span>
                  ) : null}
                </span>
              </span>
            ) : null}
            <div className="radio-split">
              <div className="radio-chartwrap">
                {mapArtUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mapArtUrl}
                    alt=""
                    className="radio-chart-art"
                  />
                ) : (
                  <StationChart
                    mode={chartMode}
                    stateCode={stateCode}
                    lon={displayStation?.longitude ?? null}
                    lat={displayStation?.latitude ?? null}
                    cityLabel={wxFace ? "The Ranch" : displayStation?.city_label.split(",")[0] ?? ""}
                    citySub={wxFace ? "Sutter Creek" : null}
                  />
                )}
              </div>
              <div className="radio-words">
                {wxFace ? (
                  <>
                    <p className="radio-wx-temp">
                      {weather ? `${weather.temperature}° ${weather.label}` : "Ranch House Weather"}
                    </p>
                    <p className="radio-words-city">
                      Latigo Ranch House — Sutter Creek, California
                    </p>
                    <div className="radio-readings">
                      <div>
                        <p className="k">Wind</p>
                        <p className="v">
                          {weather
                            ? `${weather.windDir} ${weather.windSpeed} MPH`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="k">Humidity</p>
                        <p className="v">
                          {weather?.humidity != null ? `${weather.humidity}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="k">Sunset</p>
                        <p className="v">{weather?.sunset ?? "—"}</p>
                      </div>
                      <div>
                        <p className="k">High / Low</p>
                        <p className="v">
                          {weather?.high != null && weather?.low != null
                            ? `${weather.high}° / ${weather.low}°`
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <p className="radio-foot">
                      {wxBroadcastFailed
                        ? "Broadcast off the air."
                        : (weather?.tomorrowLine ?? "At the ranch.")}
                    </p>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="radio-words-call">{wordsCall}</p>
                      <p className="radio-words-city">{wordsCity}</p>
                    </div>
                    <div className="radio-readings">
                      <div>
                        <p className="k">Miles from ranch</p>
                        <p className="v">{miles}</p>
                      </div>
                      <div>
                        <p className="k">Signal</p>
                        <p className={`v ${signal.className}`}>{signal.text}</p>
                      </div>
                    </div>
                    <p className="radio-foot">
                      {isFeed
                        ? "Rebroadcast from the golden age of radio, 1934-1974."
                        : displayStation
                          ? `Pulling ${face?.readoutPrimary ?? displayStation.station_name}${
                              face?.readoutFreq ? ` ${face.readoutFreq}` : ""
                            } clear across the country from ${formatTunedPlace(
                              displayStation.city_label,
                            )}.`
                          : "The dial is quiet."}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="radio-gestrip">
            <span className="rbtn" />
            <span className="rbtn round" />
            <span className="gname">RANCH HOUSE RADIO</span>
            <span className="solid">SOLID STATE</span>
          </div>

          <div className="radio-glass">
            <div className="radio-toprow">
              <div className="radio-bandflags">
                {(["fm", "am", "wx"] as const).map((band) => (
                  <button
                    key={band}
                    type="button"
                    className={`radio-bandflag ${band} ${
                      browseBand === band ? "active" : ""
                    }`}
                    onClick={() => onBand(band)}
                  >
                    {bandLabel(band)}
                    {(band === "wx"
                      ? wxPlaying && live
                      : playingStation?.band === band &&
                        playingStation.id !== WX_STATION_ID &&
                        live) ? (
                      <span className="radio-band-dot" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </div>
              <div className={`radio-onair ${playing ? "is-lit" : ""}`}>
                <span className="lamp" aria-hidden />
                ON AIR
              </div>
            </div>

            <div className={`radio-readout ${readoutClass}`}>
              {failed && selected && !wxFace ? (
                <p className="radio-fail">
                  Could not load {selected.station_name}. Try another station.
                </p>
              ) : loaded ? (
                <>
                  <p className="radio-callsign">
                    {glassCall}{" "}
                    {glassFreq ? <span className="freq">{glassFreq}</span> : null}
                  </p>
                  <p className="radio-place">{glassPlace}</p>
                  {reconnecting ? (
                    <p className="radio-reconnect">reconnecting…</p>
                  ) : null}
                </>
              ) : (
                <p className="radio-place">Tuning…</p>
              )}
            </div>

            <div className="radio-scaleline">
              <div className="nums">
                {scaleBand === "feed" ? (
                  <>
                    <span>CLASSIC BASEBALL</span>
                    <span>FROM THE ARCHIVE</span>
                  </>
                ) : scaleBand === "wx" ? (
                  <>
                    <span>TODAY AT THE RANCH</span>
                    <span>7-DAY</span>
                  </>
                ) : (
                  scaleNums.map((n) => <span key={n}>{n}</span>)
                )}
              </div>
              <div
                className="radio-needle"
                style={{ left: `${needle}%`, transition: NEEDLE_EASE }}
                aria-hidden
              />
            </div>

            <div
              className={`pointer-events-none absolute inset-0 rounded-[5px] mix-blend-multiply ${
                crackle ? "radio-crackle" : "opacity-0"
              }`}
              style={{
                background:
                  "repeating-conic-gradient(rgba(240,235,220,.08) 0 .6deg, transparent .6deg 1.2deg)",
              }}
              onAnimationEnd={() => setCrackle(false)}
              aria-hidden
            />
          </div>

          <div className="radio-lower">
            <div className="radio-grillepad" aria-hidden />
            <div className="radio-presets">
              {presets.map((station) => {
                const preset = stationFace(station);
                const active = station.id === selected?.id && !parked && !wxFace;
                return (
                  <button
                    key={station.id}
                    type="button"
                    disabled={parked}
                    onClick={() => onPreset(station)}
                    aria-pressed={active}
                    className={`radio-preset ${active ? "is-active" : ""}`}
                  >
                    <span className="radio-preset-call">{preset.buttonLabel}</span>
                    {preset.buttonSub ? (
                      <span className="radio-preset-freq">{preset.buttonSub}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="radio-grillepad" aria-hidden />
          </div>
          <div className="radio-grilleband">
            <div className="radio-plaque">
              <span className="radio-screwdot tl" aria-hidden />
              <span className="radio-screwdot tr" aria-hidden />
              <span className="radio-screwdot bl" aria-hidden />
              <span className="radio-screwdot br" aria-hidden />
              <p className="radio-plaque-k">Now Spinning</p>
              <div className="radio-plaque-row">
                {plaqueArt ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={plaqueArt} alt="" className="radio-plaque-art" />
                ) : null}
                <div className="radio-plaque-song">
                  <p className="t">{spinTitle}</p>
                  <p className="a">{spinArtist}</p>
                </div>
                {showLasso ? (
                  <button
                    type="button"
                    className="radio-lasso-key"
                    disabled={lassoBusy}
                    onClick={() => void onLasso()}
                    aria-label="Lasso"
                  >
                    <RoundupRopeMark size={18} />
                    LASSO
                  </button>
                ) : null}
              </div>
              {lassoNote ? (
                <p className="radio-lasso-line" role="status">
                  {publicMode ? (
                    <a href={PUBLIC_ROUNDUP_PLAYLIST_URL} target="_blank" rel="noreferrer">
                      {lassoNote}
                    </a>
                  ) : (
                    <>
                      {lassoNote.includes("Roped") ? (
                        <span className="radio-lasso-check">✓ </span>
                      ) : null}
                      {lassoNote}
                    </>
                  )}
                </p>
              ) : null}
            </div>
          </div>

          {presets.length === 0 && loaded ? (
            <p className="mt-3 text-center font-[family-name:var(--font-elite)] text-sm text-[#D9C9A8]">
              No stations on this band.
            </p>
          ) : null}

          <div className="radio-controls">
            <div className="radio-knob-col">
              <button
                type="button"
                disabled={parked}
                onClick={stopRadioPlayback}
                aria-label="Power, stop playback"
                className="radio-knob radio-knob-power"
              />
              <span className="mt-1.5 text-[9px] font-bold tracking-[0.2em] text-[#D9C9A8]">
                POWER
              </span>
            </div>
            <button
              type="button"
              disabled={parked || !selected}
              onClick={onPlayToggle}
              aria-label={live ? "Stop radio" : "Play radio"}
              aria-pressed={live}
              className={`radio-play-honey ${live ? "is-pressed" : ""}`}
            >
              {buffering && !reconnecting ? (
                <LoaderCircle
                  className="h-8 w-8 animate-spin text-[#3E2A1E]"
                  strokeWidth={2.25}
                />
              ) : live ? (
                <Square
                  className="h-7 w-7 text-[#3E2A1E]"
                  strokeWidth={2.25}
                  fill="currentColor"
                />
              ) : (
                <Play
                  className="ml-0.5 h-8 w-8 text-[#3E2A1E]"
                  strokeWidth={2.25}
                  fill="currentColor"
                />
              )}
            </button>
            <div className="radio-knob-col">
              <button
                type="button"
                disabled={parked}
                onClick={cycleVolume}
                aria-label={`Volume ${Math.round(player.volume * 100)} percent`}
                className="radio-knob radio-knob-volume"
                style={{ transform: `rotate(${volumeRotation(player.volume)}deg)` }}
              />
              <span className="mt-1.5 text-[9px] font-bold tracking-[0.2em] text-[#D9C9A8]">
                VOLUME
              </span>
            </div>
          </div>
        </div>
      </div>

      {publicMode ? (
        <p className="radio-public-foot">
          <a href="https://latigocowboy.com" target="_blank" rel="noreferrer">
            Ranch House Radio · Latigo Ranch House · Sutter Creek, California
          </a>
        </p>
      ) : null}

      <RadioHandleModal
        open={handleOpen}
        onClose={() => setHandleOpen(false)}
        variant={publicMode ? "public" : "app"}
      />
    </section>
  );
}
