/**
 * Otorisasi handler API impor P3 (tanpa HTTP nyata atau tulis database).
 * requireRole di-mock; layanan impor di-mock agar tidak menjalankan impor.
 */
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

vi.mock("@/services/import/importService", () => ({
  listImportHistory: vi.fn(async () => []),
  getImportLogById: vi.fn(async () => null),
  executeImport: vi.fn(),
}));

vi.mock("@/services/import/mappingTemplateService", () => ({
  listImportTemplates: vi.fn(async () => []),
  saveImportTemplate: vi.fn(),
  deleteImportTemplate: vi.fn(),
}));

vi.mock("@/services/import/stockGateway", () => ({
  isProductImportExecutionAllowed: vi.fn(async () => ({
    allowed: false,
    reason: "stub",
  })),
}));

vi.mock("@/lib/import/parseSpreadsheet", () => ({
  parseImportFile: vi.fn(),
}));

vi.mock("@/lib/import/templates", () => ({
  buildImportTemplateBuffer: vi.fn(() => Buffer.from("xlsx")),
  templateFilename: vi.fn(() => "template.xlsx"),
}));

const adminUser = {
  id: "admin-user-id",
  role: Role.ADMIN,
  username: "admin",
  email: "admin@koperasi.local",
};

const rejectNoSession = () =>
  requireRole.mockRejectedValue(new Error("UNAUTHORIZED: Anda harus login terlebih dahulu."));
const rejectForbidden = () =>
  requireRole.mockRejectedValue(new Error("FORBIDDEN: Anda tidak memiliki izin untuk tindakan ini."));
const allowAdmin = () => requireRole.mockResolvedValue(adminUser);

describe("API impor P3 — otorisasi", () => {
  beforeEach(() => {
    requireRole.mockReset();
    vi.clearAllMocks();
  });

  it.each([
    ["parse POST", async () => (await import("../parse/route")).POST],
    ["preview POST", async () => (await import("../preview/route")).POST],
    ["execute POST", async () => (await import("../execute/route")).POST],
    ["history GET", async () => (await import("../history/route")).GET],
    ["templates GET", async () => (await import("../templates/route")).GET],
    ["templates POST", async () => (await import("../templates/route")).POST],
    ["templates DELETE", async () => (await import("../templates/route")).DELETE],
    ["templates/[type] GET", async () => (await import("../templates/[type]/route")).GET],
    [
      "history/[id]/errors GET",
      async () => (await import("../history/[id]/errors/route")).GET,
    ],
  ])("%s menolak tanpa sesi (403)", async (_label, loadHandler) => {
    rejectNoSession();
    const handler = await loadHandler();
    const req = new NextRequest("http://localhost/api/admin/import/test", {
      method: _label.includes("GET") ? "GET" : "POST",
    });
    let res: Response;
    if (_label === "history GET") {
      res = await (handler as unknown as () => Promise<Response>)();
    } else if (_label === "templates/[type] GET") {
      res = await (
        handler as unknown as (
          r: NextRequest,
          c: { params: { type: string } }
        ) => Promise<Response>
      )(req, { params: { type: "MEMBERS" } });
    } else if (_label === "history/[id]/errors GET") {
      res = await (
        handler as unknown as (
          r: NextRequest,
          c: { params: { id: string } }
        ) => Promise<Response>
      )(req, { params: { id: "log-1" } });
    } else {
      res = await (handler as unknown as (r: NextRequest) => Promise<Response>)(req);
    }
    expect(res.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN);
  });

  it.each([
    ["parse POST", async () => (await import("../parse/route")).POST],
    ["history GET", async () => (await import("../history/route")).GET],
  ])("%s menolak role non-ADMIN seperti KASIR (403)", async (_label, loadHandler) => {
    rejectForbidden();
    const handler = await loadHandler();
    if (_label === "history GET") {
      const res = await (handler as unknown as () => Promise<Response>)();
      expect(res.status).toBe(403);
    } else {
      const res = await (handler as unknown as (r: NextRequest) => Promise<Response>)(
        new NextRequest("http://localhost/api/admin/import/parse", { method: "POST" })
      );
      expect(res.status).toBe(403);
    }
    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN);
  });

  it("history GET mengizinkan ADMIN dan tidak memanggil execute", async () => {
    allowAdmin();
    const { GET } = await import("../history/route");
    const { listImportHistory, executeImport } = await import(
      "@/services/import/importService"
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(listImportHistory).toHaveBeenCalled();
    expect(executeImport).not.toHaveBeenCalled();
  });

  it("execute POST ADMIN tanpa file valid mengembalikan 400, bukan menjalankan impor", async () => {
    allowAdmin();
    const { POST } = await import("../execute/route");
    const { executeImport } = await import("@/services/import/importService");
    const fd = new FormData();
    fd.append("importType", "MEMBERS");
    fd.append("mapping", JSON.stringify({}));
    const res = await POST(
      new NextRequest("http://localhost/api/admin/import/execute", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(400);
    expect(executeImport).not.toHaveBeenCalled();
  });
});