import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/money";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  TUNAI: "Tunai",
  TRANSFER: "Transfer",
  BON: "Bon",
  LAINNYA: "Lainnya",
};

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const sale = await db.sale.findUnique({
    where: { id: params.id },
    include: {
      member: true,
      user: true,
      saleItems: { include: { product: { include: { unit: true } } } },
    },
  });
  if (!sale) notFound();

  const subtotal = sale.total + sale.discount; // total di database sudah dipotong diskon

  return (
    <div className="space-y-4">
      {/* Sembunyikan sidebar/header saat dicetak */}
      <style>{`
        @media print {
          aside, nav, header { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex gap-2 print:hidden">
        <PrintButton />
        <Link
          href="/admin/sales"
          className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Kembali ke kasir
        </Link>
      </div>

      <div className="max-w-sm mx-auto p-5 bg-white border border-slate-200 rounded-2xl space-y-4 text-sm">
        <div className="text-center">
          <p className="font-bold text-slate-800 text-base">Koperasi</p>
          <p className="text-xs text-slate-500">Struk Penjualan</p>
        </div>

        <div className="space-y-0.5 text-xs text-slate-600 border-t border-dashed border-slate-300 pt-3">
          <div className="flex justify-between">
            <span>No.</span>
            <span className="font-medium">{sale.saleNo}</span>
          </div>
          <div className="flex justify-between">
            <span>Tanggal</span>
            <span>
              {new Date(sale.soldAt).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Pembeli</span>
            <span>{sale.member ? `${sale.member.memberNo} · ${sale.member.name}` : "Umum"}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir</span>
            <span>{sale.user?.username ?? "-"}</span>
          </div>
        </div>

        <ul className="space-y-2 border-t border-dashed border-slate-300 pt-3">
          {sale.saleItems.map((it) => (
            <li key={it.id}>
              <p className="text-slate-800">{it.product.name}</p>
              <div className="flex justify-between text-xs text-slate-600">
                <span>
                  {it.qty} {it.product.unit.name} × {formatRupiah(it.unitPrice)}
                </span>
                <span>{formatRupiah(it.qty * it.unitPrice)}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t border-dashed border-slate-300 pt-3">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Diskon</span>
            <span>- {formatRupiah(sale.discount)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800 text-base">
            <span>Total</span>
            <span>{formatRupiah(sale.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 pt-1">
            <span>Pembayaran</span>
            <span>
              {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod} ·{" "}
              {sale.paymentStatus === "LUNAS" ? "Lunas" : "Belum lunas"}
            </span>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 border-t border-dashed border-slate-300 pt-3">
          Terima kasih telah berbelanja
        </p>
      </div>
    </div>
  );
}