/**
 * Turns a relative app path into an absolute URL for Better Auth callbacks.
 */
export function toAbsoluteCallbackUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}
