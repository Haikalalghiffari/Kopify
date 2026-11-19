/**
 * E2E P4 — Journey 7: kasir (POS): penjualan umum + diskon, BON anggota, status bayar,
 * struk, dan perlindungan stok yang sedang direservasi pesanan aktif.
 *
 * MENULIS ke koperasi_test_db (hanya data prefix P4E2E-). Dinonaktifkan kecuali RUN_P4_E2E=1.
 */
import { expect, test } from "@playwright/test";
import { isE2EEnabled } from "../../src/tests/p4/support/safeDb";
import {
  apiCreateOrder,
  autoAcceptDialogs,
  expectPdf,
  inputNextToLabel,
  loadState,
  login,
  selectNextToLabel,
  testDb,
} from "./support/helpers";

test.skip(!isE2EEnabled(), "E2E P4 dinonaktifkan: set RUN_P4_E2E=1 setelah ada izin eksplisit.");
test.describe.configure({ mode: "serial" });

const productButton = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("button", { name: new RegExp(name) }).first();

test.describe("J7 — POS", () => {
  test("penjualan umum (Tunai, Lunas) dengan diskon: stok turun, struk lengkap", async ({ page }) => {
    const s = loadState();
    const db = testDb();
    autoAcceptDialogs(page);
    await login(page, "kasir");
    await page.goto("/admin/sales");

    // halaman POS memiliki sidebar navigasi
    await expect(page.getByRole("link", { name: /Pesanan Masuk/ })).toBeVisible();

    const before = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    await page.getByPlaceholder("Cari nama atau SKU barang...").fill(s.products.kopi.name);
    await productButton(page, s.products.kopi.name).click();
    await page.locator('input[type="number"]').first().fill("2"); // qty
    await inputNextToLabel(page, "Diskon (Rp)").fill("1000");

    // status bayar dapat dipilih untuk non-BON dan bawaannya Lunas
    await expect(selectNextToLabel(page, "Status bayar")).toBeEnabled();
    await expect(selectNextToLabel(page, "Status bayar")).toHaveValue("LUNAS");
    await expect(page.getByText("Rp 23.000").first()).toBeVisible(); // 2 x 12.000 - 1.000

    await page.getByRole("button", { name: "Bayar" }).click();
    const success = page.getByText(/Transaksi SLS-\d{8}-\d{4,} tersimpan \(TUNAI · Lunas\)/);
    await expect(success).toBeVisible();
    const saleNo = (await success.innerText()).match(/SLS-\d{8}-\d{4,}/)![0];

    // efek di DB
    const sale = await db.sale.findUniqueOrThrow({ where: { saleNo }, include: { saleItems: true } });
    expect(sale).toMatchObject({
      total: 23000, discount: 1000, paymentMethod: "TUNAI", paymentStatus: "LUNAS",
      memberId: null, createdBy: s.accounts.kasir.id, orderId: null,
    });
    expect(sale.saleItems[0]).toMatchObject({ qty: 2, unitPrice: s.products.kopi.price });
    const after = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    expect(after.stock).toBe(before.stock - 2);
    const movement = await db.stockMovement.findFirstOrThrow({ where: { refId: sale.id } });
    expect(movement).toMatchObject({ type: "SALE", qtyChange: -2, createdBy: s.accounts.kasir.id });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entity: "Sale", entityId: sale.id } });
    expect(audit).toMatchObject({ action: "CREATE_SALE", userId: s.accounts.kasir.id });

    // keranjang direset, struk dapat dibuka dan PDF valid
    await expect(page.getByText("Belum ada barang.")).toBeVisible();
    await page.getByRole("link", { name: /Lihat struk/ }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/sales/${sale.id}/receipt$`));
    await expect(page.getByText("Umum", { exact: true })).toBeVisible();
    await expect(page.getByText("Tunai · Lunas")).toBeVisible();
    await expect(page.getByText("- Rp 1.000")).toBeVisible();
    await expectPdf(await page.request.get(`/api/sales/${sale.id}/pdf`));
  });

  test("BON: wajib anggota, status terkunci Belum lunas, lalu tersimpan sebagai utang", async ({ page }) => {
    const s = loadState();
    const db = testDb();
    autoAcceptDialogs(page);
    await login(page, "kasir");
    await page.goto("/admin/sales");

    await page.getByPlaceholder("Cari nama atau SKU barang...").fill(s.products.kopi.name);
    await productButton(page, s.products.kopi.name).click();
    await selectNextToLabel(page, "Metode bayar").selectOption("BON");
    const status = selectNextToLabel(page, "Status bayar");
    await expect(status).toBeDisabled();
    await expect(status).toHaveValue("BELUM_LUNAS");

    // tanpa anggota: ditolak dengan pesan jelas, tidak ada penjualan
    const salesBefore = await db.sale.count({ where: { createdBy: s.accounts.kasir.id } });
    await page.getByRole("button", { name: "Bayar" }).click();
    await expect(page.getByText("Pilih anggota untuk pembayaran BON.")).toBeVisible();
    expect(await db.sale.count({ where: { createdBy: s.accounts.kasir.id } })).toBe(salesBefore);

    // dengan anggota: tersimpan
    await selectNextToLabel(page, "Anggota (kosongkan untuk umum)").selectOption(s.accounts.memberA.memberId);
    await page.getByRole("button", { name: "Bayar" }).click();
    await expect(page.getByText(/tersimpan \(BON · Belum lunas\)/)).toBeVisible();

    const sale = await db.sale.findFirstOrThrow({
      where: { createdBy: s.accounts.kasir.id, paymentMethod: "BON" },
      orderBy: { soldAt: "desc" },
    });
    expect(sale).toMatchObject({ paymentStatus: "BELUM_LUNAS", memberId: s.accounts.memberA.memberId });
  });

  test("stok yang direservasi pesanan terkonfirmasi tidak bisa dijual di POS; kembali tersedia setelah dilepas", async ({ browser, page }) => {
    const s = loadState();
    await login(page, "kasir");

    const a = await browser.newContext();
    const aPage = await a.newPage();
    await login(aPage, "memberA");

    // Stok teh bersama dengan spec lain (mis. J5 menyelesaikan pesanan berisi 1 teh), jadi jumlah tersedia
    // dibaca dari DB, bukan diasumsikan 3. Yang diuji tetap sama: seluruh stok tersedia dipesan lalu dikonfirmasi.
    const tehNow = await testDb().product.findUniqueOrThrow({ where: { id: s.products.teh.id } });
    const available = tehNow.stock - tehNow.reservedStock;
    expect(available).toBeGreaterThan(0);

    // pesan seluruh stok teh yang tersedia lalu konfirmasi -> tersedia 0
    const { orderNo } = await apiCreateOrder(aPage, [{ productId: s.products.teh.id, qty: available }]);
    const id = (await testDb().order.findUniqueOrThrow({ where: { orderNo } })).id;
    expect((await page.request.patch(`/api/orders/${id}`, { data: { action: "confirm" } })).status()).toBe(200);

    await page.goto("/admin/sales");
    await page.getByPlaceholder("Cari nama atau SKU barang...").fill(s.products.teh.name);
    const tehBtn = productButton(page, s.products.teh.name);
    await expect(tehBtn).toBeDisabled();
    await expect(tehBtn).toContainText("Habis");

    // dilepas (ditolak) -> tersedia lagi
    expect((await page.request.patch(`/api/orders/${id}`, { data: { action: "reject", reason: "lepas reservasi e2e" } })).status()).toBe(200);
    await page.goto("/admin/sales");
    await page.getByPlaceholder("Cari nama atau SKU barang...").fill(s.products.teh.name);
    await expect(productButton(page, s.products.teh.name)).toBeEnabled();
    await expect(productButton(page, s.products.teh.name)).toContainText(`Stok ${available}`);

    // barang stok 0 selalu terkunci
    await page.getByPlaceholder("Cari nama atau SKU barang...").fill(s.products.habis.name);
    await expect(productButton(page, s.products.habis.name)).toBeDisabled();

    await a.close();
  });
});
