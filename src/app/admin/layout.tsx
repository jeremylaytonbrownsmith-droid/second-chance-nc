import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ResetDemoButton } from "./ResetDemoButton";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-lavender-tint text-neutral-900">
      <header className="border-b-4 border-brand-purple bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <a href="/admin" className="inline-flex items-center gap-3">
            <Image
              src="/brand/second-chance-logo.png"
              alt="Second Chance Pet Adoptions"
              width={180}
              height={64}
              priority
              className="h-9 w-auto sm:h-10"
            />
            <span className="hidden text-sm font-medium text-brand-purple-dark sm:inline">
              Auction &amp; Giving
            </span>
          </a>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <a
              href="/admin"
              className="text-brand-purple-dark transition-colors hover:text-brand-purple hover:underline"
            >
              Dashboard
            </a>
            <a
              href="/admin/help"
              className="text-brand-purple-dark transition-colors hover:text-brand-purple hover:underline"
            >
              Help &amp; Guide
            </a>
            <a
              href="/admin/sync-log"
              className="text-brand-purple-dark transition-colors hover:text-brand-purple hover:underline"
            >
              Sync Log
            </a>
            <Link
              href="/bid"
              className="text-brand-purple-dark transition-colors hover:text-brand-purple hover:underline"
            >
              Bidder view
            </Link>
            <ResetDemoButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-brand-lavender bg-white px-4 py-4 text-center text-xs text-neutral-500 sm:px-6">
        Not sure how something works?{" "}
        <a href="/admin/help" className="text-brand-purple hover:underline">
          See the full guide
        </a>
        .
      </footer>
    </div>
  );
}
