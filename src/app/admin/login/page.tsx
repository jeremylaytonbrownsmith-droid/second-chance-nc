import Image from "next/image";
import { loginAction } from "./actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-lavender-tint to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Image
            src="/brand/second-chance-logo.png"
            alt="Second Chance Pet Adoptions"
            width={200}
            height={72}
            priority
            className="h-14 w-auto"
          />
        </div>

        <div className="rounded-2xl border border-brand-lavender/50 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-purple">Staff access</p>
          <h1 className="mt-1 text-xl font-bold text-brand-purple-dark">Sign in to continue</h1>
          <p className="mt-1 text-sm text-neutral-500">Auction &amp; Giving admin — staff only.</p>

          <form action={loginAction} className="mt-5 space-y-3">
            <input type="hidden" name="next" value={next ?? "/admin"} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                required
                autoFocus
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Incorrect username or password.
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-brand-purple px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple-dark"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
