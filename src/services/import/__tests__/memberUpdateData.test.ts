import { describe, expect, it } from "vitest";
import type { NormalizedMemberRow } from "@/lib/import/types";
import { buildMemberUpdateData } from "../memberImporter";

const baseRow: NormalizedMemberRow = {
  memberNo: "ANG-001",
  name: "Nama Baru",
  nik: "3171012345670001",
  address: "Alamat Baru",
  phone: "081234567890",
  email: "baru@example.test",
  joinedAt: new Date("2026-01-15"),
  status: "NONAKTIF",
};

function rowWith(
  overrides: Partial<NormalizedMemberRow>
): NormalizedMemberRow {
  return { ...baseRow, ...overrides };
}

describe("buildMemberUpdateData", () => {
  it("UPDATE hanya nama jika tidak ada field opsional terisi", () => {
    expect(
      buildMemberUpdateData(rowWith({ updateProvidedFields: [] }))
    ).toEqual({ name: "Nama Baru" });
  });

  it("NIK kosong (tidak di updateProvidedFields) tidak ikut payload", () => {
    expect(
      buildMemberUpdateData(
        rowWith({ nik: null, updateProvidedFields: ["address"] })
      ).nik
    ).toBeUndefined();
  });

  it("alamat kosong tidak ikut jika tidak provided", () => {
    expect(
      buildMemberUpdateData(
        rowWith({ address: null, updateProvidedFields: ["nik"] })
      )
    ).toEqual({ name: "Nama Baru", nik: "3171012345670001" });
  });

  it("telepon kosong tidak ikut jika tidak provided", () => {
    expect(
      buildMemberUpdateData(
        rowWith({ phone: null, updateProvidedFields: ["email"] })
      ).phone
    ).toBeUndefined();
  });

  it("email kosong tidak ikut jika tidak provided", () => {
    expect(
      buildMemberUpdateData(
        rowWith({ email: null, updateProvidedFields: ["phone"] })
      ).email
    ).toBeUndefined();
  });

  it("status kosong tidak ikut jika tidak provided (status di row tetap default validasi)", () => {
    expect(
      buildMemberUpdateData(
        rowWith({ status: "AKTIF", updateProvidedFields: [] })
      ).status
    ).toBeUndefined();
  });

  it("status tidak dipetakan tidak ikut payload", () => {
    expect(buildMemberUpdateData(rowWith({ updateProvidedFields: [] })).status).toBeUndefined();
  });

  it("status NONAKTIF tidak ikut jika sel status kosong", () => {
    expect(
      buildMemberUpdateData(
        rowWith({ status: "AKTIF", updateProvidedFields: ["nik", "name"] })
      )
    ).toEqual({
      name: "Nama Baru",
      nik: "3171012345670001",
    });
  });

  it("field terisi dan provided memperbarui nilai", () => {
    expect(
      buildMemberUpdateData(
        rowWith({
          updateProvidedFields: [
            "nik",
            "address",
            "phone",
            "email",
            "joinedAt",
            "status",
          ],
        })
      )
    ).toEqual({
      name: "Nama Baru",
      nik: "3171012345670001",
      address: "Alamat Baru",
      phone: "081234567890",
      email: "baru@example.test",
      joinedAt: new Date("2026-01-15"),
      status: "NONAKTIF",
    });
  });
});