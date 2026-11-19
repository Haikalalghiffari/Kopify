// Integration tests for actual Next.js middleware (Live withAuth Runner)
import middleware from "@/middleware";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

describe("Actual Middleware Integration Tests (Anonymous User)", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "test_secret_key_minimum_32_characters_long_12345";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("allows anonymous access to /login without redirect", async () => {
    const req = new NextRequest("http://localhost:3000/login");
    const res = await (middleware as any)(req, {} as any);
    const location = (res as any)?.headers?.get("location");
    expect(location).toBeFalsy();
  });

  it("allows anonymous access to /unauthorized without redirect loop", async () => {
    const req = new NextRequest("http://localhost:3000/unauthorized");
    const res = await (middleware as any)(req, {} as any);
    const location = (res as any)?.headers?.get("location");
    expect(location).toBeFalsy();
  });

  it("redirects anonymous /admin/dashboard to /login", async () => {
    const req = new NextRequest("http://localhost:3000/admin/dashboard");
    const res = await (middleware as any)(req, {} as any);
    const location = (res as any)?.headers?.get("location");
    expect(location).toContain("/login");
  });

  it("redirects anonymous /api/orders/export.csv to /login", async () => {
    const req = new NextRequest("http://localhost:3000/api/orders/export.csv");
    const res = await (middleware as any)(req, {} as any);
    const location = (res as any)?.headers?.get("location");
    expect(location).toContain("/login");
  });
});
