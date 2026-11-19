// Tests for middleware matcher regex
import { config } from "@/middleware";
import { describe, expect, it } from "vitest";

describe("Middleware matcher regex behavior", () => {
  // The matcher array contains a single pattern string
  const pattern = config.matcher[0];
  // Ensure we test matching from the start of the string
  const regex = new RegExp('^' + pattern);

  const shouldExclude = [
    "/_next/static/chunks/main.js",
    "/_next/static/css/app.css",
    "/_next/image",
  ];
  const shouldInclude = [
    "/_next",
    "/_next/data/example/admin.json",
    "/_next/imageevil",
    "/_next/staticprivate",
    "/_nextprivate/test",
    "/admin/dashboard",
    "/api/orders",
    "/login",
  ];

  it("excludes official Next.js static assets and exact image endpoint", () => {
    for (const path of shouldExclude) {
      expect(regex.test(path)).toBe(false);
    }
  });

  it("includes other paths (private) for middleware processing", () => {
    for (const path of shouldInclude) {
      expect(regex.test(path)).toBe(true);
    }
  });
});
