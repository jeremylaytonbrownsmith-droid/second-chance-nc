import Link from "next/link";

export function HubCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-brand-lavender bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-purple hover:shadow-md active:translate-y-0"
    >
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      <span className="mt-3 text-base font-semibold text-neutral-900 group-hover:text-brand-purple">
        {title}
      </span>
      <span className="mt-1 text-sm text-neutral-500">{description}</span>
    </Link>
  );
}
