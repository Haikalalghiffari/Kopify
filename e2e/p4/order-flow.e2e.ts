/**
 * E2E P4 — Journey 3-6 & 8: detail + bukti PDF, batal anggota, pemenuhan pesanan oleh kasir
 * (konfirmasi -> siapkan -> siap diambil -> selesai + pembayaran + struk), penolakan dengan alasan,
 * dan kasir membuat pesanan atas nama anggota (FR-5.9).
 *
 * MENULIS ke koperasi_test_db (hanya data prefix P4E2E-). Dinonaktifkan kecuali RUN_P4_E2E=1.
 */
import { expect, test, type Browser } from "@playwright/test";
import { isE2EEnabled } from "../../src/tests/p4/support/safeDb";
import {
  adminOrderCard,
  apiCreateOrder,
  autoAcceptDialogs,
  expectPdf,
  loadState,
  login,
  memberOrderCard,
  searchAdminOrders,
  selectNextToLabel,
  testDb,
  type Who,
} from "./support/helpers";

test.skip(!isE2EEnabled(), "E2E P4 dinonaktifkan: set RUN_P4_E2E=1 setelah ada izin eksplisit.");
test.describe.configure({ mode: "serial" });

async function session(browser: Browser, who: Who) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, who);
  return { context, page };
}

const orderIdOf = async (orderNo: string) => (await testDb().order.findUniqueOrThrow({ where: { orderNo } })).id;

test.describe("J3 — detail pesanan dan bukti PDF (FR-5.8)", () => {
  test("pemilik dapat membuka detail dan mengunduh bukti; anggota lain dan anonim tidak", async ({ browser }) => {
    const s = loadState();
    const a = await session(browser, "memberA");
    const { orderNo } = await apiCreateOrder(a.page, [{ productId: s.products.kopi.id, qty: 2 }], "catatan e2e");
    const id = await orderIdOf(orderNo);

    // daftar -> detail
    await a.page.goto("/my-orders");
    await expect(memberOrderCard(a.page, orderNo).getByText("Diajukan")).toBeVisible();
    await a.page.getByRole("link", { name: orderNo }).click();
    await expect(a.page).toHaveURL(new RegExp(`/my-orders/${id}$`));
    await expect(a.page.getByRole("heading", { name: orderNo })).toBeVisible();
    await expect(a.page.getByText("catatan e2e")).toBeVisible();
    await expect(a.page.getByText("Rp 24.000").first()).toBeVisible();

    // bukti pesanan PDF
    const link = a.page.getByRole("link", { name: "Unduh bukti pesanan (PDF)" });
    await expect(link).toHaveAttribute("href", `/api/orders/${id}/proof`);
    await expectPdf(await a.page.request.get(`/api/orders/${id}/proof`));

    // anggota lain: halaman 404, PDF 404 (tidak membocorkan keberadaan pesanan)
    const b = await session(browser, "memberB");
    const pageRes = await b.page.goto(`/my-orders/${id}`);
    expect(pageRes?.status()).toBe(404);
    expect((await b.page.request.get(`/api/orders/${id}/proof`)).status()).toBe(404);

    // anonim: tidak pernah mendapat PDF (middleware mengalihkan ke /login)
    const anon = await browser.newContext();
    const anonRes = await anon.request.get(`/api/orders/${id}/proof`);
    expect(anonRes.headers()["content-type"] ?? "").not.toContain("application/pdf");
    await anon.close();

    await a.context.close();
    await b.context.close();
  });
});

test.describe("J4 — anggota membatalkan pesanan", () => {
  test("batal hanya saat DIAJUKAN; dialog dibatalkan tidak mengubah apa pun", async ({ browser }) => {
    const s = loadState();
    const a = await session(browser, "memberA");
    const { orderNo } = await apiCreateOrder(a.page, [{ productId: s.products.kopi.id, qty: 1 }]);
    await a.page.goto("/my-orders");
    const card = memberOrderCard(a.page, orderNo);

    // 1) batal di dialog konfirmasi -> tidak berubah
    a.page.once("dialog", (d) => void d.dismiss());
    await card.getByRole("button", { name: "Batalkan pesanan" }).click();
    await expect(card.getByText("Diajukan")).toBeVisible();
    expect((await testDb().order.findUniqueOrThrow({ where: { orderNo } })).status).toBe("DIAJUKAN");

    // 2) setuju -> DIBATALKAN, tombol hilang
    a.page.once("dialog", (d) => void d.accept());
    await card.getByRole("button", { name: "Batalkan pesanan" }).click();
    await expect(card.getByText("Dibatalkan")).toBeVisible();
    await expect(card.getByRole("button", { name: "Batalkan pesanan" })).toHaveCount(0);
    expect((await testDb().order.findUniqueOrThrow({ where: { orderNo } })).status).toBe("DIBATALKAN");

    await a.context.close();
  });

  test("setelah dikonfirmasi kasir, anggota tidak lagi melihat tombol batal dan API menolak", async ({ browser }) => {
    const s = loadState();
    const a = await session(browser, "memberA");
    const k = await session(browser, "kasir");
    const { orderNo } = await apiCreateOrder(a.page, [{ productId: s.products.kopi.id, qty: 1 }]);
    const id = await orderIdOf(orderNo);

    const confirm = await k.page.request.patch(`/api/orders/${id}`, { data: { action: "confirm" } });
    expect(confirm.status()).toBe(200);

    await a.page.goto(`/my-orders/${id}`);
    await expect(a.page.getByText("Dikonfirmasi")).toBeVisible();
    await expect(a.page.getByRole("button", { name: "Batalkan pesanan" })).toHaveCount(0);
    expect((await a.page.request.post(`/api/orders/${id}/cancel`)).status()).toBe(400);

    // bersihkan reservasi agar tidak mengganggu skenario lain
    expect((await k.page.request.patch(`/api/orders/${id}`, { data: { action: "reject", reason: "bersih-bersih e2e" } })).status()).toBe(200);
    await a.context.close();
    await k.context.close();
  });
});

test.describe("J5 — kasir memenuhi pesanan sampai selesai", () => {
  test("konfirmasi -> siapkan -> siap diambil -> selesai (Transfer/Lunas) + struk, dengan sidebar dan badge", async ({ browser }) => {
    const s = loadState();
    const db = testDb();
    const a = await session(browser, "memberA");
    const k = await session(browser, "kasir");
    autoAcceptDialogs(k.page);

    const kopiBefore = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    const { orderNo } = await apiCreateOrder(a.page, [
      { productId: s.products.kopi.id, qty: 2 },
      { productId: s.products.teh.id, qty: 1 },
    ]);
    const id = await orderIdOf(orderNo);

    // halaman pesanan staf memiliki sidebar (FR-5.5) dengan badge pesanan DIAJUKAN
    await k.page.goto("/admin/orders");
    const nav = k.page.getByRole("link", { name: /Pesanan Masuk/ });
    await expect(nav).toBeVisible();
    await expect(nav.locator("span.rounded-full")).toBeVisible(); // badge > 0
    expect(Number((await nav.locator("span.rounded-full").innerText()).trim())).toBeGreaterThanOrEqual(1);

    await searchAdminOrders(k.page, orderNo);
    const card = adminOrderCard(k.page, orderNo);
    await expect(card.getByText("Diajukan", { exact: true })).toBeVisible();

    // konfirmasi -> stok direservasi
    await card.getByRole("button", { name: "Konfirmasi" }).click();
    await expect(card.getByText("Dikonfirmasi", { exact: true })).toBeVisible();
    const kopiReserved = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    expect(kopiReserved.reservedStock).toBe(kopiBefore.reservedStock + 2);

    await card.getByRole("button", { name: "Mulai siapkan" }).click();
    await expect(card.getByText("Disiapkan", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Siap diambil" }).click();
    await expect(card.getByText("Siap diambil", { exact: true }).first()).toBeVisible();

    // selesai dengan pembayaran eksplisit
    await selectNextToLabel(card, "Metode bayar").selectOption("TRANSFER");
    await selectNextToLabel(card, "Status bayar").selectOption("LUNAS");
    await card.getByRole("button", { name: "Selesaikan" }).click();
    await expect(card.getByText("Selesai", { exact: true })).toBeVisible();
    await expect(card.getByText("Pembayaran: Transfer · Lunas")).toBeVisible();

    // efek di DB: stok terpotong sekali, reservasi turun, Sale + audit lengkap
    const kopiAfter = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    expect(kopiAfter.stock).toBe(kopiBefore.stock - 2);
    expect(kopiAfter.reservedStock).toBe(kopiBefore.reservedStock);
    const sale = await db.sale.findUniqueOrThrow({ where: { orderId: id }, include: { saleItems: true } });
    expect(sale).toMatchObject({
      paymentMethod: "TRANSFER",
      paymentStatus: "LUNAS",
      memberId: s.accounts.memberA.memberId,
      createdBy: s.accounts.kasir.id,
      total: 2 * s.products.kopi.price + s.products.teh.price,
    });
    expect(sale.saleItems).toHaveLength(2);
    const audits = await db.auditLog.findMany({ where: { entity: "Order", entityId: id }, orderBy: { createdAt: "asc" } });
    expect(audits.map((x) => x.action)).toEqual(["CREATE_ORDER", "CONFIRM_ORDER", "ADVANCE_ORDER", "ADVANCE_ORDER", "COMPLETE_ORDER"]);
    expect(audits.find((x) => x.action === "CONFIRM_ORDER")?.userId).toBe(s.accounts.kasir.id);

    // struk: link dari kartu pesanan -> halaman struk (dengan sidebar) -> PDF
    await card.getByRole("link", { name: `Lihat struk ${sale.saleNo}` }).click();
    await expect(k.page).toHaveURL(new RegExp(`/admin/sales/${sale.id}/receipt$`));
    await expect(k.page.getByText("Struk Penjualan")).toBeVisible();
    await expect(k.page.getByText(sale.saleNo)).toBeVisible();
    await expect(k.page.getByText("Transfer · Lunas")).toBeVisible();
    await expect(k.page.getByRole("link", { name: /Pesanan Masuk/ })).toBeVisible(); // masih ada navigasi
    await expect(k.page.getByRole("link", { name: "Kembali ke kasir" })).toBeVisible();
    await expect(k.page.getByRole("button", { name: /Cetak/ })).toBeVisible();
    await expectPdf(await k.page.request.get(`/api/sales/${sale.id}/pdf`));

    // anggota A melihat status, pembayaran, dan dapat mengunduh struk; anggota B tidak
    await a.page.goto(`/my-orders/${id}`);
    await expect(a.page.getByText("Selesai", { exact: true })).toBeVisible();
    await expect(a.page.getByText("Pembayaran: Transfer · Lunas")).toBeVisible();
    await expect(a.page.getByRole("link", { name: "Unduh struk (PDF)" })).toHaveAttribute("href", `/api/sales/${sale.id}/pdf`);
    await expectPdf(await a.page.request.get(`/api/sales/${sale.id}/pdf`));
    await expect(a.page.getByRole("button", { name: "Batalkan pesanan" })).toHaveCount(0);

    const b = await session(browser, "memberB");
    expect((await b.page.request.get(`/api/sales/${sale.id}/pdf`)).status()).toBe(403);

    await a.context.close();
    await k.context.close();
    await b.context.close();
  });

  test("tombol pembayaran: Bon memaksa status Belum lunas dan mengunci pilihan status", async ({ browser }) => {
    const s = loadState();
    const a = await session(browser, "memberA");
    const k = await session(browser, "kasir");
    autoAcceptDialogs(k.page);

    const { orderNo } = await apiCreateOrder(a.page, [{ productId: s.products.kopi.id, qty: 1 }]);
    const id = await orderIdOf(orderNo);
    for (const action of ["confirm", "prepare", "ready"]) {
      expect((await k.page.request.patch(`/api/orders/${id}`, { data: { action } })).status()).toBe(200);
    }

    await searchAdminOrders(k.page, orderNo);
    const card = adminOrderCard(k.page, orderNo);
    await selectNextToLabel(card, "Metode bayar").selectOption("BON");
    const status = selectNextToLabel(card, "Status bayar");
    await expect(status).toBeDisabled();
    await expect(status).toHaveValue("BELUM_LUNAS");
    await card.getByRole("button", { name: "Selesaikan" }).click();
    await expect(card.getByText("Pembayaran: Bon · Belum lunas")).toBeVisible();

    const sale = await testDb().sale.findUniqueOrThrow({ where: { orderId: id } });
    expect(sale).toMatchObject({ paymentMethod: "BON", paymentStatus: "BELUM_LUNAS" });

    await a.context.close();
    await k.context.close();
  });
});

test.describe("J6 — penolakan dengan alasan", () => {
  test("kasir menolak pesanan terkonfirmasi: stok dilepas dan anggota melihat alasan", async ({ browser }) => {
    const s = loadState();
    const db = testDb();
    const a = await session(browser, "memberA");
    const k = await session(browser, "kasir");
    k.page.on("dialog", (d) => void (d.type() === "prompt" ? d.accept("Stok rusak e2e") : d.accept()));

    const before = await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } });
    const { orderNo } = await apiCreateOrder(a.page, [{ productId: s.products.kopi.id, qty: 3 }]);

    await searchAdminOrders(k.page, orderNo);
    const card = adminOrderCard(k.page, orderNo);
    await card.getByRole("button", { name: "Konfirmasi" }).click();
    await expect(card.getByText("Dikonfirmasi", { exact: true })).toBeVisible();
    expect((await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } })).reservedStock).toBe(before.reservedStock + 3);

    await card.getByRole("button", { name: "Tolak" }).click();
    await expect(card.getByText("Ditolak", { exact: true })).toBeVisible();
    await expect(card.getByText("Alasan ditolak: Stok rusak e2e")).toBeVisible();
    expect((await db.product.findUniqueOrThrow({ where: { id: s.products.kopi.id } })).reservedStock).toBe(before.reservedStock);

    await a.page.goto("/my-orders");
    await expect(memberOrderCard(a.page, orderNo).getByText("Alasan penolakan: Stok rusak e2e")).toBeVisible();

    await a.context.close();
    await k.context.close();
  });
});

test.describe("J8 — kasir membuat pesanan atas nama anggota (FR-5.9)", () => {
  test("tombol 'Buat pesanan' membuka form, pesanan dibuat atas nama anggota dengan jejak kasir", async ({ browser }) => {
    const s = loadState();
    const db = testDb();
    const k = await session(browser, "kasir");

    await k.page.goto("/admin/orders");
    await k.page.getByRole("link", { name: "Buat pesanan" }).click(); // bukan tautan mati
    await expect(k.page).toHaveURL(/\/admin\/orders\/new$/);
    await expect(k.page.getByRole("heading", { name: "Buat Pesanan" })).toBeVisible();
    await expect(k.page.getByRole("link", { name: /Pesanan Masuk/ })).toBeVisible(); // sidebar ada

    // tombol submit terkunci sampai anggota + barang dipilih
    const submit = k.page.getByRole("button", { name: "Buat pesanan" });
    await expect(submit).toBeDisabled();

    await k.page.getByPlaceholder("Cari nama atau SKU barang...").fill(s.products.kopi.name);
    await k.page.getByRole("button", { name: new RegExp(s.products.kopi.name) }).click();
    await selectNextToLabel(k.page, "Atas nama anggota").selectOption(s.accounts.memberB.memberId);
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(k.page).toHaveURL(/\/admin\/orders$/);
    const created = await db.order.findFirstOrThrow({
      where: { memberId: s.accounts.memberB.memberId, createdBy: s.accounts.kasir.id },
      orderBy: { createdAt: "desc" },
      include: { orderItems: true },
    });
    expect(created.status).toBe("DIAJUKAN");
    expect(created.orderItems[0]).toMatchObject({ productId: s.products.kopi.id, qty: 1, unitPrice: s.products.kopi.price });
    await expect(adminOrderCard(k.page, created.orderNo)).toBeVisible();

    await k.context.close();
  });
});
