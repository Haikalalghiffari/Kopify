"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createDirectSale, CreateSaleItemInput } from "@/services/saleService";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export async function processDirectSaleAction(input: {
  memberId?: string | null;
  items: CreateSaleItemInput[];
  discount?: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
}) {
  const session = await auth();
  if (!session || !session.user) {
    return { success: false, error: "Akses ditolak. Harap login." };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "KASIR") {
    return { success: false, error: "Hanya Admin dan Kasir yang dapat memproses transaksi kasir." };
  }

  const userId = (session.user as any).id;

  try {
    const sale = await createDirectSale({
      memberId: input.memberId || null,
      items: input.items,
      discount: input.discount || 0,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus || PaymentStatus.LUNAS,
      createdById: userId,
    });

    revalidatePath("/admin/sales");
    revalidatePath("/admin/stock");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/products");

    return { success: true, sale };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memproses transaksi kasir." };
  }
}
