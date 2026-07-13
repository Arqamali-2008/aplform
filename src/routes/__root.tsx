import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUp } from "lucide-react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import aplLogo from "@/assets/apl-logo.png.asset.json";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const title = "APL / ALPL Team Registration";
const description =
  "Register your team for Al-Manar Premier League (APL) and ALPL cricket tournaments. Upload team logo, captain and player details in minutes.";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@500;600;700&display=swap",
      },
      { rel: "icon", href: aplLogo.url, type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
        <SiteFooter />
      </div>
      <ScrollToTopButton />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className={`fixed bottom-5 right-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-glow transition-all duration-300 animate-pulse-glow hover:scale-110 hover:rotate-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-8 sm:right-8 sm:h-12 sm:w-12 ${
        visible
          ? "pointer-events-auto opacity-100 translate-y-0"
          : "pointer-events-none opacity-0 translate-y-4"
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-gradient-navy text-primary-foreground">
      {/* subtle animated accent line */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 text-center sm:gap-3 sm:px-6 sm:py-8">
        <p className="text-[13px] font-medium leading-relaxed sm:text-sm">
          Designed &amp; Developed by{" "}
          <span className="font-display text-lg font-bold uppercase tracking-widest text-shimmer sm:text-xl">
            AMi
          </span>
        </p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary-foreground/60 sm:text-xs">
          Batch of 2024
        </p>
        <div className="mt-1 h-px w-16 bg-primary-foreground/15" />
        <p className="text-[11px] text-primary-foreground/60 sm:text-xs">
          © {year} APL / ALPL. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
