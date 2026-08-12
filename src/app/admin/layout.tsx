import type { ReactNode } from "react";
import Image from "next/image";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-brand-lavender-tint text-neutral-900">
      <header className="border-b-4 border-brand-purple bg-white px-6 py-3">
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
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
