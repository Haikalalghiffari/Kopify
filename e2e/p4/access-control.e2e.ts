/**
 * E2E P4 — Journey 9: kontrol akses di level middleware + halaman + API (lapisan yang TIDAK
 * dapat diuji oleh test route handler): tanpa login, role salah, dan akses lintas anggota.
 *
 * Sebagian menulis ke koperasi_test_db (membuat pesanan fixture). Dinonaktifkan kecuali RUN_P4_E2E=1.
 */
import { expect, test } from "@playwright/test";
import { isE2EEnabled } from "../../src/tests/p4/support/safeDb";
import { apiCreateOrder, loadState, login, testDb } from "./support/helpers";

test.skip(!isE2EEnabled(), "E2E P4 dinonaktifkan: set RUN_P4_E2E=1 setelah ada izin eksplisit.");

test.describe("J9 — tanpa login", () => {
  for (const path of ["/catalog", "/cart", "/my-orders", "/admin/orders", "/admin/orders/new", "/admin/sales"]) {
    test(`halaman ${path} mengalihkan ke /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("button", { name: "Masuk ke Akun" })).toBeVisible();
    });
  }

  test("API P4 tidak pernah melayani anonim (tanpa data, tanpa efek)", async ({ request }) => {
    const s = loadState();
    const db = testDb();
    const ordersBefore = await db.order.count({ where: { memberId: s.accounts.memberA.memberId } });
    const salesBefore = await db.sale.count({ where: { createdBy: s.accounts.kasir.id } });

    const responses = [
      await request.get("/api/orders/pending-count", { maxRedirects: 0 }),
      await request.get("/api/orders/x/proof", { maxRedirects: 0 }),
      await request.get("/api/sales/x/pdf", { maxRedirects: 0 }),
      await request.post("/api/orders", { data: { items: [{ productId: s.products.kopi.id, qty: 1 }] }, maxRedirects: 0 }),
      await request.post("/api/sales", { data: { items: [{ productId: s.products.kopi.id, qty: 1 }] }, maxRedirects: 0 }),
      await request.patch("/api/orders/x", { data: { action: "confirm" }, maxRedirects: 0 }),
    ];
    for (const r of responses) {
      expect([200, 201], `status ${r.status()} untuk ${r.url()}`).not.toContain(r.status());
      expect(r.headers()["content-type"] ?? "").not.toContain("application/pdf");
    }
    expect(await db.order.count({ where: { memberId: s.accounts.memberA.memberId } })).toBe(ordersBefore);
    expect(await db.sale.count({ where: { createdBy: s.accounts.kasir.id } })).toBe(salesBefore);
  });
});

test.describe("J9 — role anggota", () => {
  test("anggota dialihkan dari halaman staf dan ditolak API staf", async ({ page }) => {
    const s = loadState();
    await login(page, "memberA");

    for (const path of ["/admin/orders", "/admin/orders/new", "/admin/sales"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/unauthorized/);
    }

    const { orderNo } = await apiCreateOrder(page, [{ productId: s.products.kopi.id, qty: 1 }]);
    const id = (await testDb().order.findUniqueOrThrow({ where: { orderNo } })).id;

    expect((await page.request.get("/api/orders/pending-count")).status()).toBe(403);
    expect((await page.request.post("/api/sales", { data: { items: [{ productId: s.products.kopi.id, qty: 1 }] } })).status()).toBe(403);
    expect((await page.request.patch(`/api/orders/${id}`, { data: { action: "confirm" } })).status()).toBe(403);
    expect((await testDb().order.findUniqueOrThrow({ where: { id } })).status).toBe("DIAJUKAN");
  });

  test("anggota B tidak dapat melihat, mengunduh, atau membatalkan pesanan anggota A", async ({ browser }) => {
    const s = loadState();
    const a = await browser.newContext();
    const aPage = await a.newPage();
    await login(aPage, "memberA");
    const { orderNo } = await apiCreateOrder(aPage, [{ productId: s.products.kopi.id, qty: 1 }]);
    const id = (await testDb().order.findUniqueOrThrow({ where: { orderNo } })).id;

    const b = await browser.newContext();
    const bPage = await b.newPage();
    await login(bPage, "memberB");
    expect((await bPage.goto(`/my-orders/${id}`))?.status()).toBe(404);
    expect((await bPage.request.get(`/api/orders/${id}/proof`)).status()).toBe(404);
    expect((await bPage.request.post(`/api/orders/${id}/cancel`)).status()).toBe(404);
    await bPage.goto("/my-orders");
    await expect(bPage.getByRole("link", { name: orderNo })).toHaveCount(0);
    expect((await testDb().order.findUniqueOrThrow({ where: { id } })).status).toBe("DIAJUKAN");

    // A bebas membatalkan miliknya sendiri
    expect((await aPage.request.post(`/api/orders/${id}/cancel`)).status()).toBe(200);

    await a.close();
    await b.close();
  });
});

test.describe("J9 — role staf", () => {
  for (const who of ["kasir", "admin"] as const) {
    test(`${who} tidak dapat membuka halaman khusus anggota`, async ({ page }) => {
      await login(page, who);
      for (const path of ["/cart", "/my-orders"]) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/unauthorized/);
      }
    });
  }

  test("halaman /unauthorized memberi jalan keluar", async ({ page }) => {
    await login(page, "memberA");
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByRole("link").first()).toBeVisible();
  });
});
