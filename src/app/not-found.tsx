import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070b12] px-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        The page you requested does not exist.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black"
      >
        Back to home
      </Link>
    </div>
  );
}