"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authRoutes } from "@/features/auth/lib/auth-routes";
import { BrandMark } from "@/shared/components/brand-mark";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#study", label: "Study tools" },
  { href: "#who", label: "Who it’s for" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
] as const;

const linkClassName =
  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 overflow-x-clip border-b border-transparent transition-[background-color,border-color,box-shadow] duration-200",
        scrolled && "border-border bg-background/70 shadow-md backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 min-[900px]:grid min-[900px]:grid-cols-[1fr_auto_1fr]">
        <a
          href="#top"
          className="flex items-center gap-2 justify-self-start font-heading text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <BrandMark />
        </a>

        <nav
          aria-label="Page sections"
          className="hidden items-center justify-self-center min-[900px]:flex"
        >
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={linkClassName}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1.5 justify-self-end sm:gap-2">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-[900px]:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <MenuIcon />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="dark w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Page sections" className="grid gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={<a href={link.href} className={linkClassName} />}
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <SheetClose
                  render={
                    <Link href={authRoutes.login} className={linkClassName} />
                  }
                >
                  Sign in
                </SheetClose>
                <Button
                  nativeButton={false}
                  className="mt-2 rounded-full"
                  render={<Link href={authRoutes.signup} />}
                >
                  Create a notebook
                </Button>
              </nav>
            </SheetContent>
          </Sheet>

          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="hidden rounded-full sm:inline-flex"
            render={<Link href={authRoutes.login} />}
          >
            Sign in
          </Button>
          <Button
            nativeButton={false}
            size="sm"
            className="hidden rounded-full sm:inline-flex"
            render={<Link href={authRoutes.signup} />}
          >
            Create a notebook
          </Button>
        </div>
      </div>
    </header>
  );
}
