import { describe, expect, it } from "vitest";
import type { ParsedWorksheet } from "../types";
import { validateImportRows } from "../validateRows";

function ws(cells: Record<string, string>): ParsedWorksheet {
  return {
    name: "Sheet1",
    headers: Object.keys(cells),
    totalDataRows: 1,
    rows: [
      {
        sourceRowNumber: 2,
        cells: Object.fromEntries(
          Object.entries(cells).map(([k, v]) => [k, { raw: v, display: v }])
        ),
      },
    ],
  };
}

describe("validateMember updateProvidedFields", () => {
  it("hanya field terisi yang masuk updateProvidedFields", () => {
    const worksheet = ws({
      "No Anggota": "ANG-UPD",
      Nama: "Budi",
      NIK: "",
      Alamat: "Jl. Ada",
      Telepon: "",
      Email: "",
      "Tanggal Bergabung": "",
      Status: "",
    });
    const mapping = {
      "No Anggota": "memberNo",
      Nama: "name",
      NIK: "nik",
      Alamat: "address",
      Telepon: "phone",
      Email: "email",
      "Tanggal Bergabung": "joinedAt",
      Status: "status",
    };

    const summary = validateImportRows("MEMBERS", worksheet, mapping);
    const row = summary.rows[0].data as {
      updateProvidedFields?: string[];
      status: string;
    } | null;

    expect(row?.updateProvidedFields).toEqual(["address"]);
    expect(row?.status).toBe("AKTIF");
  });

  it("status tidak provided jika sel status kosong", () => {
    const worksheet = ws({
      "No Anggota": "ANG-UPD2",
      Nama: "Siti",
      Status: "",
    });
    const mapping = {
      "No Anggota": "memberNo",
      Nama: "name",
      Status: "status",
    };

    const summary = validateImportRows("MEMBERS", worksheet, mapping);
    const row = summary.rows[0].data as { updateProvidedFields?: string[] } | null;

    expect(row?.updateProvidedFields ?? []).not.toContain("status");
  });

  it("kolom tidak dipetakan tidak masuk updateProvidedFields", () => {
    const worksheet = ws({
      "No Anggota": "ANG-UPD3",
      Nama: "Ani",
      NIK: "3171012345670001",
    });
    const mapping = {
      "No Anggota": "memberNo",
      Nama: "name",
    };

    const summary = validateImportRows("MEMBERS", worksheet, mapping);
    const row = summary.rows[0].data as { updateProvidedFields?: string[] } | null;

    expect(row?.updateProvidedFields).toEqual([]);
  });
});