export function AdminOnlyNotice() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
      <p className="font-semibold text-amber-900">Admins only</p>
      <p className="mt-1 text-sm text-amber-800">
        This page is restricted to the admin login — volunteers don&apos;t have access.
      </p>
    </div>
  );
}
