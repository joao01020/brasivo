/**
 * BRASIVO route access policy.
 *
 * Keep public civic-data pages out of this list.
 * The paths below contain account-specific/private information.
 */
export const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/settings",
  "/mfa",
] as const;

export const AUTH_PAGE_PREFIXES = [
  "/login",
  "/register",
] as const;

function matchesPrefix(
  pathname: string,
  prefix: string,
) {
  return (
    pathname === prefix ||
    pathname.startsWith(`${prefix}/`)
  );
}

export function isProtectedPage(
  pathname: string,
) {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) =>
      matchesPrefix(pathname, prefix),
  );
}

export function isAuthPage(
  pathname: string,
) {
  return AUTH_PAGE_PREFIXES.some(
    (prefix) =>
      matchesPrefix(pathname, prefix),
  );
}

export function safeInternalNext(
  pathname: string,
  search: string,
) {
  const next =
    `${pathname}${search || ""}`;

  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/login") ||
    next.startsWith("/register")
  ) {
    return "/dashboard";
  }

  return next;
}
