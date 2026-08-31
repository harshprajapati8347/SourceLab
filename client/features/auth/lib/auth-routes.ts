export const authRoutes = {
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  home: "/",
} as const;

export const protectedRoutes = [
  authRoutes.dashboard,
  "/workspace",
  "/settings",
] as const;

export const unauthenticatedRoutes = [
  authRoutes.login,
  authRoutes.signup,
  authRoutes.forgotPassword,
] as const;

export function isProtectedRoute(pathname: string) {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isUnauthenticatedRoute(pathname: string) {
  return unauthenticatedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
