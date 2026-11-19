import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canMemberAccessOrder } from "@/lib/receiptAccess";
import { buildOrderProofPdf } from "@/lib/pdf/documents";
import { formatWibDateTime } from "@/lib/formatWibDateTime";
import { getMemberOrder } from "@/services/orderService";

const STATUS_LABEL: Record<string, string> = {
  DIAJUKAN: "Diajukan",
  DIKONFIRMASI: "Dikonfirmasi",
  DISIAPKAN: "Disiapkan",
  SIAP_DIAMBIL: "Siap diambil",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
  DITOLAK: "Ditolak",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const memberId = session.user.memberId;
  if (!memberId) {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  let order;
  try {
    order = await getMemberOrder(params.id, memberId);
  } catch {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  if (!canMemberAccessOrder(order.memberId, memberId)) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const member = await db.member.findUnique({
    where: { id: order.memberId },
    select: { memberNo: true, name: true },
  });

  const items = order.orderItems.map((it) => ({
    name: it.product.name,
    qty: it.qty,
    unit: it.product.unit?.name ?? "-",
    unitPrice: it.unitPrice,
    lineTotal: it.qty * it.unitPrice,
  }));

  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);

  const pdf = await buildOrderProofPdf({
    orderNo: order.orderNo,
    createdAtWib: formatWibDateTime(order.createdAt),
    statusLabel: STATUS_LABEL[order.status] ?? order.status,
    memberName: member?.name ?? "-",
    memberNo: member?.memberNo ?? "-",
    note: order.note,
    rejectReason: order.rejectReason,
    items,
    subtotal,
    total: order.total,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bukti-${order.orderNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}