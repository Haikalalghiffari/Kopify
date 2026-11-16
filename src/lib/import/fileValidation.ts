import {
  MAX_IMPORT_FILE_BYTES,
  SUPPORTED_IMPORT_EXTENSIONS,
} from "./constants";
import type { FileValidationResult, ImportFileFormat } from "./types";

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot).toLowerCase();
}

function detectFormatFromMagic(buffer: Buffer): ImportFileFormat | null {
  if (buffer.length === 0) return null;

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return "xlsx";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return "xls";
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let nonText = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) {
      nonText++;
      continue;
    }
    if (b < 9 || (b > 13 && b < 32)) {
      nonText++;
    }
  }
  if (nonText / Math.max(sample.length, 1) < 0.03) {
    return "csv";
  }

  return null;
}

function extensionToFormat(ext: string): ImportFileFormat | null {
  if (ext === ".xlsx") return "xlsx";
  if (ext === ".xls") return "xls";
  if (ext === ".csv") return "csv";
  return null;
}

export function validateImportFile(
  buffer: Buffer,
  filename: string
): FileValidationResult {
  if (!filename || !filename.trim()) {
    return { ok: false, message: "Nama file tidak valid." };
  }

  const ext = extensionOf(filename);
  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext as (typeof SUPPORTED_IMPORT_EXTENSIONS)[number])) {
    return {
      ok: false,
      message: "Ekstensi file tidak didukung. Gunakan .xlsx, .xls, atau .csv.",
    };
  }

  if (buffer.length === 0) {
    return { ok: false, message: "File kosong." };
  }

  if (buffer.length > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      message: `Ukuran file melebihi batas ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB.`,
    };
  }

  const expectedFromExt = extensionToFormat(ext);
  const detected = detectFormatFromMagic(buffer);

  if (!detected) {
    return {
      ok: false,
      message:
        "Format isi file tidak dikenali atau rusak. Periksa kembali file Excel/CSV Anda.",
    };
  }

  if (expectedFromExt === "csv" && detected !== "csv") {
    return {
      ok: false,
      message:
        "Ekstensi .csv tidak cocok dengan isi file. Unggah file CSV yang valid atau ubah ekstensi.",
    };
  }

  if (expectedFromExt === "xlsx" && detected !== "xlsx") {
    return {
      ok: false,
      message:
        "Ekstensi .xlsx tidak cocok dengan isi file. File mungkin rusak atau bukan workbook Excel.",
    };
  }

  if (expectedFromExt === "xls" && detected !== "xls") {
    return {
      ok: false,
      message:
        "Ekstensi .xls tidak cocok dengan isi file. File mungkin rusak atau bukan workbook Excel lama.",
    };
  }

  return {
    ok: true,
    format: expectedFromExt ?? detected,
    sizeBytes: buffer.length,
  };
}