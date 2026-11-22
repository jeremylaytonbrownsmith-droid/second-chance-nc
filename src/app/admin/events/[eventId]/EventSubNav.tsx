"use client";

import { usePathname } from "next/navigation";

interface TabLink {
  href: string;
  label: string;
  /** Tab is "active" on an exact match only (the catalog/index route),
   * everything else matches by prefix so a deeper page (e.g. a detail
   * view under /checkin) still highlights its parent tab. */
  exact?: boolean;
}

export function EventSubNav({
  eventId,
  isAdmin,
}: {
  eventId: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const base = `/admin/events/${eventId}`;

  const tabs: TabLink[] = [
    { href: base, label: "Catalog", exact: true },
    { href: `${base}/checkin`, label: "Check in" },
    { href: `${base}/live`, label: "Live board" },
    { href: `${base}/clerk`, label: "Live clerk" },
    { href: `${base}/pickup`, label: "Pickup" },
    { href: "/bid", label: "Bidder view" },
    ...(isAdmin
      ? [
          { href: `${base}/checkout`, label: "Checkout" },
          { href: `${base}/fund-a-need`, label: "Fund a need" },
          { href: `${base}/solicitations`, label: "Solicitations" },
          { href: `${base}/donations/new`, label: "Log a donation" },
          { href: `${base}/import`, label: "Import" },
        ]
      : []),
  ];

  return (
    <nav className="mb-6 flex flex-wrap gap-x-1 gap-y-0 border-b border-neutral-200 text-sm">
      {tabs.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 font-medium transition-colors ${
              isActive
                ? "border-brand-purple text-brand-purple-dark"
                : "border-transparent text-neutral-500 hover:border-brand-lavender hover:text-neutral-900"
            }`}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
