"use client";

import Link from "next/link";
import { CookiePreferencesButton } from "@/features/consent/components/cookie-preferences-button";
import { authRoutes } from "@/features/auth/lib/auth-routes";
import { BrandMark } from "@/shared/components/brand-mark";
import { site } from "@/shared/lib/site";

const linkCls =
  "text-sm text-muted-foreground rounded-md outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30";

type PublicFooterProps = {
  /** Landing page scrolls to the pricing band. Other pages open /pricing. */
  pricingHref?: string;
};

export function PublicFooter({ pricingHref = site.pricing }: PublicFooterProps) {
  const pricingIsHash = pricingHref.startsWith("#");

  return (
    <footer className="border-t border-border">
      {/* Main footer grid */}
      <div className="mx-auto max-w-[1200px] px-6 py-14 md:py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-12">
          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-5 md:col-span-1">
            <a
              href={pricingIsHash ? "#top" : "/"}
              className="w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              aria-label={pricingIsHash ? "SourceLab, back to top" : "SourceLab home"}
            >
              <BrandMark />
            </a>
            <p className="max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
              An AI research workspace that reads your documents and answers from them — with citations.
            </p>
            {/* Social / repo links */}
            <div className="flex items-center gap-3">
              <a
                href={site.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SourceLab on GitHub"
                className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 rounded-md"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
                  <path d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12.02C23.5 5.73 18.27.5 12 .5Z" />
                </svg>
              </a>
              <a
                href={site.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Harsh's portfolio"
                className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 rounded-md"
              >
                {/* Globe icon */}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product column */}
          <nav aria-label="Product links" className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-foreground/40">Product</p>
            <div className="flex flex-col gap-2.5">
              {pricingIsHash ? (
                <a href={pricingHref} className={linkCls}>Pricing</a>
              ) : (
                <Link href={pricingHref} className={linkCls}>Pricing</Link>
              )}
              <Link href={authRoutes.signup} className={linkCls}>Get started</Link>
              <Link href={authRoutes.login} className={linkCls}>Sign in</Link>
            </div>
          </nav>

          {/* Legal column */}
          <nav aria-label="Legal links" className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-foreground/40">Legal</p>
            <div className="flex flex-col gap-2.5">
              <Link href={site.privacy} className={linkCls}>Privacy</Link>
              <Link href={site.terms} className={linkCls}>Terms</Link>
              <Link href={site.acceptableUse} className={linkCls}>Acceptable use</Link>
              <Link href={site.cookies} className={linkCls}>Cookies</Link>
            </div>
          </nav>

          {/* More column */}
          <nav aria-label="More links" className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-foreground/40">More</p>
            <div className="flex flex-col gap-2.5">
              <a
                href={site.github}
                target="_blank"
                rel="noopener noreferrer"
                className={linkCls}
              >
                GitHub
              </a>
              <CookiePreferencesButton
                className={`${linkCls} text-left`}
              />
              <a
                href={site.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className={linkCls}
              >
                iamharsh.in
              </a>
            </div>
          </nav>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-2 px-6 py-4 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SourceLab. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Created by{" "}
            <a
              href={site.portfolio}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline-offset-4 transition-colors hover:text-primary-ink hover:underline focus-visible:outline-none"
            >
              Harsh
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
