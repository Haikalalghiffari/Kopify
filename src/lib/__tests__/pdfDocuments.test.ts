import { describe, it, expect } from "vitest";
import { buildOrderProofPdf, buildSaleReceiptPdf } from "../pdf/documents";
import { formatPaymentLine } from "../paymentLabels";

describe("PDF documents", () => {
  it("builds order proof PDF with valid header", async () => {
    const buf = await buildOrderProofPdf({
      orderNo: "ORD-20261118-0001",
      createdAtWib: "18 Nov 2026, 10.00",
      statusLabel: "Diajukan",
      memberName: "Budi",
      memberNo: "ANG-001",
      items: [
        {
          name: "Kopi",
          qty: 2,
          unit: "pcs",
          unitPrice: 10000,
          lineTotal: 20000,
        },
      ],
      subtotal: 20000,
      total: 20000,
    });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("builds sale receipt PDF with payment line", async () => {
    const buf = await buildSaleReceiptPdf({
      saleNo: "SLS-20261118-0001",
      soldAtWib: "18 Nov 2026, 11.00",
      buyerLabel: "Umum",
      items: [
        {
          name: "Teh",
          qty: 1,
          unit: "pcs",
          unitPrice: 5000,
          lineTotal: 5000,
        },
      ],
      subtotal: 5000,
      discount: 0,
      total: 5000,
      paymentMethod: "TUNAI",
      paymentStatus: "LUNAS",
    });
    expect(buf.length).toBeGreaterThan(500);
    expect(formatPaymentLine("TUNAI", "LUNAS")).toContain("Tunai");
  });
});