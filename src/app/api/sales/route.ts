import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSale, SaleError } from "@/services/saleService";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "KASIR") {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const userId = (session.user as any).id as string | undefined;

  try {
    const sale = await createSale({
      items: Array.isArray(body?.items) ? body.items : [],
      memberId: body?.memberId || null,
      discount: Number(body?.discount ?? 0),
      paymentMethod: body?.paymentMethod,
      paymentStatus: body?.paymentStatus,
      createdBy: userId,
    });
    return NextResponse.json(sale, { status: 201 });
  } catch (e) {
    if (e instanceof SaleError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Penjualan gagal:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}