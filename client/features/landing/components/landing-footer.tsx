import Link from "next/link";
import { BrandMark } from "@/shared/components/brand-mark";
import { authRoutes } from "@/features/auth/lib/auth-routes";

const linkClassName =
  "rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30";

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-16 md:py-20">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
        <a
          href="#top"
          className="w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          aria-label="SourceLab, back to top"
        >
          <BrandMark />
        </a>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Chat with a notebook and open the passage behind the answer.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <a href="#pricing" className={linkClassName}>
            Pricing
          </a>
          <Link href={authRoutes.login} className={linkClassName}>
            Sign in
          </Link>
          <Link href={authRoutes.signup} className={linkClassName}>
            Sign up
          </Link>
        </nav>
      </div>
    </footer>
  );
}
