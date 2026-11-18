import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderError } from "../orderService";

const mocks = vi.hoisted(() => {
  const mockReserve = vi.fn();
  const mockRelease = vi.fn();
  const mockCommit = vi.fn();

  const mockTx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    sale: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    product: {
      findUnique: vi.fn(),
    },
  };

  return { mockTx, mockReserve, mockRelease, mockCommit };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mocks.mockTx) => unknown) => fn(mocks.mockTx)),
  },
}));

vi.mock("@/services/stockService", () => ({
  stockService: {
    reserve: mocks.mockReserve,
    release: mocks.mockRelease,
    commitReservation: mocks.mockCommit,
  },
}));

vi.mock("@/services/documentNumber", () => ({
  nextDocumentNumber: vi.fn().mockResolvedValue("SLS-20261118-0001"),
}));

vi.mock("@/services/p4Audit", () => ({
  auditOrderAction: vi.fn(),
}));

const staff = { userId: "kasir-1" };

import {
  confirmOrder,
  rejectOrder,
  cancelOrder,
  completeOrder,
} from "../orderService";

const orderId = "ord-1";
const memberId = "mem-1";

function stubOrder(
  status: "DIAJUKAN" | "DIKONFIRMASI" | "SIAP_DIAMBIL",
  items = [{ productId: "p1", qty: 2, unitPrice: 10000 }]
) {
  return {
    id: orderId,
    orderNo: "ORD-TEST-0001",
    status,
    memberId,
    total: 20000,
    orderItems: items,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockTx.$queryRaw.mockResolvedValue(undefined);
  mocks.mockTx.order.update.mockImplementation(({ data }: { data: { status: string } }) => ({
    id: orderId,
    status: data.status,
  }));
});

describe("orderService stock integration (unit)", () => {
  describe("confirmOrder", () => {
    it("reserves each line via stockService on DIAJUKAN → DIKONFIRMASI", async () => {
      const order = stubOrder("DIAJUKAN", [
        { productId: "p2", qty: 1, unitPrice: 5000 },
        { productId: "p1", qty: 2, unitPrice: 10000 },
      ]);
      mocks.mockTx.order.findUnique.mockResolvedValue(order);

      await confirmOrder(orderId, staff);

      expect(mocks.mockReserve).toHaveBeenCalledTimes(2);
      expect(mocks.mockReserve).toHaveBeenNthCalledWith(
        1,
        { productId: "p1", qty: 2, orderId },
        mocks.mockTx
      );
      expect(mocks.mockReserve).toHaveBeenNthCalledWith(
        2,
        { productId: "p2", qty: 1, orderId },
        mocks.mockTx
      );
      expect(mocks.mockTx.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: "DIKONFIRMASI" },
      });
    });

    it("does not update status when reserve fails (transaction rollback path)", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIAJUKAN"));
      mocks.mockReserve.mockRejectedValueOnce(new Error("Stok tersedia tidak cukup"));

      await expect(confirmOrder(orderId, staff)).rejects.toThrow(OrderError);
      expect(mocks.mockTx.order.update).not.toHaveBeenCalled();
    });

    it("rejects duplicate transition away from DIAJUKAN", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIKONFIRMASI"));

      await expect(confirmOrder(orderId, staff)).rejects.toThrow(/Status tidak bisa diubah/);
      expect(mocks.mockReserve).not.toHaveBeenCalled();
    });
  });

  describe("rejectOrder / cancelOrder release", () => {
    it("releases reservations when rejecting DIKONFIRMASI order", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIKONFIRMASI"));

      await rejectOrder(orderId, "stok habis", staff);

      expect(mocks.mockRelease).toHaveBeenCalledWith(
        { productId: "p1", qty: 2, orderId },
        mocks.mockTx
      );
      expect(mocks.mockTx.order.update).toHaveBeenCalled();
    });

    it("does not release when rejecting DIAJUKAN (no reservation yet)", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIAJUKAN"));

      await rejectOrder(orderId, "tidak jadi", staff);

      expect(mocks.mockRelease).not.toHaveBeenCalled();
    });

    it("releases on kasir cancel from DIKONFIRMASI", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIKONFIRMASI"));

      await cancelOrder(orderId, { userId: staff.userId });

      expect(mocks.mockRelease).toHaveBeenCalled();
    });

    it("enforces member ownership and DIAJUKAN-only member cancel", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIKONFIRMASI"));

      await expect(cancelOrder(orderId, { memberId: "other" })).rejects.toThrow(
        "Pesanan tidak ditemukan."
      );

      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIKONFIRMASI", []));

      await expect(cancelOrder(orderId, { memberId })).rejects.toThrow(
        "Pesanan hanya bisa dibatalkan saat masih berstatus DIAJUKAN."
      );
      expect(mocks.mockRelease).not.toHaveBeenCalled();
    });

    it("does not update order when release fails", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("DIKONFIRMASI"));
      mocks.mockRelease.mockRejectedValueOnce(new Error("Reservasi tidak cukup"));

      await expect(cancelOrder(orderId)).rejects.toThrow(OrderError);
      expect(mocks.mockTx.order.update).not.toHaveBeenCalled();
    });
  });

  describe("completeOrder", () => {
    it("commits reservation then creates sale with cost snapshot", async () => {
      const order = stubOrder("SIAP_DIAMBIL");
      mocks.mockTx.order.findUnique.mockResolvedValue(order);
      mocks.mockTx.sale.findUnique.mockResolvedValue(null);
      mocks.mockTx.product.findUnique.mockResolvedValue({ id: "p1", costPrice: 7500 });
      mocks.mockCommit.mockResolvedValue(undefined);
      mocks.mockTx.sale.create.mockResolvedValue({ id: "sale-1" });

      await completeOrder(orderId, { userId: "kasir-1" });

      expect(mocks.mockCommit).toHaveBeenCalledWith(
        { orderId, userId: "kasir-1" },
        mocks.mockTx
      );
      expect(mocks.mockTx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId,
            saleItems: {
              create: [{ productId: "p1", qty: 2, unitPrice: 10000, costPrice: 7500 }],
            },
          }),
        })
      );
      expect(mocks.mockTx.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: "SELESAI" },
      });
    });

    it("prevents duplicate sale for same order", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("SIAP_DIAMBIL"));
      mocks.mockTx.sale.findUnique.mockResolvedValue({ id: "existing" });

      await expect(completeOrder(orderId, { userId: staff.userId })).rejects.toThrow(
        "Penjualan untuk pesanan ini sudah ada."
      );
      expect(mocks.mockCommit).not.toHaveBeenCalled();
    });

    it("does not create sale when commitReservation fails", async () => {
      mocks.mockTx.order.findUnique.mockResolvedValue(stubOrder("SIAP_DIAMBIL"));
      mocks.mockTx.sale.findUnique.mockResolvedValue(null);
      mocks.mockCommit.mockRejectedValueOnce(new Error("Tidak ada reservasi aktif"));

      await expect(completeOrder(orderId, { userId: staff.userId })).rejects.toThrow(OrderError);
      expect(mocks.mockTx.sale.create).not.toHaveBeenCalled();
      expect(mocks.mockTx.order.update).not.toHaveBeenCalled();
    });
  });
});