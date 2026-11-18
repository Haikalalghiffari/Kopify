import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderError } from "../orderService";

const mocks = vi.hoisted(() => {
  const mockReserve = vi.fn();
  const mockRelease = vi.fn();
  const mockCommit = vi.fn();
  const mockAudit = vi.fn();

  const mockTx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
    sale: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  return { mockTx, mockReserve, mockRelease, mockCommit, mockAudit };
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

vi.mock("@/services/p4Audit", () => ({
  auditOrderAction: (...args: unknown[]) => mocks.mockAudit(...args),
}));

vi.mock("@/services/documentNumber", () => ({
  nextDocumentNumber: vi.fn().mockResolvedValue("SLS-20261118-0001"),
}));

import {
  confirmOrder,
  completeOrder,
  createOrder,
} from "../orderService";

const staff = { userId: "user-kasir-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockTx.$queryRaw.mockResolvedValue(undefined);
  mocks.mockTx.$executeRaw.mockResolvedValue(undefined);
  mocks.mockTx.order.update.mockImplementation(({ data }: { data: { status: string } }) => ({
    id: "ord-1",
    status: data.status,
  }));
});

describe("orderService Phase 3", () => {
  it("requires staff actor id for confirmOrder", async () => {
    await expect(confirmOrder("ord-1", { userId: "" })).rejects.toThrow(/Sesi tidak valid/);
  });

  it("records audit on confirmOrder", async () => {
    mocks.mockTx.order.findUnique.mockResolvedValue({
      id: "ord-1",
      orderNo: "ORD-1",
      status: "DIAJUKAN",
      orderItems: [{ productId: "p1", qty: 1 }],
    });

    await confirmOrder("ord-1", staff);

    expect(mocks.mockAudit).toHaveBeenCalledWith(
      mocks.mockTx,
      staff.userId,
      "CONFIRM_ORDER",
      "ord-1",
      expect.objectContaining({ toStatus: "DIKONFIRMASI" })
    );
  });

  it("requires actor id for completeOrder", async () => {
    await expect(completeOrder("ord-1", { userId: "" })).rejects.toThrow(/Sesi tidak valid/);
  });

  it("persists payment fields on completion", async () => {
    mocks.mockTx.order.findUnique.mockResolvedValue({
      id: "ord-1",
      orderNo: "ORD-1",
      status: "SIAP_DIAMBIL",
      memberId: "mem-1",
      total: 10000,
      orderItems: [{ productId: "p1", qty: 1, unitPrice: 10000 }],
    });
    mocks.mockTx.sale.findUnique.mockResolvedValue(null);
    mocks.mockTx.product.findUnique.mockResolvedValue({ id: "p1", costPrice: 5000 });
    mocks.mockCommit.mockResolvedValue(undefined);
    mocks.mockTx.sale.create.mockResolvedValue({ id: "sale-1", saleNo: "SLS-1" });

    await completeOrder("ord-1", {
      userId: staff.userId,
      paymentMethod: "TRANSFER",
      paymentStatus: "BELUM_LUNAS",
    });

    expect(mocks.mockTx.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: "TRANSFER",
          paymentStatus: "BELUM_LUNAS",
          createdBy: staff.userId,
        }),
      })
    );
    expect(mocks.mockCommit).toHaveBeenCalledWith(
      { orderId: "ord-1", userId: staff.userId },
      mocks.mockTx
    );
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      mocks.mockTx,
      staff.userId,
      "COMPLETE_ORDER",
      "ord-1",
      expect.objectContaining({
        paymentMethod: "TRANSFER",
        paymentStatus: "BELUM_LUNAS",
      })
    );
  });

  it("audits order creation", async () => {
    mocks.mockTx.product.findMany.mockResolvedValue([
      { id: "p1", name: "Kopi", stock: 10, reservedStock: 0, sellPrice: 10000 },
    ]);
    mocks.mockTx.order.create.mockResolvedValue({
      id: "ord-new",
      orderNo: "ORD-X",
      total: 10000,
      orderItems: [{ productId: "p1", qty: 1 }],
    });

    await createOrder({
      memberId: "mem-1",
      items: [{ productId: "p1", qty: 1 }],
      createdBy: staff.userId,
    });

    expect(mocks.mockAudit).toHaveBeenCalledWith(
      mocks.mockTx,
      staff.userId,
      "CREATE_ORDER",
      "ord-new",
      expect.objectContaining({ orderNo: "ORD-X" })
    );
  });
});