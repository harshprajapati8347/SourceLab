"use client";

import { useCookieConsent } from "./cookie-consent";

const linkClassName =
  "rounded-md text-left outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30";

export function CookiePreferencesButton({
  className,
}: {
  className?: string;
}) {
  const { openPreferences } = useCookieConsent();

  return (
    <button
      type="button"
      className={className ?? linkClassName}
      onClick={openPreferences}
    >
      Cookie preferences
    </button>
  );
}
