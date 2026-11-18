import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSale, SaleError } from "@/services/saleService";
import {
  parsePaymentMethodInput,
  parsePaymentStatusInput,
  PaymentFieldError,
} from "@/services/paymentFields";

export async function POST(req: Request) {
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

  // Bentuk setiap baris diperiksa SEBELUM sampai ke service (pola sama dengan POST /api/orders):
  // elemen null/primitif/array atau productId bukan string tidak boleh memicu TypeError / galat SQL
  // (-> 500). Aturan qty/stok/diskon/BON tetap di service. items non-array tetap diperlakukan
  // sebagai keranjang kosong (400 dari service).
  const isValidLine = (i: unknown): boolean =>
    typeof i === "object" &&
    i !== null &&
    !Array.isArray(i) &&
    typeof (i as { productId?: unknown }).productId === "string" &&
    (i as { productId: string }).productId.trim() !== "";

  const items: unknown[] = Array.isArray(body?.items) ? body.items : [];
  if (!items.every(isValidLine)) {
    return NextResponse.json({ error: "Data keranjang tidak valid." }, { status: 400 });
  }

  try {
    const paymentMethod = parsePaymentMethodInput(body?.paymentMethod);
    const paymentStatus = parsePaymentStatusInput(body?.paymentStatus);
    const sale = await createSale({
      items: items as { productId: string; qty: number }[],
      memberId: body?.memberId || null,
      discount: Number(body?.discount ?? 0),
      paymentMethod,
      paymentStatus,
      createdBy: userId,
    });
    return NextResponse.json(sale, { status: 201 });
  } catch (e) {
    if (e instanceof PaymentFieldError || e instanceof SaleError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Penjualan gagal:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}