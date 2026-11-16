import * as XLSX from "xlsx";
import { MEMBER_FIELDS, PRODUCT_FIELDS } from "./fields";
import type { ImportDataType } from "./types";

const MEMBER_SAMPLE = [
  {
    memberNo: "ANG-0001",
    name: "Budi Santoso",
    nik: "3171012345670001",
    address: "Jl. Contoh No. 1",
    phone: "081234567890",
    email: "budi@email.com",
    joinedAt: "15/11/2026",
    status: "AKTIF",
  },
];

const PRODUCT_SAMPLE = [
  {
    sku: "BRG-0001",
    name: "Beras Premium 5kg",
    categoryName: "Sembako",
    unitName: "Pack",
    costPrice: "62000",
    sellPrice: "70000",
    openingStock: "50",
    minStock: "10",
    isActive: "AKTIF",
  },
];

export function buildImportTemplateBuffer(type: ImportDataType): Buffer {
  const fields = type === "MEMBERS" ? MEMBER_FIELDS : PRODUCT_FIELDS;
  const headers = fields.map((f) => f.label);
  const sample = type === "MEMBERS" ? MEMBER_SAMPLE : PRODUCT_SAMPLE;

  const rows = sample.map((row) =>
    fields.map((field) => {
      const val = (row as Record<string, string>)[field.key];
      return val ?? "";
    })
  );

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  const sheetName = type === "MEMBERS" ? "Template_Anggota" : "Template_Barang";
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);

  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  );
}

export function templateFilename(type: ImportDataType): string {
  return type === "MEMBERS"
    ? "template-impor-anggota.xlsx"
    : "template-impor-barang.xlsx";
}