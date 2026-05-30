"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  Home,
  Music,
  Settings,
  Users,
} from "lucide-react";

const TABS = [
  { href: "/home", label: "Home", icon: Home, match: (p: string) => p === "/home" },
  {
    href: "/music",
    label: "Music",
    icon: Music,
    match: (p: string) => p === "/music",
  },
  {
    href: "/recipes",
    label: "Recipes",
    icon: ChefHat,
    match: (p: string) => p === "/recipes" || p.startsWith("/recipes/"),
  },
  {
    href: "/hive",
    label: "Hive",
    icon: Users,
    match: (p: string) =>
      p === "/hive" || p === "/guestbook" || p.startsWith("/guestbook/"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    match: (p: string) => p === "/settings",
  },
] as const;

export function AppTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="border-t border-stone-200/90 bg-white shadow-[0_-4px_24px_rgba(42,37,32,0.06)]"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-[1200px]">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 transition hover:bg-[#FAF8F3]/80 ${
                  active ? "text-[#F4B400]" : "text-[#7A7066]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    active ? "bg-[#F4B400]/18" : ""
                  }`}
                >
                  <Icon
                    className="h-6 w-6"
                    strokeWidth={active ? 2.25 : 1.75}
                    aria-hidden
                  />
                </span>
                <span
                  className={`text-[11px] font-medium leading-none ${
                    active ? "text-[#F4B400]" : "text-[#7A7066]"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
