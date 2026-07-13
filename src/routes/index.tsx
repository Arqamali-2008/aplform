import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, ShieldCheck, Users, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import aplLogo from "@/assets/apl-logo.png.asset.json";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={aplLogo.url} alt="APL logo" className="h-10 w-10 rounded-full bg-white p-0.5" />
            <div className="leading-tight">
              <div className="font-display text-lg font-bold">Al-Manar Premier League</div>
              <div className="text-xs opacity-80">Team Registration Portal</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link to="/admin" className="hidden text-sm hover:underline sm:inline">Admin</Link>
            <Button asChild variant="secondary" size="sm">
              <Link to="/register">Register</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero-live text-primary-foreground">
        {/* dark vignette */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0.08_0.04_260/0.6)_100%)]" aria-hidden />
        {/* moving spotlight */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-1/2 h-[200%] w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-spotlight" />
        </div>
        {/* soft blobs */}
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent blur-3xl animate-float-y" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-primary blur-3xl animate-float-y [animation-delay:-3s]" />
        </div>
        {/* embers */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            { l: "10%", d: "0s",   s: "6px" },
            { l: "25%", d: "1.2s", s: "4px" },
            { l: "45%", d: "2.4s", s: "8px" },
            { l: "65%", d: "0.6s", s: "5px" },
            { l: "82%", d: "3s",   s: "6px" },
            { l: "92%", d: "1.8s", s: "4px" },
          ].map((e, i) => (
            <span
              key={i}
              className="absolute bottom-0 rounded-full bg-accent shadow-glow animate-ember"
              style={{ left: e.l, animationDelay: e.d, width: e.s, height: e.s }}
            />
          ))}
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-2 md:items-center">
          <div className="animate-thrill-in">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <Trophy className="h-3.5 w-3.5 text-accent animate-pulse" /> Season Registrations Open
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Register your team for{" "}
              <span className="text-shimmer">APL</span> &{" "}
              <span className="text-shimmer">ALPL</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-primary-foreground/85 sm:text-lg">
              Fast, mobile-friendly team sign-up. Upload logos and player photos, list your squad,
              and submit in one flow. Admins export ready-to-import JSON for APL HotSpot.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow transition-transform hover:scale-105">
                <Link to="/register">
                  Start Registration <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/admin">Admin Panel</Link>
              </Button>
            </div>
          </div>
          <div className="flex justify-center md:justify-end animate-thrill-in [animation-delay:200ms]">
            <div className="relative">
              <span className="absolute inset-0 rounded-full border border-accent/40 animate-ring-pulse" aria-hidden />
              <span className="absolute inset-0 rounded-full border border-accent/40 animate-ring-pulse [animation-delay:1s]" aria-hidden />
              <div className="absolute inset-0 rounded-full bg-accent/40 blur-2xl animate-pulse" aria-hidden />
              <img
                src={aplLogo.url}
                alt="Al-Manar Premier League crest"
                className="relative h-56 w-56 rounded-full bg-white p-2 shadow-glow sm:h-72 sm:w-72 animate-float-y"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Three simple steps</h2>
          <p className="mt-2 text-muted-foreground">Complete registration in under 10 minutes.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Team Info", body: "Pick your tournament, batch, and upload your team logo." },
            { icon: Users, title: "Captain & Players", body: "Add captain details and 5–20 players with photos, roles, and styles." },
            { icon: Upload, title: "Preview & Submit", body: "Review everything, then submit. Get an instant Registration ID." },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-red text-white">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold">{`0${i + 1}. ${s.title}`}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button asChild size="lg">
            <Link to="/register">Register Your Team Now</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div>© {new Date().getFullYear()} Al-Manar Premier League</div>
          <div className="flex gap-4">
            <Link to="/register" className="hover:text-foreground">Register</Link>
            <Link to="/admin" className="hover:text-foreground">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
