// Helper to identify public routes for the Kopify system.

// 1. Exact public routes
export const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/unauthorized",
]);

// 2. Public root static files – none exist in the repository
export const PUBLIC_ROOT_FILES = new Set<string>([]);

// 3. Explicitly allowed public assets – none exist in the repository
export const PUBLIC_ASSET_PATHS = new Set<string>([]);

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
 * Security rules (order matters):
 * 1️⃣ Exact matches from PUBLIC_EXACT_PATHS.
 * 2️⃣ Auth.js endpoints: only "/api/auth" and any sub‑path under it.
 * 3️⃣ Protected prefixes are evaluated **before** any asset allow‑list.
 * 4️⃣ Next.js internal assets: only "/_next/static/*" and the exact "/_next/image".
 * 5️⃣ Explicit public assets listed in PUBLIC_ASSET_PATHS.
 * 6️⃣ Root static files listed in PUBLIC_ROOT_FILES.
 * 7️⃣ Everything else is private.
 */
export function isPublicPath(pathname: string): boolean {
  // Normalise trailing slash ("/login/" -> "/login")
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  // 1️⃣ Exact public routes
  if (PUBLIC_EXACT_PATHS.has(normalized)) return true;

  // 2️⃣ Auth.js endpoints
  if (normalized === '/api/auth' || normalized.startsWith('/api/auth/')) return true;

  // 3️⃣ Protected prefixes – must be checked before any asset checks
  for (const prefix of PROTECTED_PATH_PREFIXES) {
    if (
      normalized === prefix ||
      normalized.startsWith(`${prefix}/`) ||
      normalized.startsWith(`${prefix}.`)
    ) {
      return false;
    }
  }

  // 4️⃣ Next.js internal assets
  if (
    normalized.startsWith('/_next/static/') ||
    normalized === '/_next/image'
  ) {
    return true;
  }

  // 5️⃣ Explicit public assets (none at the moment)
  if (PUBLIC_ASSET_PATHS.has(normalized)) return true;

  // 6️⃣ Root static files (none at the moment)
  if (PUBLIC_ROOT_FILES.has(normalized)) return true;

  // 7️⃣ All other paths are private
  return false;
}
