/**
 * E2E P4 — smoke mobile (390x844): tidak ada scroll horizontal dan aksi utama tetap terjangkau.
 * Hanya membaca halaman (kecuali login yang menulis audit LOGIN untuk akun seed). Dinonaktifkan kecuali RUN_P4_E2E=1.
 */
import { expect, test } from "@playwright/test";
import { isE2EEnabled } from "../../src/tests/p4/support/safeDb";
import { expectNoHorizontalOverflow, loadState, login } from "./support/helpers";

test.skip(!isE2EEnabled(), "E2E P4 dinonaktifkan: set RUN_P4_E2E=1 setelah ada izin eksplisit.");
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe("mobile — anggota", () => {
  test("katalog, keranjang, dan pesanan saya muat di layar 390px", async ({ page }) => {
    const s = loadState();
    await login(page, "memberA");

    await page.goto(`/catalog?q=${encodeURIComponent(s.prefix)}`);
    await expect(page.getByText(/barang ditemukan/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("button", { name: "Tambah ke keranjang" }).first()).toBeVisible();

    await page.goto("/cart");
    await expectNoHorizontalOverflow(page);

    await page.goto("/my-orders");
    await expectNoHorizontalOverflow(page);

    // navigasi mobile (hamburger) dapat dibuka dan menuju Pesanan Saya
    await page.goto("/catalog");
    await page.locator("header button:visible").first().click();
    await page.getByRole("link", { name: "Pesanan Saya" }).last().click();
    await expect(page).toHaveURL(/\/my-orders/);
  });
});

test.describe("mobile — staf", () => {
  test("pesanan, buat pesanan, dan POS muat di layar 390px; sidebar dapat dibuka dengan badge", async ({ page }) => {
    await login(page, "kasir");

    for (const path of ["/admin/orders", "/admin/orders/new", "/admin/sales"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    // sidebar tersembunyi di mobile; tombol menu membukanya dan navigasi bekerja (bukan jalan buntu)
    await page.goto("/admin/orders");
    await page.locator("header button:visible").first().click();
    const nav = page.getByRole("link", { name: /Pesanan Masuk/ });
    await expect(nav).toBeVisible();
    await page.getByRole("link", { name: /Kasir \(POS\)/ }).click();
    await expect(page).toHaveURL(/\/admin\/sales/);
    await expect(page.getByRole("button", { name: "Bayar" })).toBeVisible();
  });
});
