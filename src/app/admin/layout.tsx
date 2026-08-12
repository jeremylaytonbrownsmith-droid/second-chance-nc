import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ResetDemoButton } from "./ResetDemoButton";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-lavender-tint text-neutral-900">
      <header className="border-b-4 border-brand-purple bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <a href="/admin" className="inline-flex items-center gap-3">
            <Image
              src="/brand/second-chance-logo.png"
              alt="Second Chance Pet Adoptions"
              width={180}
              height={64}
              priority
              className="h-10 w-auto"
            />
            <span className="hidden text-sm font-medium text-brand-purple-dark sm:inline">
              Auction &amp; Giving
            </span>
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/admin" className="text-brand-purple-dark hover:underline">
              Organizations &amp; Events
            </a>
            <a href="/admin/sync-log" className="text-brand-purple-dark hover:underline">
              Sync Log
            </a>
            <Link href="/bid" className="text-brand-purple-dark hover:underline">
              Bidder view
            </Link>
            <ResetDemoButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
