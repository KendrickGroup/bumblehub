"use client";

/**
 * Pick banner products out of the shop instead of uploading photos and typing
 * names. Nothing here is typed except an optional pitch override: the title,
 * photo, price, and link all come from Shopify.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Crop,
  Search,
  Trash2,
} from "lucide-react";
import {
  BANNER_LINE_MAX,
  BANNER_MAX_PICKS,
  BANNER_PITCH_MAX,
  BANNER_DEFAULT_LINE,
  type BannerProduct,
  type BannerSource,
} from "@/lib/radio/banner";
import { frameImageStyle, type BannerFrame } from "@/lib/radio/banner-frame";
import { shopifyImageUrl } from "@/lib/shopify/image";
import { notifyRadioStationsChanged } from "@/lib/radio/types";
import { ProductFramer } from "@/components/settings/ProductFramer";

type CatalogProduct = {
  handle: string;
  title: string;
  url: string;
  image: string;
  description: string;
  price: string;
  currency: string;
};

type CatalogBody = {
  products?: CatalogProduct[];
  strategy?: string;
  stale?: boolean;
  error?: { code: string; message: string } | null;
};

type PicksBody = {
  banner_picks?: BannerProduct[];
  banner_source?: BannerSource;
  error?: string;
};

type Props = {
  hasProperty: boolean;
  initialPicks: BannerProduct[];
  initialUploads: BannerProduct[];
  initialLines: string[];
  initialSource: BannerSource;
};

const SEARCH_DEBOUNCE_MS = 350;

type CatalogView = {
  products: CatalogProduct[];
  stale: boolean;
  error: string | null;
};

async function readCatalog(query: string): Promise<CatalogView> {
  try {
    const url = query
      ? `/api/settings/shop/catalog?q=${encodeURIComponent(query)}`
      : "/api/settings/shop/catalog";
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as CatalogBody;
    return {
      products: body.products ?? [],
      stale: body.stale === true,
      error: body.error
        ? body.error.code === "not_configured"
          ? "Shopify keys are not set on this deployment."
          : `Shopify did not answer: ${body.error.message}`
        : null,
    };
  } catch {
    return { products: [], stale: false, error: "Could not reach the shop." };
  }
}

function money(price: string, currency: string): string {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${price}`;
  }
}

export function ShopPicksPanel({
  hasProperty,
  initialPicks,
  initialUploads,
  initialLines,
  initialSource,
}: Props) {
  const [picks, setPicks] = useState(initialPicks);
  const [uploads, setUploads] = useState(initialUploads);
  const [source, setSource] = useState<BannerSource>(initialSource);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogStale, setCatalogStale] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [framing, setFraming] = useState<BannerProduct | null>(null);
  const [lines, setLines] = useState(initialLines.join("\n"));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pitchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyCatalog = useCallback((view: CatalogView) => {
    setCatalog(view.products);
    setCatalogStale(view.stale);
    setCatalogError(view.error);
    setLoadingCatalog(false);
  }, []);

  const loadCatalog = useCallback(
    (query: string) => {
      void readCatalog(query).then(applyCatalog);
    },
    [applyCatalog],
  );

  useEffect(() => {
    let alive = true;
    void readCatalog("").then((view) => {
      if (alive) applyCatalog(view);
    });
    return () => {
      alive = false;
    };
  }, [applyCatalog]);

  useEffect(() => {
    const pitches = pitchTimers.current;
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (lineTimer.current) clearTimeout(lineTimer.current);
      for (const timer of Object.values(pitches)) clearTimeout(timer);
    };
  }, []);

  const onTermChange = (value: string) => {
    setTerm(value);
    setLoadingCatalog(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadCatalog(value.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const sendPicks = async (body: Record<string, unknown>) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/settings/shop/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as PicksBody;
      if (!response.ok) {
        setError(payload.error ?? "Could not save that.");
        return null;
      }
      if (payload.banner_picks) setPicks(payload.banner_picks);
      if (payload.banner_source) setSource(payload.banner_source);
      notifyRadioStationsChanged();
      return payload;
    } catch {
      setError("Could not save that.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (product: CatalogProduct) => {
    const picked = picks.some((item) => item.handle === product.handle);
    if (picked) {
      await sendPicks({ action: "remove", handle: product.handle });
      return;
    }
    await sendPicks({
      action: "add",
      product: {
        handle: product.handle,
        title: product.title,
        url: product.url,
        image: product.image,
        pitch: product.description,
        price: product.price,
        currency: product.currency,
      },
    });
  };

  const saveFrame = (handle: string) => (frame: BannerFrame) => {
    void sendPicks({ action: "frame", handle, frame });
  };

  const patchPitch = (handle: string, value: string) => {
    setPicks((current) =>
      current.map((item) =>
        item.handle === handle ? { ...item, pitch: value } : item,
      ),
    );
    if (pitchTimers.current[handle]) clearTimeout(pitchTimers.current[handle]);
    pitchTimers.current[handle] = setTimeout(() => {
      void sendPicks({ action: "pitch", handle, pitch: value });
    }, 600);
  };

  const removeUpload = async (url: string) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/settings/radio-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", url }),
      });
      if (!response.ok) {
        setError("Could not remove that photo.");
        return;
      }
      setUploads((current) => current.filter((item) => item.image !== url));
      notifyRadioStationsChanged();
    } catch {
      setError("Could not remove that photo.");
    } finally {
      setBusy(false);
    }
  };

  const saveLines = async (value: string) => {
    try {
      const response = await fetch("/api/settings/radio-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lines", lines: value }),
      });
      if (!response.ok) setError("Could not save banner lines.");
      else notifyRadioStationsChanged();
    } catch {
      setError("Could not save banner lines.");
    }
  };

  const onLinesChange = (value: string) => {
    setLines(value);
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => void saveLines(value), 600);
  };

  const pickedHandles = new Set(picks.map((item) => item.handle));
  const full = picks.length >= BANNER_MAX_PICKS;

  return (
    <div className="mt-5 rounded-[16px] border border-stone-100 bg-[#FAF8F3] px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Banner Products
        </h3>
        <span className="text-xs font-semibold text-stone-700">
          {picks.length} in rotation
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        {source === "picks"
          ? "The banner is running your picked products. Tap one to frame its thumbnail."
          : uploads.length > 0
            ? `The banner is still running ${uploads.length} hand-uploaded photo${
                uploads.length === 1 ? "" : "s"
              }. Pick one product below and the picks take over.`
            : "Pick products from the shop. The banner shows a silver concho until you do."}
      </p>

      {!hasProperty ? (
        <p className="mt-3 text-sm text-stone-500">
          No property yet — picks save once one exists.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
      ) : null}
      {catalogError ? (
        <p
          className="mt-3 rounded-[12px] border border-[#C9A227]/50 bg-[#FBF0D0] px-3 py-2 text-sm text-stone-800"
          role="status"
        >
          {catalogError}
          {catalogStale ? " Showing the last list the shop gave us." : ""}
        </p>
      ) : null}

      {picks.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {picks.map((product, index) => {
            const framed = Boolean(product.frame);
            return (
              <li
                key={product.handle}
                className="rounded-[12px] border border-stone-200 bg-white p-3"
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="relative block h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[8px] border border-stone-200 bg-[#F4E9D4]"
                    aria-label={`Frame ${product.name}`}
                    onClick={() => setFraming(product)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopifyImageUrl(product.image, 400)}
                      alt=""
                      className="absolute max-w-none object-cover"
                      style={frameImageStyle(product.frame ?? null)}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {money(product.price ?? "", product.currency ?? "USD")}
                          {money(product.price ?? "", product.currency ?? "USD")
                            ? " · "
                            : ""}
                          {framed ? "Framed" : "Centered"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="rounded-full border border-stone-200 p-1.5 text-stone-600 disabled:opacity-40"
                          aria-label={`Move ${product.name} up`}
                          disabled={busy || index === 0}
                          onClick={() =>
                            void sendPicks({
                              action: "move",
                              handle: product.handle,
                              direction: "up",
                            })
                          }
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-stone-200 p-1.5 text-stone-600 disabled:opacity-40"
                          aria-label={`Move ${product.name} down`}
                          disabled={busy || index === picks.length - 1}
                          onClick={() =>
                            void sendPicks({
                              action: "move",
                              handle: product.handle,
                              direction: "down",
                            })
                          }
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-stone-200 p-1.5 text-stone-600"
                          aria-label={`Remove ${product.name}`}
                          disabled={busy}
                          onClick={() =>
                            void sendPicks({
                              action: "remove",
                              handle: product.handle,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <label className="mt-2 block text-xs font-medium uppercase tracking-wide text-stone-500">
                      Pitch
                      <input
                        value={product.pitch}
                        maxLength={BANNER_PITCH_MAX}
                        onChange={(e) =>
                          patchPitch(product.handle!, e.target.value)
                        }
                        className="mt-1 w-full rounded-[10px] border border-stone-200 bg-[#FAF8F3] px-3 py-1.5 text-sm text-stone-800"
                        placeholder="From the Shopify description. Edit to override."
                      />
                    </label>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-[#3E2F20]"
                      onClick={() => setFraming(product)}
                    >
                      <Crop className="h-3.5 w-3.5" aria-hidden />
                      Frame thumbnail
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <label className="mt-5 block">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Find a product
        </span>
        <span className="relative mt-1 block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <input
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
            className="w-full rounded-[10px] border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-800"
            placeholder="Search the whole shop by name"
          />
        </span>
      </label>
      <p className="mt-1 text-xs text-stone-500">
        {term.trim()
          ? "Search results"
          : "Best sellers first. Search for anything outside them."}
        {full ? ` · the banner holds ${BANNER_MAX_PICKS}` : ""}
      </p>

      {loadingCatalog ? (
        <p className="mt-3 text-sm text-stone-500">Reading the shop…</p>
      ) : catalog.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">
          {term.trim() ? "Nothing by that name." : "No products came back."}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {catalog.map((product) => {
            const picked = pickedHandles.has(product.handle);
            return (
              <li key={product.handle}>
                <button
                  type="button"
                  className={`relative block w-full overflow-hidden rounded-[10px] border bg-white text-left ${
                    picked
                      ? "border-[#F4B400] ring-2 ring-[#F4B400]/60"
                      : "border-stone-200"
                  }`}
                  aria-pressed={picked}
                  disabled={busy || (full && !picked)}
                  onClick={() => void toggle(product)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shopifyImageUrl(product.image, 400)}
                    alt=""
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  {picked ? (
                    <span className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-[#F4B400] text-[#3E2F20] shadow">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                  <span className="block px-2 py-1.5 text-[11px] font-medium leading-tight text-stone-700 line-clamp-2">
                    {product.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {uploads.length > 0 ? (
        <div className="mt-5 rounded-[12px] border border-stone-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Hand-uploaded photos
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Kept as they were.{" "}
            {source === "picks"
              ? "The picked products are what the banner shows now."
              : "These run until you pick a product."}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {uploads.map((product) => (
              <li key={product.image} className="relative h-[56px] w-[56px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt=""
                  className="h-full w-full rounded-[8px] object-cover"
                />
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-white p-1 text-stone-700 shadow"
                  aria-label="Remove uploaded photo"
                  disabled={busy}
                  onClick={() => void removeUpload(product.image)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-stone-500">
        Banner lines
        <textarea
          value={lines}
          onChange={(e) => onLinesChange(e.target.value)}
          onBlur={() => void saveLines(lines)}
          rows={6}
          maxLength={BANNER_LINE_MAX * 40}
          className="mt-2 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2 font-[family-name:var(--font-elite)] text-sm text-stone-800"
          placeholder={BANNER_DEFAULT_LINE}
        />
      </label>
      <p className="mt-1 text-xs text-stone-500">
        One line per row. Used when a product has no pitch of its own.
      </p>

      {framing ? (
        <ProductFramer
          product={picks.find((item) => item.handle === framing.handle) ?? framing}
          onSave={saveFrame(framing.handle!)}
          onClose={() => setFraming(null)}
        />
      ) : null}
    </div>
  );
}
