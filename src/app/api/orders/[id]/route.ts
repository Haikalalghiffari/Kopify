import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  confirmOrder,
  advanceOrder,
  completeOrder,
  rejectOrder,
  cancelOrder,
  OrderError,
} from "@/services/orderService";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
    switch (body?.action) {
      case "confirm":
        await confirmOrder(params.id);
        break;
      case "prepare":
        await advanceOrder(params.id, "DISIAPKAN");
        break;
      case "ready":
        await advanceOrder(params.id, "SIAP_DIAMBIL");
        break;
      case "complete":
        await completeOrder(params.id, { userId });
        break;
      case "reject":
        await rejectOrder(params.id, String(body.reason ?? ""));
        break;
      case "cancel":
        await cancelOrder(params.id);
        break;
      default:
        return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Proses pesanan gagal:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}