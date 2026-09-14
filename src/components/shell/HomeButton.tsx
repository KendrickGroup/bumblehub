"use client";

import Link from "next/link";
import { BeeMark } from "@/components/brand/AppBrandLockup";

type Props = {
  variant?: "cream" | "leather";
};

export function HomeButton({ variant = "cream" }: Props) {
  const leather = variant === "leather";
  return (
    <Link
      href="/home"
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-3.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${
        leather
          ? "bg-[#6B4F36] text-[#EFE7D2] shadow-[0_2px_6px_rgba(0,0,0,.35)] hover:bg-[#7E5F42]"
          : "border border-stone-200/80 bg-white text-[#241A12] hover:border-[#F4B400]/50"
      }`}
    >
      <BeeMark size={22} />
      Home
    </Link>
  );
}
