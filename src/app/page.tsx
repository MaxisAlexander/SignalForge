import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LandingOnboarding } from "@/components/LandingOnboarding";
import { WorkflowCarousel } from "@/components/WorkflowCarousel";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070b12]">
      <Image
        src="/planet-hero.jpg"
        alt=""
        fill
        priority
        className="object-cover object-[70%_center] sm:object-[75%_center]"
        sizes="100vw"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070b12] from-0% via-[#070b12]/95 via-45% to-[#070b12]/15 to-100%"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b12] via-transparent to-[#070b12]/40"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <LandingOnboarding />
        <Header variant="landing" />

        <main className="flex flex-1 flex-col justify-center px-6 pb-12 pt-6 sm:px-10 lg:max-w-2xl lg:px-16 xl:max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-cyan-400">
            SoSoValue Buildathon
          </p>
          <h2 className="max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
            Research{" "}
            <span className="bg-gradient-to-r from-amber-400 to-cyan-400 bg-clip-text text-transparent">
              → execution
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)]">
            Live SoSoValue data → verified spot &amp; futures signals → match on
            SoDEX testnet.
          </p>

          <WorkflowCarousel />

          <div className="mt-8">
            <Link
              href="/app"
              className="inline-flex rounded-lg border border-white/15 px-5 py-2.5 text-sm text-[var(--muted)] hover:border-amber-500/40 hover:text-white"
            >
              Skip to app →
            </Link>
          </div>
        </main>

        <footer className="relative z-10 border-t border-white/10 px-6 py-6 text-left text-xs text-[var(--muted)] sm:px-10 lg:px-16">
          Built for AKINDO WaveHack · SoSoValue Buildathon · Data via{" "}
          <a
            href="https://openapi.sosovalue.com/openapi/v1"
            className="text-cyan-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            openapi.sosovalue.com
          </a>
        </footer>
      </div>
    </div>
  );
}