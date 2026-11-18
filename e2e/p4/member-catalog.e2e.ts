/**
 * E2E P4 — Journey 1 & 2: katalog anggota (cari/filter/paginasi/stok habis) dan keranjang -> checkout.
 * MENULIS ke koperasi_test_db (hanya data prefix P4E2E-). Dinonaktifkan kecuali RUN_P4_E2E=1.
 */
import { expect, test } from "@playwright/test";
import { isE2EEnabled } from "../../src/tests/p4/support/safeDb";
import { loadState, login, testDb } from "./support/helpers";

test.skip(!isE2EEnabled(), "E2E P4 dinonaktifkan: set RUN_P4_E2E=1 setelah ada izin eksplisit.");

const card = (page: import("@playwright/test").Page, name: string) =>
  page.locator("div.rounded-2xl", { has: page.getByRole("heading", { name, exact: true }) }).first();

test.describe("J1 — katalog anggota", () => {
  test("cari, filter kategori, paginasi 12/halaman, dan hasil kosong", async ({ page }) => {
    const s = loadState();
    await login(page, "memberA");
    await page.goto("/catalog");

    // cari: seluruh produk run ini (3 + paging) => 2 halaman
    await page.getByPlaceholder("Contoh: kopi atau SKU-001").fill(s.prefix);
    await page.getByRole("button", { name: "Cari" }).click();
    const total = 3 + s.pagingCount;
    await expect(page.getByText(`${total} barang ditemukan`)).toBeVisible();
    await expect(page.getByText("Halaman 1 dari 2")).toBeVisible();
    await expect(page.locator("main h2")).toHaveCount(12);

    // halaman 2 menyimpan filter pencarian
    await page.getByRole("link", { name: "Berikutnya" }).click();
    await expect(page).toHaveURL(/page=2/);
    expect(decodeURIComponent(page.url())).toContain(`q=${s.prefix}`); // filter ikut terbawa
    await expect(page.getByText("Halaman 2 dari 2")).toBeVisible();
    await expect(page.locator("main h2")).toHaveCount(total - 12);
    await page.getByRole("link", { name: "Sebelumnya" }).click();
    await expect(page.getByText("Halaman 1 dari 2")).toBeVisible();

    // filter kategori B: hanya Teh
    await page.goto("/catalog");
    await page.getByPlaceholder("Contoh: kopi atau SKU-001").fill(s.prefix);
    await page.locator('select[name="category"]').selectOption({ label: s.categories.b.name });
    await page.getByRole("button", { name: "Cari" }).click();
    await expect(page.getByText("1 barang ditemukan")).toBeVisible();
    await expect(card(page, s.products.teh.name)).toBeVisible();

    // tidak ada hasil: pesan yang jelas dan jalan keluar (Reset)
    await page.goto(`/catalog?q=${encodeURIComponent(`tidak-ada-${s.runId}`)}`);
    await expect(page.getByText("Tidak ada barang yang cocok dengan filter.")).toBeVisible();
    await page.getByRole("link", { name: "Reset" }).click();
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test("barang stok habis tidak bisa ditambahkan ke keranjang", async ({ page }) => {
    const s = loadState();
    await login(page, "memberA");
    await page.goto(`/catalog?q=${encodeURIComponent(s.products.habis.name)}`);
    const c = card(page, s.products.habis.name);
    await expect(c.getByText("Stok habis").first()).toBeVisible();
    await expect(c.getByRole("button", { name: "Stok habis" })).toBeDisabled();
  });
});

test.describe("J2 — keranjang dan checkout anggota", () => {
  test("tambah ke keranjang, ubah jumlah, checkout membuat pesanan DIAJUKAN atas nama anggota", async ({ page }) => {
    const s = loadState();
    const db = testDb();
    await login(page, "memberA");

    await page.goto(`/catalog?q=${encodeURIComponent(s.products.kopi.name)}`);
    await card(page, s.products.kopi.name).getByRole("button", { name: "Tambah ke keranjang" }).click();

    await page.goto("/cart");
    await expect(page.getByText(s.products.kopi.name)).toBeVisible();
    await page.locator("button:has(svg.lucide-plus)").click(); // qty 1 -> 2
    await expect(page.getByText("Rp 24.000").first()).toBeVisible();

    const stockBefore = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    await page.getByRole("button", { name: "Checkout" }).click();
    await expect(page.getByText("Pesanan berhasil diajukan")).toBeVisible();
    const orderNo = (await page.locator("p", { hasText: "Nomor pesanan" }).locator("span").first().innerText()).trim();
    expect(orderNo).toMatch(/^ORD-\d{8}-\d{4,}$/);

    // efek di DB: milik anggota A, harga dari server, belum mereservasi stok (baru saat dikonfirmasi)
    const order = await db.order.findUniqueOrThrow({ where: { orderNo }, include: { orderItems: true } });
    expect(order).toMatchObject({ memberId: s.accounts.memberA.memberId, status: "DIAJUKAN", total: 2 * s.products.kopi.price });
    expect(order.orderItems).toHaveLength(1);
    expect(order.orderItems[0]).toMatchObject({ productId: s.products.kopi.id, qty: 2, unitPrice: s.products.kopi.price });
    const stockAfter = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    expect(stockAfter.reservedStock).toBe(stockBefore.reservedStock);

    // keranjang kosong setelah checkout, dan pesanan muncul di "Pesanan Saya"
    await page.goto("/cart");
    await expect(page.getByText("Keranjang masih kosong")).toBeVisible();
    await page.goto("/my-orders");
    await expect(page.getByRole("link", { name: orderNo })).toBeVisible();
  });

  test("jumlah di keranjang dibatasi stok tersedia (tidak bisa melebihi)", async ({ page }) => {
    const s = loadState();
    await login(page, "memberA");
    await page.goto(`/catalog?q=${encodeURIComponent(s.products.teh.name)}`);
    await card(page, s.products.teh.name).getByRole("button", { name: "Tambah ke keranjang" }).click();
    await page.goto("/cart");

    const plus = page.locator("button:has(svg.lucide-plus)");
    await plus.click();
    await plus.click(); // qty 3 = stok tersedia
    await expect(plus).toBeDisabled();
    await page.getByRole("button", { name: "Hapus" }).click();
    await expect(page.getByText("Keranjang masih kosong")).toBeVisible();
  });

  test("keranjang kosong memberi jalan menuju katalog (bukan jalan buntu)", async ({ page }) => {
    await login(page, "memberB");
    await page.goto("/cart");
    await page.getByRole("link", { name: "Lihat katalog barang" }).click();
    await expect(page).toHaveURL(/\/catalog/);
  });
});
