import ExcelJS from "exceljs";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { parseRupiah } from "@/lib/money";
import { parseISO, isValid } from "date-fns";

export interface ParsedFileResult {
  headers: string[];
  sampleRows: Record<string, any>[];
  allRows: Record<string, any>[];
  totalRows: number;
}

export interface ColumnSuggestion {
  excelColumn: string;
  systemField: string | null;
  confidence: number;
}

export interface ValidationErrorItem {
  row: number;
  field: string;
  message: string;
  rawValue?: any;
}

export interface ValidationSummary {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ValidationErrorItem[];
  previewRows: { row: number; data: Record<string, any>; isValid: boolean; errors: string[] }[];
}

export type DuplicateMode = "SKIP" | "UPDATE" | "ERROR";

/**
 * Standard System Schema Definitions for Import
 */
export const IMPORT_SCHEMA_DEFINITIONS = {
  ANGGOTA: [
    { field: "memberNo", label: "Nomor Anggota", required: true, aliases: ["no anggota", "nomor anggota", "kode anggota", "id anggota", "no_anggota", "member_no"] },
    { field: "name", label: "Nama Lengkap", required: true, aliases: ["nama", "nama anggota", "nama lengkap", "member_name", "full_name"] },
    { field: "nik", label: "NIK / KTP", required: false, aliases: ["nik", "no ktp", "nomor ktp", "ktp"] },
    { field: "phone", label: "No. Handphone", required: false, aliases: ["telepon", "no hp", "nomor hp", "phone", "hp", "no. telepon", "telp"] },
    { field: "email", label: "Email", required: false, aliases: ["email", "alamat email", "surel"] },
    { field: "address", label: "Alamat", required: false, aliases: ["alamat", "domisili", "tempat tinggal", "address"] },
    { field: "joinedAt", label: "Tanggal Bergabung", required: false, aliases: ["tanggal daftar", "tgl bergabung", "joined_at", "tanggal gabung", "tgl daftar"] },
  ],
  BARANG: [
    { field: "sku", label: "SKU / Kode Barang", required: true, aliases: ["sku", "kode barang", "kode", "barcode", "id barang", "item_code"] },
    { field: "name", label: "Nama Barang", required: true, aliases: ["nama barang", "nama produk", "nama", "item_name", "product_name"] },
    { field: "category", label: "Kategori", required: true, aliases: ["kategori", "kategori barang", "category", "jenis"] },
    { field: "unit", label: "Satuan", required: true, aliases: ["satuan", "unit", "uom", "kemasan"] },
    { field: "costPrice", label: "Harga Beli (Rp)", required: true, aliases: ["harga beli", "harga modal", "hpp", "cost", "cost_price"] },
    { field: "sellPrice", label: "Harga Jual (Rp)", required: true, aliases: ["harga jual", "harga", "price", "sell_price"] },
    { field: "stock", label: "Stok Awal", required: false, aliases: ["stok", "stok awal", "stok fisik", "qty", "stock", "jumlah"] },
    { field: "minStock", label: "Batas Min. Stok", required: false, aliases: ["min stok", "stok minimum", "min_stock", "safety stock"] },
  ],
};

/**
 * Parse an uploaded file buffer (.xlsx, .xls, or .csv)
 */
export async function parseUploadedFile(
  buffer: Buffer,
  filename: string
): Promise<ParsedFileResult> {
  const isCsv = filename.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const text = buffer.toString("utf-8");
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const headers = parsed.meta.fields || [];
    const allRows = parsed.data;

    return {
      headers,
      sampleRows: allRows.slice(0, 20),
      allRows,
      totalRows: allRows.length,
    };
  } else {
    // Excel file (.xlsx / .xls)
    const workbook = new ExcelJS.Workbook();
    // @ts-ignore
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("File Excel kosong atau tidak memiliki worksheet");
    }

    const headers: string[] = [];
    const allRows: Record<string, any>[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.value ? cell.value.toString().trim() : `Kolom_${colNumber}`;
        });
      } else {
        const rowData: Record<string, any> = {};
        let hasValue = false;
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            let val = cell.value;
            // Handle formula result or object
            if (val && typeof val === "object") {
              if ("result" in val) val = val.result;
              else if ("text" in val) val = val.text;
            }
            rowData[header] = val !== null && val !== undefined ? val.toString().trim() : "";
            if (rowData[header]) hasValue = true;
          }
        });
        if (hasValue) {
          allRows.push(rowData);
        }
      }
    });

    return {
      headers,
      sampleRows: allRows.slice(0, 20),
      allRows,
      totalRows: allRows.length,
    };
  }
}

/**
 * Auto-suggest column mappings based on string similarity & aliases
 */
export function autoSuggestMappings(
  fileHeaders: string[],
  type: "ANGGOTA" | "BARANG"
): Record<string, string> {
  const definitions = IMPORT_SCHEMA_DEFINITIONS[type];
  const mappings: Record<string, string> = {};

  for (const def of definitions) {
    let matchedHeader = "";
    let highestScore = 0;

    for (const h of fileHeaders) {
      const cleanH = h.toLowerCase().trim().replace(/[_\-\.]/g, " ");

      // Direct match or alias match
      for (const alias of def.aliases) {
        if (cleanH === alias) {
          highestScore = 1.0;
          matchedHeader = h;
          break;
        } else if (cleanH.includes(alias) || alias.includes(cleanH)) {
          const score = 0.8;
          if (score > highestScore) {
            highestScore = score;
            matchedHeader = h;
          }
        }
      }
      if (highestScore === 1.0) break;
    }

    if (matchedHeader) {
      mappings[matchedHeader] = def.field;
    }
  }

  return mappings;
}

/**
 * Validate parsed rows against mapped fields
 */
export function validateImportRows(
  rows: Record<string, any>[],
  mappings: Record<string, string>, // excelColumn -> systemField
  type: "ANGGOTA" | "BARANG"
): ValidationSummary {
  const definitions = IMPORT_SCHEMA_DEFINITIONS[type];
  const requiredFields = definitions.filter((d) => d.required).map((d) => d.field);

  const errors: ValidationErrorItem[] = [];
  const previewRows: any[] = [];

  // Inverted mapping: systemField -> excelColumn
  const fieldToColumn: Record<string, string> = {};
  for (const [col, field] of Object.entries(mappings)) {
    if (field) fieldToColumn[field] = col;
  }

  // Check if all required fields are mapped
  for (const req of requiredFields) {
    if (!fieldToColumn[req]) {
      errors.push({
        row: 0,
        field: req,
        message: `Kolom wajib '${req}' belum dipetakan ke kolom file Excel`,
      });
    }
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1
    const rowErrors: string[] = [];
    const normalizedData: Record<string, any> = {};

    // Map and normalize fields
    for (const def of definitions) {
      const colName = fieldToColumn[def.field];
      const rawValue = colName ? row[colName] : undefined;

      if (def.required && (!rawValue || rawValue.toString().trim() === "")) {
        const msg = `Kolom '${def.label}' wajib diisi`;
        rowErrors.push(msg);
        errors.push({ row: rowNum, field: def.field, message: msg, rawValue });
      }

      // Type-specific validations & normalizations
      if (rawValue) {
        const valStr = rawValue.toString().trim();

        if (def.field === "costPrice" || def.field === "sellPrice" || def.field === "stock" || def.field === "minStock") {
          const num = parseRupiah(valStr);
          if (isNaN(num) || num < 0) {
            const msg = `'${def.label}' harus berupa angka valid non-negatif`;
            rowErrors.push(msg);
            errors.push({ row: rowNum, field: def.field, message: msg, rawValue });
          } else {
            normalizedData[def.field] = num;
          }
        } else if (def.field === "sku" || def.field === "memberNo") {
          // Normalisasi kode: uppercase & trim
          normalizedData[def.field] = valStr.toUpperCase();
        } else {
          normalizedData[def.field] = valStr;
        }
      } else {
        normalizedData[def.field] = def.field.includes("Price") || def.field.includes("stock") ? 0 : null;
      }
    }

    if (index < 20) {
      previewRows.push({
        row: rowNum,
        data: normalizedData,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
      });
    }
  });

  const totalErrors = errors.length;
  // Unique rows with errors
  const errorRowSet = new Set(errors.filter((e) => e.row > 0).map((e) => e.row));
  const validCount = Math.max(0, rows.length - errorRowSet.size);

  return {
    totalRows: rows.length,
    validCount,
    errorCount: errorRowSet.size,
    errors,
    previewRows,
  };
}

/**
 * Execute batch import in database transactions (FR-3.1, FR-3.2, FR-3.6, AC 6.3)
 */
export async function executeBatchImport({
  rows,
  mappings,
  type,
  duplicateMode,
  userId,
  filename,
}: {
  rows: Record<string, any>[];
  mappings: Record<string, string>;
  type: "ANGGOTA" | "BARANG";
  duplicateMode: DuplicateMode;
  userId: string;
  filename: string;
}) {
  const fieldToColumn: Record<string, string> = {};
  for (const [col, field] of Object.entries(mappings)) {
    if (field) fieldToColumn[field] = col;
  }

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failureReports: { row: number; identifier: string; reason: string }[] = [];

  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);

    await db.$transaction(async (tx) => {
      for (let j = 0; j < chunk.length; j++) {
        const rawRow = chunk[j];
        const rowNum = i + j + 2;

        try {
          if (type === "ANGGOTA") {
            const memberNo = (rawRow[fieldToColumn["memberNo"]] || "").toString().trim().toUpperCase();
            const name = (rawRow[fieldToColumn["name"]] || "").toString().trim();
            const nik = (rawRow[fieldToColumn["nik"]] || "").toString().trim() || null;
            const phone = (rawRow[fieldToColumn["phone"]] || "").toString().trim() || null;
            const email = (rawRow[fieldToColumn["email"]] || "").toString().trim() || null;
            const address = (rawRow[fieldToColumn["address"]] || "").toString().trim() || null;

            if (!memberNo || !name) {
              failedCount++;
              failureReports.push({ row: rowNum, identifier: memberNo || `Baris_${rowNum}`, reason: "Nomor Anggota dan Nama wajib diisi" });
              continue;
            }

            const existing = await tx.member.findUnique({ where: { memberNo } });

            if (existing) {
              if (duplicateMode === "SKIP") {
                skippedCount++;
                continue;
              } else if (duplicateMode === "ERROR") {
                failedCount++;
                failureReports.push({ row: rowNum, identifier: memberNo, reason: "Nomor Anggota sudah terdaftar (Mode Tandai Error)" });
                continue;
              } else if (duplicateMode === "UPDATE") {
                await tx.member.update({
                  where: { id: existing.id },
                  data: { name, nik, phone, email, address, deletedAt: null, status: "AKTIF" },
                });
                successCount++;
                continue;
              }
            }

            await tx.member.create({
              data: { memberNo, name, nik, phone, email, address },
            });
            successCount++;
          } else if (type === "BARANG") {
            const sku = (rawRow[fieldToColumn["sku"]] || "").toString().trim().toUpperCase();
            const name = (rawRow[fieldToColumn["name"]] || "").toString().trim();
            const categoryName = (rawRow[fieldToColumn["category"]] || "Umum").toString().trim();
            const unitName = (rawRow[fieldToColumn["unit"]] || "pcs").toString().trim().toLowerCase();
            const costPrice = parseRupiah(rawRow[fieldToColumn["costPrice"]] || 0);
            const sellPrice = parseRupiah(rawRow[fieldToColumn["sellPrice"]] || 0);
            const stock = parseRupiah(rawRow[fieldToColumn["stock"]] || 0);
            const minStock = parseRupiah(rawRow[fieldToColumn["minStock"]] || 5);

            if (!sku || !name) {
              failedCount++;
              failureReports.push({ row: rowNum, identifier: sku || `Baris_${rowNum}`, reason: "SKU dan Nama Barang wajib diisi" });
              continue;
            }

            // Upsert category & unit
            const category = await tx.category.upsert({
              where: { name: categoryName },
              update: {},
              create: { name: categoryName },
            });

            const unit = await tx.unit.upsert({
              where: { name: unitName },
              update: {},
              create: { name: unitName },
            });

            const existing = await tx.product.findUnique({ where: { sku } });

            if (existing) {
              if (duplicateMode === "SKIP") {
                skippedCount++;
                continue;
              } else if (duplicateMode === "ERROR") {
                failedCount++;
                failureReports.push({ row: rowNum, identifier: sku, reason: "SKU sudah terdaftar (Mode Tandai Error)" });
                continue;
              } else if (duplicateMode === "UPDATE") {
                await tx.product.update({
                  where: { id: existing.id },
                  data: {
                    name,
                    categoryId: category.id,
                    unitId: unit.id,
                    costPrice,
                    sellPrice,
                    minStock,
                    isActive: true,
                    deletedAt: null,
                  },
                });
                successCount++;
                continue;
              }
            }

            // Create product
            const newProduct = await tx.product.create({
              data: {
                sku,
                name,
                categoryId: category.id,
                unitId: unit.id,
                costPrice,
                sellPrice,
                stock,
                minStock,
              },
            });

            // Record success before optional stock movement (so a failure in movement doesn't mark the row as failed)
            successCount++;
            // FR-3.6: Stok awal tercatat sebagai pergerakan stok IMPORT
            if (stock > 0) {
              try {
                await tx.stockMovement.create({
                  data: {
                    productId: newProduct.id,
                    type: "IMPORT",
                    qtyChange: stock,
                    stockBefore: 0,
                    stockAfter: stock,
                    note: `Stok awal impor file: ${filename}`,
                    createdById: userId,
                  },
                });
              } catch (e) {
                console.error('Failed to create initial stock movement:', e);
                // Continue without treating this as a row failure
              }
            }
          }
        } catch (err: any) {
          failedCount++;
          failureReports.push({ row: rowNum, identifier: `Baris_${rowNum}`, reason: err.message || "Gagal diproses" });
        }
      }
    });
  }

  // FR-3.3: Record import log
  const status = failedCount === 0 ? "SUKSES" : successCount > 0 ? "PARSIAL" : "GAGAL";
  const log = await db.importLog.create({
    data: {
      type,
      filename,
      totalRows: rows.length,
      successRows: successCount,
      failedRows: failedCount,
      status,
      mappingJson: mappings,
      createdById: userId,
    },
  });

  return {
    logId: log.id,
    total: rows.length,
    success: successCount,
    skipped: skippedCount,
    failed: failedCount,
    status,
    failureReports,
  };
}

/**
 * Generate standard downloadable Excel template (FR-3.4)
 */
export async function generateExcelTemplate(type: "ANGGOTA" | "BARANG"): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type === "ANGGOTA" ? "Data Anggota" : "Data Barang");

  if (type === "ANGGOTA") {
    sheet.columns = [
      { header: "No Anggota", key: "memberNo", width: 16 },
      { header: "Nama Lengkap", key: "name", width: 28 },
      { header: "NIK", key: "nik", width: 20 },
      { header: "No Handphone", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 24 },
      { header: "Alamat", key: "address", width: 35 },
    ];

    sheet.addRow({
      memberNo: "ANG-0010",
      name: "Ahmad Dahlan",
      nik: "3171012345670001",
      phone: "081234567890",
      email: "ahmad@example.com",
      address: "Jl. Melati No. 12, Jakarta",
    });
    sheet.addRow({
      memberNo: "ANG-0011",
      name: "Dewi Sartika",
      nik: "3171012345670002",
      phone: "089876543210",
      email: "dewi@example.com",
      address: "Jl. Mawar No. 4, Bandung",
    });
  } else {
    sheet.columns = [
      { header: "Kode Barang", key: "sku", width: 16 },
      { header: "Nama Barang", key: "name", width: 30 },
      { header: "Kategori", key: "category", width: 20 },
      { header: "Satuan", key: "unit", width: 12 },
      { header: "Harga Beli", key: "costPrice", width: 16 },
      { header: "Harga Jual", key: "sellPrice", width: 16 },
      { header: "Stok Awal", key: "stock", width: 12 },
      { header: "Min Stok", key: "minStock", width: 12 },
    ];

    sheet.addRow({
      sku: "SMB-010",
      name: "Tepung Terigu Segitiga 1kg",
      category: "Sembako",
      unit: "kg",
      costPrice: 11000,
      sellPrice: 13500,
      stock: 40,
      minStock: 10,
    });
    sheet.addRow({
      sku: "MNM-010",
      name: "Teh Botol Sosro 450ml",
      category: "Makanan & Minuman",
      unit: "botol",
      costPrice: 4500,
      sellPrice: 6000,
      stock: 50,
      minStock: 15,
    });
  }

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B3B2C" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
