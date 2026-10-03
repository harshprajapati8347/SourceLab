type NavigationStartListener = () => void;

const listeners = new Set<NavigationStartListener>();

/**
 * Starts the top progress bar when a client navigation targets a new pathname.
 *
 * A destination href is ignored when it is external, a hash, or the same
 * pathname (chat stripping `?ask=` stays on the notebook). Omit the href for
 * back/forward: the address bar has already moved, and the caller checked it.
 */
export function startNavigationProgress(href?: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (href !== undefined && !isDifferentPathname(href)) {
    return;
  }

  for (const listener of listeners) {
    listener();
  }
}

/** Subscribes to navigation starts. Returns an unsubscribe function. */
export function subscribeNavigationStart(listener: NavigationStartListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isDifferentPathname(href: string) {
  try {
    const url = new URL(href, window.location.href);
    return (
      url.origin === window.location.origin &&
      url.pathname !== window.location.pathname
    );
  } catch {
    return false;
  }
}
