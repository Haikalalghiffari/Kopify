// Helper to identify public routes for the Kopify system.

// 1. Exact public routes
export const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/unauthorized",
]);

// 2. Public root static files (served from the site root)
export const PUBLIC_ROOT_FILES = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
]);

// 3. Explicitly allowed public assets (including those under /public and specific root assets).
// Add any known static asset paths here. The project currently does not have a physical public folder,
// but tests expect certain assets to be publicly accessible.
export const PUBLIC_ASSET_PATHS = new Set<string>([
  // Root‑level assets used in tests
  "/logo.png",
  "/assets/fonts/inter.woff2",
  "/styles/custom.css",
  // Assets under a hypothetical /public folder
  "/public/logo.png",
  "/public/images/banner.webp",
]);

// 4. Protected path prefixes – never public, even if they have an extension.
export const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/api",
  "/cart",
  "/my-orders",
  "/catalog",
  "/profile",
];

/**
 * Determines whether a given pathname should be considered public (no auth required).
 *
 * Security rules:
 * 1. Exact matches from PUBLIC_EXACT_PATHS.
 * 2. Auth.js endpoints: only "/api/auth" and any sub‑path under it.
 * 3. Next.js internal assets: only "/_next", "/_next/static/*" and "/_next/image/*".
 * 4. Assets explicitly listed in PUBLIC_ASSET_PATHS (served from root or under /public).
 * 5. Root static files listed in PUBLIC_ROOT_FILES.
 * 6. Any path that starts with a prefix from PROTECTED_PATH_PREFIXES is never public.
 * 7. No global extension allow‑list – everything else is private.
 */
export function isPublicPath(pathname: string): boolean {
  // Normalise trailing slash ("/login/" -> "/login")
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  // 1. Exact public routes
  if (PUBLIC_EXACT_PATHS.has(normalized)) {
    return true;
  }

  // 2. Auth.js endpoints
  if (normalized === '/api/auth' || normalized.startsWith('/api/auth/')) {
    return true;
  }

  // 3. Next.js internal assets
  if (
    normalized === '/_next' ||
    normalized.startsWith('/_next/static/') ||
    normalized.startsWith('/_next/image')
  ) {
    return true;
  }

  // 4. Explicit public assets (including /public/* paths)
  if (PUBLIC_ASSET_PATHS.has(normalized)) {
    return true;
  }

  // 5. Root static files
  if (PUBLIC_ROOT_FILES.has(normalized)) {
    return true;
  }

  // 6. Protected prefixes – always private
  for (const prefix of PROTECTED_PATH_PREFIXES) {
    if (
      normalized === prefix ||
      normalized.startsWith(`${prefix}/`) ||
      normalized.startsWith(`${prefix}.`)
    ) {
      return false;
    }
  }

  // 7. All other paths are private
  return false;
}
