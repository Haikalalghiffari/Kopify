import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrder, OrderError } from "@/services/orderService";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const role = session.user.role;
  const userId = session.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  // Bentuk setiap baris diperiksa SEBELUM dipetakan: elemen null/primitif/array tidak boleh
  // sampai ke `i.productId` (TypeError di luar try -> 500). Aturan jumlah/stok tetap di service.
  const isValidLine = (i: unknown): boolean =>
    typeof i === "object" &&
    i !== null &&
    !Array.isArray(i) &&
    typeof (i as { productId?: unknown }).productId === "string" &&
    (i as { productId: string }).productId.trim() !== "";

  if (!Array.isArray(body?.items) || !body.items.every(isValidLine)) {
    return NextResponse.json({ error: "Data keranjang tidak valid." }, { status: 400 });
  }

  let memberId: string | undefined;
  let createdBy: string | undefined;

  if (role === "ADMIN" || role === "KASIR") {
    // Kasir/admin memesan atas nama anggota (FR-5.9)
    memberId = body?.memberId ? String(body.memberId) : undefined;
    if (!memberId) {
      return NextResponse.json({ error: "Pilih anggota terlebih dahulu." }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login ulang." }, { status: 401 });
    }
    createdBy = userId;
  } else {
    // Anggota: selalu atas nama dirinya sendiri, body.memberId diabaikan
    memberId = session.user.memberId ?? undefined;
    if (!memberId) {
      return NextResponse.json({ error: "Akun ini bukan akun anggota." }, { status: 403 });
    }
  }

  // Hanya productId dan qty yang dipercaya dari browser. Harga selalu dibaca dari database.
  const items = body.items.map((i: any) => ({
    productId: String(i.productId),
    qty: Number(i.qty),
  }));

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;

  try {
    const order = await createOrder({
      memberId,
      items,
      note,
      createdBy: createdBy ?? userId,
    });
    return NextResponse.json({ orderNo: order.orderNo, total: order.total }, { status: 201 });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Buat pesanan gagal:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}