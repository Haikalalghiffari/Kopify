import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "KASIR") {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  const count = await db.order.count({ where: { status: "DIAJUKAN" } });
  return NextResponse.json({ count });
}