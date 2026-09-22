"use client";

/**
 * The thumbnail is a window into the shirt; this is the shirt. Tapping the
 * banner opens the whole flat lay over the cabinet without leaving the radio —
 * the stream keeps playing, the dial stays put, and BUY NOW is the only thing
 * that navigates away.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { bannerProductHref, type BannerProduct } from "@/lib/radio/banner";
import { shopifyImageUrl } from "@/lib/shopify/image";

type Props = {
  product: BannerProduct;
  onClose: () => void;
};

function money(price: string | undefined, currency: string | undefined): string {
  const amount = Number(price ?? "");
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

export function BannerProductCard({ product, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const price = money(product.price, product.currency);
  const href = bannerProductHref(product.url, product.handle);

  return createPortal(
    <div className="radio-chart-lb">
      <button
        type="button"
        className="radio-chart-lb-scrim"
        aria-label="Close product"
        onClick={onClose}
      />
      <button
        ref={closeRef}
        type="button"
        className="radio-chart-lb-close"
        aria-label="Close product"
        onClick={onClose}
      >
        <X className="h-6 w-6" strokeWidth={2.25} />
      </button>
      <div
        className="radio-chart-lb-card radio-prod-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="radio-prod-title"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shopifyImageUrl(product.image, 1200)}
          alt={product.name}
          className="radio-prod-photo"
          draggable={false}
        />
        <div className="radio-prod-copy">
          <p id="radio-prod-title" className="radio-prod-name">
            {product.name}
          </p>
          {price ? <p className="radio-prod-price">{price}</p> : null}
          {product.pitch ? (
            <p className="radio-prod-pitch">{product.pitch}</p>
          ) : null}
          <a
            className="radio-prod-buy"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            BUY NOW
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
