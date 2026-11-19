/**
 * globalSetup E2E P4.
 *
 * 1. Guard keselamatan database (sama dengan integration test): berhenti bila target tidak terbukti aman.
 * 2. Seed data uji (prefix P4E2E-<run>) langsung ke koperasi_test_db dengan password acak per-run.
 * 3. BUKTI TARGET SERVER: login akun seed lewat server aplikasi (NextAuth). Bila server menunjuk
 *    database lain, akun tidak ditemukan -> login gagal -> seluruh run dibatalkan sebelum spec apa pun.
 * 4. Mengembalikan teardown yang menghapus hanya baris milik run ini (berdasarkan id).
 *
 * File ini TIDAK dijalankan oleh `playwright test --list` dan hanya aktif bila RUN_P4_E2E=1.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { request, type FullConfig } from "@playwright/test";
import {
  describeTarget,
  getTestPrisma,
  isE2EEnabled,
  resolveTestDatabaseUrl,
  verifyConnectedDatabase,
} from "../../../src/tests/p4/support/safeDb";
import { FixtureTracker } from "../../../src/tests/p4/support/fixtures";
import { writeState, removeState, type E2EState } from "./state";

const PAGING_COUNT = 13; // + kopi, teh, habis = 16 produk bernama prefix -> 2 halaman katalog

export default async function globalSetup(config: FullConfig) {
  if (!isE2EEnabled()) {
    throw new Error("[P4 E2E] RUN_P4_E2E=1 wajib diset untuk menjalankan E2E.");
  }
  const url = resolveTestDatabaseUrl();
  const baseURL = config.projects[0].use.baseURL as string;
  console.log(`[P4 E2E] Target database: ${describeTarget(url)}`);

  const prisma = getTestPrisma();
  await verifyConnectedDatabase(prisma);

  const tracker = new FixtureTracker(prisma, "P4E2E");
  const password = `Pw-${randomBytes(12).toString("base64url")}`; // tidak dicetak
  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    // createCategoryAndUnit() mencatat baris yang dibuat sehingga ikut dibersihkan oleh teardown.
    const first = await tracker.createCategoryAndUnit();
    const second = await tracker.createCategoryAndUnit();
    const catA = first.category;
    const catB = second.category;
    const unit = first.unit;

    const kopi = await tracker.createProduct({
      stock: 50, sellPrice: 12000, costPrice: 7000, name: `${tracker.prefix} Kopi`, categoryId: catA.id, unitId: unit.id,
    });
    const teh = await tracker.createProduct({
      stock: 3, sellPrice: 8000, costPrice: 4000, name: `${tracker.prefix} Teh`, categoryId: catB.id, unitId: unit.id,
    });
    const habis = await tracker.createProduct({
      stock: 0, sellPrice: 5000, costPrice: 2500, name: `${tracker.prefix} Habis`, categoryId: catA.id, unitId: unit.id,
    });
    for (let i = 1; i <= PAGING_COUNT; i++) {
      await tracker.createProduct({
        stock: 5, name: `${tracker.prefix} Paging ${String(i).padStart(2, "0")}`, categoryId: catA.id, unitId: unit.id,
      });
    }

    const memberA = await tracker.createMember();
    const memberB = await tracker.createMember();
    const kasir = await tracker.createUser({ role: "KASIR", passwordHash });
    const admin = await tracker.createUser({ role: "ADMIN", passwordHash });
    const userA = await tracker.createUser({ role: "ANGGOTA", memberId: memberA.id, passwordHash });
    const userB = await tracker.createUser({ role: "ANGGOTA", memberId: memberB.id, passwordHash });

    const state: E2EState = {
      baseURL,
      runId: tracker.runId,
      prefix: tracker.prefix,
      password,
      accounts: {
        kasir: { id: kasir.id, username: kasir.username },
        admin: { id: admin.id, username: admin.username },
        memberA: { id: userA.id, username: userA.username, memberId: memberA.id, memberNo: memberA.memberNo, name: memberA.name },
        memberB: { id: userB.id, username: userB.username, memberId: memberB.id, memberNo: memberB.memberNo, name: memberB.name },
      },
      products: {
        kopi: { id: kopi.id, name: kopi.name, sku: kopi.sku, price: kopi.sellPrice },
        teh: { id: teh.id, name: teh.name, sku: teh.sku, price: teh.sellPrice },
        habis: { id: habis.id, name: habis.name, sku: habis.sku },
      },
      categories: { a: { id: catA.id, name: catA.name }, b: { id: catB.id, name: catB.name } },
      pagingCount: PAGING_COUNT,
    };
    writeState(state);

    // --- BUKTI: server aplikasi benar-benar memakai koperasi_test_db ---
    await proveServerTargetsTestDatabase(baseURL, kasir.username, password);
    console.log(`[P4 E2E] Seed selesai (run ${tracker.runId}); server terbukti memakai database uji.`);
  } catch (e) {
    await safeCleanup(tracker);
    removeState();
    throw e;
  }

  return async () => {
    await safeCleanup(tracker);
    removeState();
    await prisma.$disconnect();
    console.log(`[P4 E2E] Teardown selesai (run ${tracker.runId}).`);
  };
}

async function safeCleanup(tracker: FixtureTracker) {
  try {
    await tracker.cleanup();
  } catch (e) {
    console.error(
      `[P4 E2E] Pembersihan gagal. Sisa data memakai prefix "${tracker.prefix}" dan dapat dibersihkan berdasarkan prefix itu.`,
      e instanceof Error ? e.message : e
    );
  }
}

/** Login kredensial NextAuth lewat HTTP (tanpa browser). Gagal => server tidak melihat user seed => salah target. */
async function proveServerTargetsTestDatabase(baseURL: string, username: string, password: string) {
  const ctx = await request.newContext({ baseURL });
  try {
    const csrf = (await (await ctx.get("/api/auth/csrf")).json()) as { csrfToken: string };
    await ctx.post("/api/auth/callback/credentials", {
      form: { csrfToken: csrf.csrfToken, identifier: username, password, json: "true" },
    });
    const session = (await (await ctx.get("/api/auth/session")).json()) as { user?: { role?: string } };
    if (session?.user?.role !== "KASIR") {
      throw new Error(
        "[P4 E2E SAFETY] Server aplikasi TIDAK mengenali akun seed di koperasi_test_db. " +
          "Kemungkinan server menunjuk database lain. Run dibatalkan sebelum spec apa pun berjalan."
      );
    }
  } finally {
    await ctx.dispose();
  }
}
