import type { ReactNode } from "react";
import Link from "next/link";

export function HubCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-purple/60 hover:shadow-lg hover:shadow-brand-purple/10 active:translate-y-0"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-lavender-tint to-brand-lavender/60 text-brand-purple transition-colors group-hover:from-brand-purple group-hover:to-brand-purple-dark group-hover:text-white">
        {icon}
      </span>
      <span className="mt-3 text-base font-semibold text-neutral-900 group-hover:text-brand-purple-dark">
        {title}
      </span>
      <span className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</span>
    </Link>
  );
}
