import { describe, it, expect } from "vitest";
import {
  assertSafeTestDatabaseUrl,
  dbMockModule,
  describeTarget,
  isDbIntegrationEnabled,
  resolveTestDatabaseUrl,
  UnsafeTestDatabaseError,
} from "./safeDb";

const OK = "postgresql://u:p@localhost:5433/koperasi_test_db?schema=public";

describe("P4 test database guard (pure, never connects)", () => {
  it("accepts only the exact koperasi_test_db on a local host", () => {
    expect(assertSafeTestDatabaseUrl(OK).pathname).toBe("/koperasi_test_db");
    expect(() => assertSafeTestDatabaseUrl(OK.replace("localhost", "127.0.0.1"))).not.toThrow();
  });

  it.each([
    ["the dev database koperasi_db", "postgresql://u:p@localhost:5433/koperasi_db?schema=public"],
    ["the postgres maintenance db", "postgresql://u:p@localhost:5433/postgres"],
    ["a similar-looking name", "postgresql://u:p@localhost:5433/koperasi_test_db_prod"],
    ["a different case", "postgresql://u:p@localhost:5433/Koperasi_Test_Db"],
    ["a remote host", "postgresql://u:p@db.example.com:5432/koperasi_test_db"],
    ["a non-postgres protocol", "mysql://u:p@localhost:3306/koperasi_test_db"],
    ["a dbname override in the query string", `${OK}&dbname=koperasi_db`],
    ["a host override in the query string", `${OK}&host=prod.example.com`],
    ["a port override in the query string", `${OK}&port=5432`],
    ["an options override in the query string", `${OK}&options=-c%20search_path%3Dx`],
  ])("rejects %s", (_label, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(UnsafeTestDatabaseError);
  });

  it("rejects missing, blank and malformed URLs", () => {
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(UnsafeTestDatabaseError);
    expect(() => assertSafeTestDatabaseUrl("   ")).toThrow(UnsafeTestDatabaseError);
    expect(() => assertSafeTestDatabaseUrl("not a url")).toThrow(UnsafeTestDatabaseError);
  });

  it("never falls back to DATABASE_URL", () => {
    expect(() =>
      resolveTestDatabaseUrl({ DATABASE_URL: OK /* TEST_DATABASE_URL intentionally absent */ })
    ).toThrow(/TEST_DATABASE_URL belum diisi/);
  });

  it("rejects TEST_DATABASE_URL equal to DATABASE_URL and production NODE_ENV", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: OK, DATABASE_URL: OK })).toThrow(
      UnsafeTestDatabaseError
    );
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: OK, NODE_ENV: "production" })).toThrow(
      UnsafeTestDatabaseError
    );
  });

  it("still accepts the URL after setup.ts deliberately overrides process.env.DATABASE_URL", () => {
    // Regression: setup.ts menyetel DATABASE_URL = URL uji sebagai lapis pertahanan kedua.
    // Pemeriksaan "test == dev" harus memakai DATABASE_URL asli, bukan hasil timpaan itu.
    const previous = process.env.DATABASE_URL;
    const previousTest = process.env.TEST_DATABASE_URL;
    try {
      process.env.TEST_DATABASE_URL = OK;
      process.env.DATABASE_URL = OK; // seperti setelah penimpaan oleh setup.ts
      expect(resolveTestDatabaseUrl()).toContain("koperasi_test_db");
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      if (previousTest === undefined) delete process.env.TEST_DATABASE_URL;
      else process.env.TEST_DATABASE_URL = previousTest;
    }
  });

  it("is opt-in only", () => {
    expect(isDbIntegrationEnabled({})).toBe(false);
    expect(isDbIntegrationEnabled({ RUN_P4_DB_INTEGRATION: "true" })).toBe(false);
    expect(isDbIntegrationEnabled({ RUN_P4_DB_INTEGRATION: "1" })).toBe(true);
  });

  it("never leaks credentials when describing the target", () => {
    const text = describeTarget("postgresql://secret_user:secret_pw@localhost:5433/koperasi_test_db");
    expect(text).toContain("koperasi_test_db");
    expect(text).not.toContain("secret_pw");
    expect(text).not.toContain("secret_user");
  });

  it("returns a trap (not a real client) for @/lib/db when integration is disabled", () => {
    // RUN_P4_DB_INTEGRATION is not set in the safe unit-test run.
    expect(isDbIntegrationEnabled()).toBe(false);
    const mod = dbMockModule();
    expect(() => mod.db.order).toThrow(UnsafeTestDatabaseError);
  });
});