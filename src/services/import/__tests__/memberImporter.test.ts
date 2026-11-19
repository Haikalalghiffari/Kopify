import { beforeEach, describe, expect, it, vi } from "vitest";
import { suggestColumnMapping } from "@/lib/import/columnMapping";
import type { ParseImportFileResult } from "@/lib/import/types";
import { parseImportFile } from "@/lib/import/parseSpreadsheet";

const mockTx = {
  member: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

vi.mock("@/lib/import/parseSpreadsheet", () => ({
  parseImportFile: vi.fn(),
}));
import { db } from "@/lib/db";
import { importMembersFromFile } from "../memberImporter";

function memberParseFixture(
  memberNo: string,
  name: string
): ParseImportFileResult {
  const headers = ["No Anggota", "Nama", "NIK", "Alamat", "Telepon", "Email", "Tanggal Gabung", "Status"];
  const mapping = suggestColumnMapping(headers, "MEMBERS");
  return {
    format: "xlsx",
    filename: "test.xlsx",
    worksheets: [{ name: "Sheet1", rowCount: 1 }],
    selectedWorksheet: {
      name: "Sheet1",
      headers,
      totalDataRows: 1,
      rows: [
        {
          sourceRowNumber: 2,
          cells: {
            "No Anggota": { raw: memberNo, display: memberNo },
            Nama: { raw: name, display: name },
            NIK: { raw: "", display: "" },
            Alamat: { raw: "", display: "" },
            Telepon: { raw: "", display: "" },
            Email: { raw: "", display: "" },
            "Tanggal Gabung": { raw: "", display: "" },
            Status: { raw: "AKTIF", display: "AKTIF" },
          },
        },
      ],
    },
  };
}

const baseInput = {
  userId: "user-1",
  filename: "test.xlsx",
  buffer: Buffer.from("x"),
  worksheetName: "Sheet1",
  strict: false,
};

describe("importMembersFromFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.member.findMany.mockResolvedValue([]);
    mockTx.member.create.mockResolvedValue({ id: "m1" });
    mockTx.member.update.mockResolvedValue({ id: "m1" });
  });

  it("membuat anggota baru", async () => {
    vi.mocked(parseImportFile).mockReturnValue(
      memberParseFixture("ANG-100", "Siti")
    );
    const headers = ["No Anggota", "Nama", "NIK", "Alamat", "Telepon", "Email", "Tanggal Gabung", "Status"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");

    const result = await importMembersFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.successRows).toBe(1);
    expect(mockTx.member.create).toHaveBeenCalledTimes(1);
    const createPayload = mockTx.member.create.mock.calls[0][0].data;
    expect(createPayload).toMatchObject({
      memberNo: "ANG-100",
      name: "Siti",
      status: "AKTIF",
    });
    expect(createPayload.joinedAt).toBeInstanceOf(Date);
  });

  it("melewati duplikat pada mode SKIP", async () => {
    vi.mocked(parseImportFile).mockReturnValue(
      memberParseFixture("ANG-200", "Budi")
    );
    mockTx.member.findMany.mockResolvedValue([
      { id: "exist", memberNo: "ANG-200", deletedAt: null },
    ]);
    const headers = ["No Anggota", "Nama", "NIK", "Alamat", "Telepon", "Email", "Tanggal Gabung", "Status"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");

    const result = await importMembersFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.skippedRows).toBe(1);
    expect(mockTx.member.create).not.toHaveBeenCalled();
    expect(mockTx.member.update).not.toHaveBeenCalled();
  });

  it("memperbarui duplikat pada mode UPDATE", async () => {
    const headers = [
      "No Anggota",
      "Nama",
      "NIK",
      "Alamat",
      "Telepon",
      "Email",
      "Tanggal Gabung",
      "Status",
    ];
    vi.mocked(parseImportFile).mockReturnValue({
      format: "xlsx",
      filename: "test.xlsx",
      worksheets: [{ name: "Sheet1", rowCount: 1 }],
      selectedWorksheet: {
        name: "Sheet1",
        headers,
        totalDataRows: 1,
        rows: [
          {
            sourceRowNumber: 2,
            cells: {
              "No Anggota": { raw: "ANG-300", display: "ANG-300" },
              Nama: { raw: "Andi Baru", display: "Andi Baru" },
              NIK: { raw: "", display: "" },
              Alamat: { raw: "", display: "" },
              Telepon: { raw: "", display: "" },
              Email: { raw: "", display: "" },
              "Tanggal Gabung": { raw: "", display: "" },
              Status: { raw: "", display: "" },
            },
          },
        ],
      },
    });
    mockTx.member.findMany.mockResolvedValue([
      { id: "m-old", memberNo: "ANG-300", deletedAt: null },
    ]);
    const mapping = suggestColumnMapping(headers, "MEMBERS");

    const result = await importMembersFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "UPDATE",
    });

    expect(result.successRows).toBe(1);
    expect(mockTx.member.update).toHaveBeenCalledTimes(1);
    expect(mockTx.member.update).toHaveBeenCalledWith({
      where: { id: "m-old" },
      data: { name: "Andi Baru" },
    });
  });

  it("gagal duplikat pada mode ERROR", async () => {
    vi.mocked(parseImportFile).mockReturnValue(
      memberParseFixture("ANG-400", "Citra")
    );
    mockTx.member.findMany.mockResolvedValue([
      { id: "m2", memberNo: "ANG-400", deletedAt: null },
    ]);
    const headers = ["No Anggota", "Nama", "NIK", "Alamat", "Telepon", "Email", "Tanggal Gabung", "Status"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");

    const result = await importMembersFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "ERROR",
    });

    expect(result.failedRows).toBe(1);
    expect(mockTx.member.create).not.toHaveBeenCalled();
  });

  it("menolak anggota soft-deleted", async () => {
    vi.mocked(parseImportFile).mockReturnValue(
      memberParseFixture("ANG-500", "Dewi")
    );
    mockTx.member.findMany.mockResolvedValue([
      { id: "del", memberNo: "ANG-500", deletedAt: new Date() },
    ]);
    const headers = ["No Anggota", "Nama", "NIK", "Alamat", "Telepon", "Email", "Tanggal Gabung", "Status"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");

    const result = await importMembersFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "UPDATE",
    });

    expect(result.failedRows).toBe(1);
    expect(result.rowResults[0].errors[0].message).toContain("soft delete");
  });

  it("menggagalkan seluruh batch jika transaksi fatal", async () => {
    vi.mocked(parseImportFile).mockReturnValue(
      memberParseFixture("ANG-600", "Eko")
    );
    vi.mocked(db.$transaction).mockRejectedValueOnce(new Error("db down"));
    const headers = ["No Anggota", "Nama", "NIK", "Alamat", "Telepon", "Email", "Tanggal Gabung", "Status"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");

    const result = await importMembersFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.failedRows).toBe(1);
    expect(result.rowResults[0].errors[0].field).toBe("_batch");
  });
});