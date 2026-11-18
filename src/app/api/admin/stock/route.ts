import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePagination } from "@/lib/pagination";
import { stockService } from "@/services/stockService";

const stockActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RECEIVE"),
    productId: z.string().min(1),
    qty: z.number().int().positive().max(2_147_483_647),
    refId: z.string().trim().max(100).optional(),
    note: z.string().trim().min(1, "Alasan barang masuk wajib diisi").max(500),
  }),
  z.object({
    action: z.literal("OPNAME"),
    productId: z.string().min(1),
    actualStock: z.number().int().min(0).max(2_147_483_647),
    note: z.string().trim().min(1, "Alasan opname wajib diisi").max(500),
  }),
]);

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ message: "Silakan login kembali." }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "KASIR") {
    return { response: NextResponse.json({ message: "Anda tidak memiliki izin." }, { status: 403 }) };
  }
  return { user: session.user };
}

async function readJson(request: Request): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ message: "Format request tidak valid." }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip, take } = normalizePagination({
    page: Number.parseInt(searchParams.get("page") ?? "", 10) || 1,
    pageSize: Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 10,
  });

  const [movements, totalItems, products] = await Promise.all([
    db.stockMovement.findMany({
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            stock: true,
            reservedStock: true,
            minStock: true,
            unit: { select: { name: true } },
          },
        },
        user: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    db.stockMovement.count(),
    db.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        reservedStock: true,
        minStock: true,
        unit: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    data: movements,
    products,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      hasNextPage: page * pageSize < totalItems,
      hasPrevPage: page > 1,
    },
  });
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;

  const parsed = stockActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data pergerakan stok tidak valid." },
      { status: 400 }
    );
  }

  try {
    const result = parsed.data.action === "RECEIVE"
      ? await stockService.receiveStock({
          productId: parsed.data.productId,
          qty: parsed.data.qty,
          refId: parsed.data.refId,
          note: parsed.data.note,
          userId: authorization.user.id,
        })
      : await stockService.stockOpname({
          productId: parsed.data.productId,
          actualStock: parsed.data.actualStock,
          note: parsed.data.note,
          userId: authorization.user.id,
        });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ message: "Barang tidak ditemukan." }, { status: 404 });
      }
      console.error("Gagal menyimpan pergerakan stok:", error);
      return NextResponse.json({ message: "Gagal menyimpan perubahan stok." }, { status: 500 });
    }

    if (error instanceof Error) {
      const status = error.message.includes("tidak ditemukan") ? 404 : 409;
      return NextResponse.json({ message: error.message }, { status });
    }

    console.error("Gagal menyimpan pergerakan stok:", error);
    return NextResponse.json({ message: "Gagal menyimpan perubahan stok." }, { status: 500 });
  }
}
