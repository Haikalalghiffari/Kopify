import fs from "node:fs";
import path from "node:path";

/** Data seed per-run yang dibagikan dari globalSetup ke spec (lewat berkas, karena beda proses). */
export type Account = { id: string; username: string };
export type E2EState = {
  baseURL: string;
  runId: string;
  prefix: string;
  /** Password acak per-run, berlaku untuk semua akun seed. Tidak pernah dicetak. */
  password: string;
  accounts: {
    kasir: Account;
    admin: Account;
    memberA: Account & { memberId: string; memberNo: string; name: string };
    memberB: Account & { memberId: string; memberNo: string; name: string };
  };
  products: {
    /** stok 50, harga 12.000, kategori A */
    kopi: { id: string; name: string; sku: string; price: number };
    /** stok 3, harga 8.000, kategori B (untuk skenario stok terbatas) */
    teh: { id: string; name: string; sku: string; price: number };
    /** stok 0 -> "Stok habis" */
    habis: { id: string; name: string; sku: string };
  };
  categories: { a: { id: string; name: string }; b: { id: string; name: string } };
  /** Banyak produk "paging" (dengan prefix run) untuk menguji paginasi katalog (12/halaman). */
  pagingCount: number;
};

export const CACHE_DIR = path.join(__dirname, "..", "..", "..", "node_modules", ".cache", "p4-e2e");
export const STATE_FILE = path.join(CACHE_DIR, "state.json");

export function writeState(state: E2EState): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
}

export function readState(): E2EState {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      "State E2E tidak ditemukan. globalSetup belum berjalan (RUN_P4_E2E=1 wajib diset)."
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as E2EState;
}

export function removeState(): void {
  fs.rmSync(STATE_FILE, { force: true });
}
