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
  OrderNotFoundError,
} from "@/services/orderService";
import {
  parsePaymentMethodInput,
  parsePaymentStatusInput,
  PaymentFieldError,
} from "@/services/paymentFields";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "KASIR") {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login ulang." }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  try {
    switch (body?.action) {
      case "confirm":
        await confirmOrder(params.id, { userId });
        break;
      case "prepare":
        await advanceOrder(params.id, "DISIAPKAN", { userId });
        break;
      case "ready":
        await advanceOrder(params.id, "SIAP_DIAMBIL", { userId });
        break;
      case "complete": {
        const paymentMethod = parsePaymentMethodInput(body.paymentMethod);
        const paymentStatus = parsePaymentStatusInput(body.paymentStatus);
        await completeOrder(params.id, { userId, paymentMethod, paymentStatus });
        break;
      }
      case "reject":
        await rejectOrder(params.id, String(body.reason ?? ""), { userId });
        break;
      case "cancel":
        await cancelOrder(params.id, { userId });
        break;
      default:
        return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OrderNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof PaymentFieldError || e instanceof OrderError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Proses pesanan gagal:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}