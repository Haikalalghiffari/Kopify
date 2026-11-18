import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelOrder, OrderError, OrderNotFoundError } from "@/services/orderService";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const memberId = session.user.memberId ?? undefined;
  if (!memberId) {
    return NextResponse.json({ error: "Akun ini bukan akun anggota." }, { status: 403 });
  }

  const userId = session.user.id;

  try {
    await cancelOrder(params.id, { memberId, userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OrderNotFoundError) {
      // Pesanan milik anggota lain diperlakukan sama seperti tidak ada (AC PRD 6.5: 403/404)
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof OrderError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Batal pesanan gagal:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}