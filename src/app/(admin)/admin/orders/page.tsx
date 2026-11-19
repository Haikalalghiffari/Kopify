import Link from "next/link";
import { Prisma, OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/money";
import { formatPaymentLine } from "@/lib/paymentLabels";
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

type SearchParams = { status?: string; from?: string; to?: string; q?: string };

// Tanggal input (YYYY-MM-DD) dibaca sebagai hari WIB (UTC+7)
function parseWibDate(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const status = Object.keys(STATUS_STYLE).includes(searchParams.status ?? "")
    ? (searchParams.status as OrderStatus)
    : undefined;
  const from = parseWibDate(searchParams.from, false);
  const to = parseWibDate(searchParams.to, true);
  const q = (searchParams.q ?? "").trim();

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;
  if (from || to) where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) };
  if (q) {
    where.OR = [
      { orderNo: { contains: q, mode: "insensitive" } },
      { member: { name: { contains: q, mode: "insensitive" } } },
      { member: { memberNo: { contains: q, mode: "insensitive" } } },
    ];
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      member: true,
      orderItems: { include: { product: true } },
      sale: {
        select: { id: true, saleNo: true, paymentMethod: true, paymentStatus: true },
      },
    },
  });

  const hasFilter = Boolean(status || from || to || q);
  const field =
    "px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Pesanan Anggota</h1>
        <Link
          href="/admin/orders/new"
          className="px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Buat pesanan
        </Link>
      </div>

      {/* Filter: form GET biasa, hasilnya masuk ke alamat URL */}
      <form
        method="get"
        className="p-4 bg-white border border-slate-200 rounded-2xl grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end"
      >
        <div className="lg:col-span-2">
          <label className="text-xs text-slate-500">No. pesanan / anggota</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Cth: ORD-2026 atau Budi"
            className={`${field} w-full`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className={`${field} w-full`}>
            <option value="">Semua status</option>
            {Object.entries(STATUS_STYLE).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Dari tanggal</label>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ""}
            className={`${field} w-full`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Sampai tanggal</label>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ""}
            className={`${field} w-full`}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            className="px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Terapkan filter
          </button>
          {hasFilter && (
            <Link
              href="/admin/orders"
              className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-slate-500">{orders.length} pesanan ditemukan.</p>

      {orders.length === 0 && (
        <p className="text-sm text-slate-500">
          {hasFilter ? "Tidak ada pesanan yang cocok dengan filter." : "Belum ada pesanan."}
        </p>
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const st = STATUS_STYLE[o.status] ?? {
            label: o.status,
            className: "bg-slate-100 text-slate-700",
          };
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
              {o.rejectReason && (
                <p className="text-sm text-red-600">Alasan ditolak: {o.rejectReason}</p>
              )}

              <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-3">
                <div className="space-y-2">
                  <OrderActions orderId={o.id} status={o.status} />
                  {o.sale && (
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-600">
                        Pembayaran: {formatPaymentLine(o.sale.paymentMethod, o.sale.paymentStatus)}
                      </p>
                      <Link
                        href={`/admin/sales/${o.sale.id}/receipt`}
                        className="inline-block text-emerald-700 underline"
                      >
                        Lihat struk {o.sale.saleNo}
                      </Link>
                    </div>
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