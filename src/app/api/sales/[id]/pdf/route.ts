import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessSaleReceipt } from "@/lib/receiptAccess";
import { buildSaleReceiptPdf } from "@/lib/pdf/documents";
import { formatWibDateTime } from "@/lib/formatWibDateTime";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const sale = await db.sale.findUnique({
    where: { id: params.id },
    include: {
      member: true,
      user: true,
      order: { select: { orderNo: true, memberId: true } },
      saleItems: { include: { product: { include: { unit: true } } } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Struk tidak ditemukan." }, { status: 404 });
  }

  const allowed = canAccessSaleReceipt({
    role: session.user.role,
    sessionMemberId: session.user.memberId,
    saleMemberId: sale.memberId,
    orderMemberId: sale.order?.memberId,
  });

  if (!allowed) {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  const items = sale.saleItems.map((it) => ({
    name: it.product.name,
    qty: it.qty,
    unit: it.product.unit.name,
    unitPrice: it.unitPrice,
    lineTotal: it.qty * it.unitPrice,
  }));

  const subtotal = sale.total + sale.discount;

  const pdf = await buildSaleReceiptPdf({
    saleNo: sale.saleNo,
    soldAtWib: formatWibDateTime(sale.soldAt),
    orderNo: sale.order?.orderNo,
    buyerLabel: sale.member ? `${sale.member.memberNo} · ${sale.member.name}` : "Umum",
    cashierLabel: sale.user?.username,
    items,
    subtotal,
    discount: sale.discount,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="struk-${sale.saleNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}