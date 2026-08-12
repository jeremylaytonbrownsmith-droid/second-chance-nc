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
      className="group flex flex-col rounded-lg border border-brand-lavender bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-purple hover:shadow-md active:translate-y-0"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-lavender-tint text-brand-purple transition-colors group-hover:bg-brand-purple group-hover:text-white">
        {icon}
      </span>
      <span className="mt-3 text-base font-semibold text-neutral-900 group-hover:text-brand-purple">
        {title}
      </span>
      <span className="mt-1 text-sm text-neutral-500">{description}</span>
    </Link>
  );
}
