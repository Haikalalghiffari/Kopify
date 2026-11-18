import { describe, it, expect } from "vitest";
import { canMemberAccessOrder, canAccessSaleReceipt } from "../receiptAccess";

describe("receiptAccess", () => {
  it("allows member only on own order", () => {
    expect(canMemberAccessOrder("mem-a", "mem-a")).toBe(true);
    expect(canMemberAccessOrder("mem-a", "mem-b")).toBe(false);
    expect(canMemberAccessOrder("mem-a", null)).toBe(false);
  });

  it("allows staff on any sale", () => {
    expect(
      canAccessSaleReceipt({
        role: "KASIR",
        sessionMemberId: null,
        saleMemberId: "x",
        orderMemberId: "y",
      })
    ).toBe(true);
  });

  it("denies cross-member sale access", () => {
    expect(
      canAccessSaleReceipt({
        role: "ANGGOTA",
        sessionMemberId: "mem-a",
        saleMemberId: "mem-b",
        orderMemberId: undefined,
      })
    ).toBe(false);
  });

  it("allows member sale linked via order", () => {
    expect(
      canAccessSaleReceipt({
        role: "ANGGOTA",
        sessionMemberId: "mem-a",
        saleMemberId: null,
        orderMemberId: "mem-a",
      })
    ).toBe(true);
  });
});