import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  class OrderError extends Error {}
  class OrderNotFoundError extends OrderError {
    constructor() {
      super("Pesanan tidak ditemukan.");
    }
  }
  return {
    getServerSession: vi.fn(),
    completeOrder: vi.fn(),
    confirmOrder: vi.fn(),
    OrderError,
    OrderNotFoundError,
  };
});

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/services/orderService", () => ({
  confirmOrder: mocks.confirmOrder,
  advanceOrder: vi.fn(),
  completeOrder: mocks.completeOrder,
  rejectOrder: vi.fn(),
  cancelOrder: vi.fn(),
  OrderError: mocks.OrderError,
  OrderNotFoundError: mocks.OrderNotFoundError,
}));

import { PATCH } from "../[id]/route";

function req(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/orders/[id] authorization", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await PATCH(req({ action: "confirm" }), { params: { id: "ord-1" } });
    expect(res.status).toBe(401);
    expect(mocks.confirmOrder).not.toHaveBeenCalled();
  });

  it("returns 403 for non-staff roles", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "u1", role: "ANGGOTA" },
    });

    const res = await PATCH(req({ action: "confirm" }), { params: { id: "ord-1" } });

    expect(res.status).toBe(403);
    expect(mocks.completeOrder).not.toHaveBeenCalled();
  });

  it("returns 401 when the session has no user id", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { role: "KASIR" } });
    const res = await PATCH(req({ action: "confirm" }), { params: { id: "ord-1" } });
    expect(res.status).toBe(401);
    expect(mocks.confirmOrder).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown action and invalid payment enums", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "k1", role: "KASIR" } });
    expect((await PATCH(req({ action: "nuke" }), { params: { id: "o" } })).status).toBe(400);
    expect(
      (
        await PATCH(req({ action: "complete", paymentMethod: "CRYPTO" }), {
          params: { id: "o" },
        })
      ).status
    ).toBe(400);
    expect(mocks.completeOrder).not.toHaveBeenCalled();
  });

  it("returns 404 when the order does not exist", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "k1", role: "KASIR" } });
    mocks.confirmOrder.mockRejectedValue(new mocks.OrderNotFoundError());
    const res = await PATCH(req({ action: "confirm" }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("forwards payment fields on complete for kasir", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "kasir-1", role: "KASIR" },
    });
    mocks.completeOrder.mockResolvedValue({});

    const res = await PATCH(
      req({ action: "complete", paymentMethod: "TRANSFER", paymentStatus: "LUNAS" }),
      { params: { id: "ord-1" } }
    );

    expect(res.status).toBe(200);
    expect(mocks.completeOrder).toHaveBeenCalledWith("ord-1", {
      userId: "kasir-1",
      paymentMethod: "TRANSFER",
      paymentStatus: "LUNAS",
    });
  });
});