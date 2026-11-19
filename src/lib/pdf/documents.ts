import PDFDocument from "pdfkit";
import { formatRupiah } from "@/lib/money";
import { formatPaymentLine } from "@/lib/paymentLabels";

export type OrderProofPdfInput = {
  orderNo: string;
  createdAtWib: string;
  statusLabel: string;
  memberName: string;
  memberNo: string;
  note?: string | null;
  rejectReason?: string | null;
  items: { name: string; qty: number; unit: string; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  total: number;
};

export type SaleReceiptPdfInput = {
  saleNo: string;
  soldAtWib: string;
  orderNo?: string | null;
  buyerLabel: string;
  cashierLabel?: string | null;
  items: { name: string; qty: number; unit: string; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function renderPdf(build: (doc: PdfDoc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

export function buildOrderProofPdf(input: OrderProofPdfInput): Promise<Buffer> {
  return renderPdf((doc) => {
    doc.fontSize(14).text("Koperasi — Bukti Pesanan", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`No. Pesanan: ${input.orderNo}`);
    doc.text(`Tanggal (WIB): ${input.createdAtWib}`);
    doc.text(`Status: ${input.statusLabel}`);
    doc.text(`Anggota: ${input.memberNo} · ${input.memberName}`);
    if (input.note) doc.text(`Catatan: ${input.note}`);
    if (input.rejectReason) doc.text(`Alasan penolakan: ${input.rejectReason}`);
    doc.moveDown();
    doc.text("Rincian barang:", { underline: true });
    input.items.forEach((it) => {
      doc.text(
        `${it.name} — ${it.qty} ${it.unit} × ${formatRupiah(it.unitPrice)} = ${formatRupiah(it.lineTotal)}`
      );
    });
    doc.moveDown();
    doc.text(`Subtotal: ${formatRupiah(input.subtotal)}`);
    doc.font("Helvetica-Bold").text(`Total: ${formatRupiah(input.total)}`);
    doc.font("Helvetica");
    doc.moveDown();
    doc.fontSize(9).fillColor("#555555").text("Dokumen ini bukan struk pembayaran.", { align: "center" });
    doc.fillColor("#000000");
  });
}

export function buildSaleReceiptPdf(input: SaleReceiptPdfInput): Promise<Buffer> {
  return renderPdf((doc) => {
    doc.fontSize(14).text("Koperasi — Struk Penjualan", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`No. Penjualan: ${input.saleNo}`);
    doc.text(`Tanggal (WIB): ${input.soldAtWib}`);
    if (input.orderNo) doc.text(`No. Pesanan: ${input.orderNo}`);
    doc.text(`Pembeli: ${input.buyerLabel}`);
    if (input.cashierLabel) doc.text(`Kasir: ${input.cashierLabel}`);
    doc.moveDown();
    doc.text("Rincian barang:", { underline: true });
    input.items.forEach((it) => {
      doc.text(
        `${it.name} — ${it.qty} ${it.unit} × ${formatRupiah(it.unitPrice)} = ${formatRupiah(it.lineTotal)}`
      );
    });
    doc.moveDown();
    doc.text(`Subtotal: ${formatRupiah(input.subtotal)}`);
    doc.text(`Diskon: - ${formatRupiah(input.discount)}`);
    doc.font("Helvetica-Bold").text(`Total: ${formatRupiah(input.total)}`);
    doc.font("Helvetica");
    doc.text(`Pembayaran: ${formatPaymentLine(input.paymentMethod, input.paymentStatus)}`);
    doc.moveDown();
    doc.fontSize(9).fillColor("#555555").text("Terima kasih telah berbelanja.", { align: "center" });
    doc.fillColor("#000000");
  });
}