import { expect, type APIResponse, type Locator, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma } from "../../../src/tests/p4/support/safeDb";
import { readState, type E2EState } from "./state";

export type Who = "kasir" | "admin" | "memberA" | "memberB";

export const loadState = (): E2EState => readState();

/** Klien Prisma ke database uji (tervalidasi guard) untuk verifikasi efek di DB. */
export const testDb = (): PrismaClient => getTestPrisma();

/** Login lewat UI sungguhan (form /login), lalu tunggu keluar dari halaman login. */
export async function login(page: Page, who: Who): Promise<void> {
  const s = readState();
  const account = s.accounts[who];
  await page.goto("/login");
  await page.locator("#identifier").fill(account.username);
  await page.locator("#password").fill(s.password);
  await page.getByRole("button", { name: "Masuk ke Akun" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Menyetujui window.confirm dan menjawab window.prompt (alasan penolakan). */
export function autoAcceptDialogs(page: Page, promptAnswer = "Stok rusak"): void {
  page.on("dialog", (d) => {
    void (d.type() === "prompt" ? d.accept(promptAnswer) : d.accept());
  });
}

/** Menolak (dismiss) semua dialog, untuk memeriksa bahwa batal tidak mengubah apa pun. */
export function autoDismissDialogs(page: Page): void {
  page.on("dialog", (d) => {
    void d.dismiss();
  });
}

/** Tidak boleh ada scroll horizontal (toleransi 1px untuk pembulatan). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "halaman tidak boleh melebar melebihi viewport").toBeLessThanOrEqual(1);
}

/** Isi sesi (cookie) browser dipakai ulang oleh page.request, sehingga API dipanggil sebagai user yang sama. */
export async function apiCreateOrder(
  page: Page,
  items: { productId: string; qty: number }[],
  note?: string
): Promise<{ orderNo: string; total: number }> {
  const res = await page.request.post("/api/orders", { data: { items, note } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { orderNo: string; total: number };
}

export async function expectPdf(res: APIResponse): Promise<void> {
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
}

/**
 * Form di UI ini memakai <label> yang bersebelahan dengan kontrolnya (tanpa htmlFor), jadi getByLabel
 * tidak bisa dipakai. Helper ini mengambil kontrol tepat setelah label bertuliskan `text`.
 */
export function selectNextToLabel(scope: Page | Locator, text: string): Locator {
  return scope.locator(`xpath=.//label[normalize-space()="${text}"]/following-sibling::select[1]`);
}
export function inputNextToLabel(scope: Page | Locator, text: string): Locator {
  return scope.locator(`xpath=.//label[normalize-space()="${text}"]/following-sibling::input[1]`);
}

/** Kartu pesanan di /admin/orders berdasarkan nomor pesanan. */
export function adminOrderCard(page: Page, orderNo: string): Locator {
  return page.locator("div.rounded-2xl", { has: page.getByText(orderNo, { exact: true }) }).first();
}

/** Kartu pesanan di /my-orders berdasarkan nomor pesanan. */
export function memberOrderCard(page: Page, orderNo: string): Locator {
  return page.locator("div.rounded-2xl", { has: page.getByRole("link", { name: orderNo }) }).first();
}

export async function searchAdminOrders(page: Page, orderNo: string): Promise<void> {
  await page.goto(`/admin/orders?q=${encodeURIComponent(orderNo)}`);
  await expect(adminOrderCard(page, orderNo)).toBeVisible();
}
