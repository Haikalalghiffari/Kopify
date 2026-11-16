import Link from "next/link";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/money";
import OrderActions from "@/components/admin/OrderActions";

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

export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({
  orderBy: { createdAt: "desc" },
  include: {
    member: true,
    orderItems: { include: { product: true } },
    sale: { select: { id: true } },
  },
});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">Pesanan Anggota</h1>

      {orders.length === 0 && <p className="text-sm text-slate-500">Belum ada pesanan.</p>}

      <div className="space-y-3">
        {orders.map((o) => {
          const st = STATUS_STYLE[o.status] ?? { label: o.status, className: "bg-slate-100 text-slate-700" };
          return (
            <div key={o.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800">{o.orderNo}</p>
                  <p className="text-xs text-slate-500">
                    {o.member?.name} ·{" "}
                    {new Date(o.createdAt).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.className}`}>
                  {st.label}
                </span>
              </div>

              <ul className="text-sm text-slate-600 space-y-1">
                {o.orderItems.map((it) => (
                  <li key={it.id} className="flex justify-between gap-4">
                    <span>
                      {it.product.name} × {it.qty}
                    </span>
                    <span>{formatRupiah(it.unitPrice * it.qty)}</span>
                  </li>
                ))}
              </ul>

              {o.note && <p className="text-sm text-slate-500">Catatan: {o.note}</p>}

              <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-3">
                  <div className="space-y-2">
                  <OrderActions orderId={o.id} status={o.status} />
                    {o.sale && (
                  <Link
                        href={`/admin/sales/${o.sale.id}/receipt`}
                        className="inline-block text-sm text-emerald-700 underline"
                  >
                        Lihat struk
                    </Link>
                  )}
            </div>
              <span className="font-bold text-emerald-700">{formatRupiah(o.total)}</span>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}