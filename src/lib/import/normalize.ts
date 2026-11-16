const WHITESPACE_RE = /^\s+|\s+$/g;

export function trimToEmpty(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  return String(value).replace(WHITESPACE_RE, "");
}

export function emptyToNull(value: string): string | null {
  const t = trimToEmpty(value);
  return t === "" ? null : t;
}

export function normalizeCode(value: unknown): string {
  return trimToEmpty(value).toUpperCase();
}

export function normalizeMemberNo(value: unknown): string {
  return normalizeCode(value);
}

export function normalizeSku(value: unknown): string {
  return normalizeCode(value);
}

export function normalizeMemberStatus(
  value: unknown
): "AKTIF" | "NONAKTIF" | null {
  const raw = trimToEmpty(value);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["AKTIF", "ACTIVE", "YA", "YES", "1", "TRUE"].includes(upper)) {
    return "AKTIF";
  }
  if (["NONAKTIF", "INACTIVE", "TIDAK", "NO", "0", "FALSE"].includes(upper)) {
    return "NONAKTIF";
  }
  return null;
}

export function normalizeActiveFlag(value: unknown): boolean | null {
  const raw = trimToEmpty(value);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["AKTIF", "ACTIVE", "YA", "YES", "1", "TRUE"].includes(upper)) {
    return true;
  }
  if (["NONAKTIF", "INACTIVE", "TIDAK", "NO", "0", "FALSE"].includes(upper)) {
    return false;
  }
  return null;
}

export interface ParseRupiahResult {
  ok: boolean;
  value: number | null;
  message?: string;
}

export function parseRupiahStrict(value: unknown): ParseRupiahResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, value: null, message: "Nilai rupiah tidak valid." };
    }
    if (!Number.isInteger(value) && value % 1 !== 0) {
      return {
        ok: false,
        value: null,
        message: "Rupiah harus bilangan bulat tanpa desimal.",
      };
    }
    return { ok: true, value: Math.round(value) };
  }

  let s = trimToEmpty(value);
  s = s.replace(/^Rp\.?\s*/i, "").replace(/\s/g, "");

  if (!s) {
    return { ok: true, value: null };
  }

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);

  if (lastSep >= 0) {
    const frac = s.slice(lastSep + 1);
    if (frac.length > 0 && frac.length !== 3) {
      if (/^0+$/.test(frac)) {
        s = s.slice(0, lastSep);
      } else {
        return {
          ok: false,
          value: null,
          message:
            "Format angka tidak jelas. Gunakan pemisah ribuan (titik/koma) tiga digit, tanpa desimal.",
        };
      }
    } else if (frac.length === 3) {
      const digitsOnly = s.replace(/[.,]/g, "");
      if (!/^\d+$/.test(digitsOnly)) {
        return { ok: false, value: null, message: "Nilai rupiah tidak valid." };
      }
      return { ok: true, value: parseInt(digitsOnly, 10) };
    }
  }

  const digitsOnly = s.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digitsOnly)) {
    return { ok: false, value: null, message: "Nilai rupiah tidak valid." };
  }

  const parsed = parseInt(digitsOnly, 10);
  if (Number.isNaN(parsed)) {
    return { ok: false, value: null, message: "Nilai rupiah tidak valid." };
  }

  return { ok: true, value: parsed };
}

export interface ParseIntegerResult {
  ok: boolean;
  value: number | null;
  message?: string;
}

export function parseIntegerStrict(value: unknown): ParseIntegerResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return { ok: false, value: null, message: "Jumlah harus bilangan bulat." };
    }
    return { ok: true, value: value };
  }

  const s = trimToEmpty(value).replace(/\./g, "").replace(/,/g, "");
  if (!/^\d+$/.test(s)) {
    return { ok: false, value: null, message: "Jumlah harus bilangan bulat." };
  }
  return { ok: true, value: parseInt(s, 10) };
}

export interface ParseDateResult {
  ok: boolean;
  value: Date | null;
  message?: string;
}

function parseIsoDateParts(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, -7, 0, 0, 0));
  return dt;
}

function parseIdDateParts(text: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, -7, 0, 0, 0));
}

export function parseDateStrict(value: unknown): ParseDateResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { ok: false, value: null, message: "Tanggal tidak valid." };
    }
    return { ok: true, value: value };
  }

  const text = trimToEmpty(value);
  if (!text) {
    return { ok: true, value: null };
  }

  const iso = parseIsoDateParts(text);
  if (iso) return { ok: true, value: iso };

  const id = parseIdDateParts(text);
  if (id) return { ok: true, value: id };

  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(text)) {
    return {
      ok: false,
      value: null,
      message: "Tahun dua digit tidak didukung. Gunakan format dd/mm/yyyy.",
    };
  }

  return {
    ok: false,
    value: null,
    message: "Format tanggal tidak dikenali. Gunakan dd/mm/yyyy atau yyyy-mm-dd.",
  };
}

export interface ParsePhoneResult {
  ok: boolean;
  value: string | null;
  message?: string;
  warning?: string;
}

export function parsePhoneAsString(value: unknown): ParsePhoneResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, value: null, message: "Nomor telepon tidak valid." };
    }
    const asSci = value.toExponential();
    if (asSci.includes("e+") || asSci.includes("E+")) {
      return {
        ok: false,
        value: null,
        message:
          "Nomor telepon tampak sebagai angka ilmiah di Excel. Format sel sebagai teks sebelum impor.",
      };
    }
    return {
      ok: true,
      value: String(Math.trunc(value)),
      warning:
        "Nomor telepon dibaca sebagai angka dari Excel; awalan nol mungkin hilang.",
    };
  }

  const s = trimToEmpty(value);
  if (!s) return { ok: true, value: null };

  if (/^\+?\d[\d\s-]{5,}$/.test(s) || /^\d+$/.test(s)) {
    return { ok: true, value: s };
  }

  return { ok: false, value: null, message: "Nomor telepon tidak valid." };
}

export function cellToRawString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}