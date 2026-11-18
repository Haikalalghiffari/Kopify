import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function auditOrderAction(
  tx: Tx,
  userId: string | null | undefined,
  action: string,
  orderId: string,
  detail: Prisma.InputJsonValue
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: userId ?? null,
      action,
      entity: "Order",
      entityId: orderId,
      detailJson: detail,
    },
  });
}

export async function auditSaleAction(
  tx: Tx,
  userId: string | null | undefined,
  action: string,
  saleId: string,
  detail: Prisma.InputJsonValue
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: userId ?? null,
      action,
      entity: "Sale",
      entityId: saleId,
      detailJson: detail,
    },
  });
}