import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMemberOrder } from "@/services/orderService";
import { formatRupiah } from "@/lib/money";
import { formatWibDateTime } from "@/lib/formatWibDateTime";
import { formatPaymentLine } from "@/lib/paymentLabels";
import CancelOrderButton from "@/components/member/CancelOrderButton";
import DownloadPdfLink from "@/components/shared/DownloadPdfLink";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  DIAJUKAN: { label: "Diajukan", className: "bg-amber-50 text-amber-700" },
  DIKONFIRMASI: { label: "Dikonfirmasi", className: "bg-blue-50 text-blue-700" },
  DISIAPKAN: { label: "Disiapkan", className: "bg-indigo-50 text-indigo-700" },
  SIAP_DIAMBIL: { label: "Siap diambil", className: "bg-emerald-50 text-emerald-700" },
  SELESAI: { label: "Selesai", className: "bg-slate-100 text-slate-700" },
  DIBATALKAN: { label: "Dibatalkan", className: "bg-red-50 text-red-700" },
  DITOLAK: { label: "Ditolak", className: "bg-red-50 text-red-700" },
};

export default async function MemberOrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const memberId = session?.user?.memberId;
  if (!memberId) notFound();

  let order;
  try {
    order = await getMemberOrder(params.id, memberId);
  } catch {
    notFound();
  }

  const st = STATUS_STYLE[order.status] ?? {
    label: order.status,
    className: "bg-slate-100 text-slate-700",
  };

  const subtotal = order.orderItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);

  const sale = await db.sale.findUnique({
    where: { orderId: order.id },
    select: {
      id: true,
      saleNo: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <Link href="/my-orders" className="text-sm text-emerald-700 hover:underline">
        ← Kembali ke daftar pesanan
      </Link>

      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{order.orderNo}</h1>
            <p className="text-sm text-slate-500">{formatWibDateTime(order.createdAt)} (WIB)</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.className}`}>
            {st.label}
          </span>
        </div>

        <DownloadPdfLink
          href={`/api/orders/${order.id}/proof`}
          label="Unduh bukti pesanan (PDF)"
        />

        {sale && (
          <div className="text-sm text-slate-600 space-y-1 border-t border-slate-100 pt-3">
            <p>
              Struk penjualan: <span className="font-medium">{sale.saleNo}</span>
            </p>
            <p>Pembayaran: {formatPaymentLine(sale.paymentMethod, sale.paymentStatus)}</p>
            <DownloadPdfLink
              href={`/api/sales/${sale.id}/pdf`}
              label="Unduh struk (PDF)"
            />
          </div>
        )}

        {order.note && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
            Catatan: {order.note}
          </p>
        )}

        {order.status === "DITOLAK" && order.rejectReason && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            Alasan penolakan: {order.rejectReason}
          </p>
        )}

        <ul className="text-sm text-slate-700 space-y-2 border-t border-slate-100 pt-3">
          {order.orderItems.map((it) => (
            <li key={it.id} className="flex justify-between gap-4">
              <span>
                {it.product.name} × {it.qty}{" "}
                <span className="text-slate-500">({formatRupiah(it.unitPrice)}/item)</span>
              </span>
              <span className="font-medium">{formatRupiah(it.unitPrice * it.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700 text-base">
            <span>Total</span>
            <span>{formatRupiah(order.total)}</span>
          </div>
        </div>

        {order.status === "DIAJUKAN" && (
          <div className="border-t border-slate-100 pt-3">
            <CancelOrderButton orderId={order.id} />
          </div>
        )}
      </div>
    </div>
  );
}