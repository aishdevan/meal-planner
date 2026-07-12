"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CookingPot,
  Refrigerator,
  ShoppingCart,
} from "lucide-react";

const TABS = [
  { href: "/", label: "Today", Icon: CookingPot },
  { href: "/week", label: "Week", Icon: CalendarDays },
  { href: "/grocery", label: "Grocery", Icon: ShoppingCart },
  { href: "/pantry", label: "Pantry", Icon: Refrigerator },
  { href: "/recipes", label: "Recipes", Icon: BookOpen },
];

export function TabBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-glass-strong pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
