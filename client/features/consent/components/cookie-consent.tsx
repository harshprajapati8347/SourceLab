"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  applyConsentChoice,
  parseConsentRaw,
  readConsentRaw,
  sanitizeGtmId,
  subscribeConsent,
  writeConsentChoice,
} from "../lib/consent";

type CookieConsentContextValue = {
  openPreferences: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null,
);

function subscribeMounted() {
  return () => {};
}

export function useCookieConsent() {
  const value = useContext(CookieConsentContext);
  if (!value) {
    throw new Error("Cookie consent is not mounted");
  }
  return value;
}

export function CookieConsent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const gtmId = sanitizeGtmId(process.env.NEXT_PUBLIC_GTM_ID);
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
  const raw = useSyncExternalStore(
    subscribeConsent,
    readConsentRaw,
    () => null,
  );
  const choice = mounted ? parseConsentRaw(raw) : null;
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(false);

  function openPreferences() {
    setAnalyticsDraft(choice?.analytics ?? false);
    setPreferencesOpen(true);
  }

  function save(analytics: boolean) {
    writeConsentChoice(analytics);
    setAnalyticsDraft(analytics);
    applyConsentChoice(analytics, gtmId);
    setPreferencesOpen(false);
  }

  function closePreferences(open: boolean) {
    setPreferencesOpen(open);
  }

  return (
    <CookieConsentContext.Provider value={{ openPreferences }}>
      {children}
      {mounted && choice === null && !preferencesOpen ? (
        <CookieBanner
          onLanding={onLanding}
          onAccept={() => save(true)}
          onReject={() => save(false)}
          onCustomize={openPreferences}
        />
      ) : null}
      <CookiePreferencesDialog
        open={preferencesOpen}
        onOpenChange={closePreferences}
        onLanding={onLanding}
        analytics={analyticsDraft}
        onAnalyticsChange={setAnalyticsDraft}
        onSave={() => save(analyticsDraft)}
      />
    </CookieConsentContext.Provider>
  );
}

function CookieBanner({
  onLanding,
  onAccept,
  onReject,
  onCustomize,
}: {
  onLanding: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCustomize: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4",
        "sm:bottom-5 sm:px-6 sm:pb-0",
        onLanding && "dark",
      )}
    >
      <div
        role="region"
        aria-labelledby="cookie-banner-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
      >
        {/* Amber accent stripe */}
        <div className="h-0.5 w-full bg-primary/50" aria-hidden="true" />

        <div className="p-5">
          <div className="flex items-start gap-3">
            {/* Cookie icon */}
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01" />
              </svg>
            </span>

            <div className="min-w-0 space-y-1.5">
              <h2
                id="cookie-banner-title"
                className="font-heading text-sm font-semibold tracking-tight"
              >
                Cookies on SourceLab
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Necessary cookies keep you signed in and remember interface
                choices. Analytics stays off unless you allow it.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              variant="ghost"
              size="sm"
              onClick={onCustomize}
            >
              Customize
            </Button>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              size="sm"
              onClick={onReject}
            >
              Reject non-essential
            </Button>
            <Button className="w-full sm:w-auto" size="sm" onClick={onAccept}>
              Accept all
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CookiePreferencesDialog({
  open,
  onOpenChange,
  onLanding,
  analytics,
  onAnalyticsChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLanding: boolean;
  analytics: boolean;
  onAnalyticsChange: (enabled: boolean) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-lg", onLanding && "dark")}>
        <DialogHeader>
          <DialogTitle>Cookie preferences</DialogTitle>
          <DialogDescription>
            Your choice is stored in this browser until you change it. Necessary
            cookies stay on so sign-in and the interface keep working.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-3">
          <legend className="sr-only">Cookie categories</legend>
          <PreferenceRow
            id="consent-necessary"
            checked
            disabled
            title="Necessary"
            description="Sign-in session, sidebar state, theme, and notebook interface preferences."
          />
          <PreferenceRow
            id="consent-analytics"
            checked={analytics}
            onCheckedChange={(checked) => onAnalyticsChange(checked === true)}
            title="Analytics"
            description="Google Tag Manager measurement, only when a container is configured. Advertising storage stays off."
          />
        </fieldset>
        <DialogFooter>
          <Button onClick={onSave}>Save preferences</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreferenceRow({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3",
        disabled ? "bg-muted/40" : "cursor-pointer hover:border-primary/40",
      )}
    >
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <span className="grid gap-1">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
