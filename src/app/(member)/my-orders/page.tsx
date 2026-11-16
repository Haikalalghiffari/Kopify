import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMemberOrders } from "@/services/orderService";
import { formatRupiah } from "@/lib/money";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

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

export default async function MemberOrdersPage() {
  const session = await getServerSession(authOptions);
  const memberId = session?.user?.memberId;
  const orders = memberId ? await listMemberOrders(memberId) : [];

  if (orders.length === 0) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
          <ClipboardList className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold text-slate-800">Belum ada pesanan</h1>
        <Link href="/catalog" className="text-sm text-emerald-700 font-medium hover:underline">
          Mulai belanja
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">Pesanan Saya</h1>

      <div className="space-y-3">
        {orders.map((o) => {
          const st = STATUS_STYLE[o.status] ?? { label: o.status, className: "bg-slate-100 text-slate-700" };
          return (
            <div key={o.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800">{o.orderNo}</p>
                  <p className="text-xs text-slate-500">
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

              {o.status === "DITOLAK" && o.rejectReason && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  Alasan penolakan: {o.rejectReason}
                </p>
              )}

              <div className="flex justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">Total</span>
                <span className="font-bold text-emerald-700">{formatRupiah(o.total)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}