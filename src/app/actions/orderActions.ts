"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createOrder,
  updateOrderStatus,
  cancelMemberOrder,
  CreateOrderItemInput,
} from "@/services/orderService";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";

export async function submitOrderAction(input: {
  items: CreateOrderItemInput[];
  note?: string;
}) {
  const session = await auth();
  if (!session || !session.user) {
    return { success: false, error: "Harap masuk (login) terlebih dahulu." };
  }

  const userId = (session.user as any).id;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { member: true },
  });

  if (!user) {
    return { success: false, error: "Data pengguna tidak ditemukan." };
  }

  // If user is Anggota, memberId is linked. If Admin, find or fallback to memberId
  const memberId = user.memberId || (await db.member.findFirst())?.id;
  if (!memberId) {
    return {
      success: false,
      error: "Akun Anda belum ditautkan ke data keanggotaan koperasi.",
    };
  }

  try {
    const order = await createOrder({
      memberId,
      createdById: userId,
      items: input.items,
      note: input.note,
    });

    revalidatePath("/member/my-orders");
    revalidatePath("/member/cart");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");

    return { success: true, orderId: order.id, orderNo: order.orderNo };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memproses pesanan." };
  }
}

export async function cancelMemberOrderAction(orderId: string) {
  const session = await auth();
  if (!session || !session.user) {
    return { success: false, error: "Harap login terlebih dahulu." };
  }

  const userId = (session.user as any).id;
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.memberId) {
    return { success: false, error: "Hanya anggota yang dapat membatalkan pesanannya." };
  }

  try {
    await cancelMemberOrder(orderId, user.memberId, userId);
    revalidatePath("/member/my-orders");
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal membatalkan pesanan." };
  }
}

export async function updateOrderStatusAction({
  orderId,
  newStatus,
  rejectReason,
  paymentMethod,
  paymentStatus,
}: {
  orderId: string;
  newStatus: OrderStatus;
  rejectReason?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
}) {
  const session = await auth();
  if (!session || !session.user) {
    return { success: false, error: "Akses ditolak. Harap login." };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "KASIR") {
    return { success: false, error: "Hanya Admin dan Kasir yang dapat memproses pesanan." };
  }

  const userId = (session.user as any).id;

  try {
    await updateOrderStatus({
      orderId,
      newStatus,
      userId,
      rejectReason,
      paymentMethod,
      paymentStatus,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/stock");
    revalidatePath("/admin/dashboard");
    revalidatePath("/member/my-orders");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memperbarui status pesanan." };
  }
}

export async function createManualOrderAction({
  memberId,
  items,
  note,
}: {
  memberId: string;
  items: CreateOrderItemInput[];
  note?: string;
}) {
  const session = await auth();
  if (!session || !session.user) {
    return { success: false, error: "Akses ditolak." };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "KASIR") {
    return { success: false, error: "Hanya staf yang dapat membuat pesanan manual." };
  }

  const userId = (session.user as any).id;

  try {
    const order = await createOrder({
      memberId,
      createdById: userId,
      items,
      note,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");
    return { success: true, order };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal membuat pesanan manual." };
  }
}
