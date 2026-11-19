import type { UserRole } from "@/lib/rbac";

export function canMemberAccessOrder(
  orderMemberId: string,
  sessionMemberId: string | null | undefined
): boolean {
  return Boolean(sessionMemberId) && orderMemberId === sessionMemberId;
}

export function canAccessSaleReceipt(opts: {
  role: UserRole | undefined | null;
  sessionMemberId?: string | null;
  saleMemberId?: string | null;
  orderMemberId?: string | null;
}): boolean {
  if (opts.role === "ADMIN" || opts.role === "KASIR") {
    return true;
  }
  if (opts.role === "ANGGOTA" && opts.sessionMemberId) {
    if (opts.saleMemberId && opts.saleMemberId === opts.sessionMemberId) {
      return true;
    }
    if (opts.orderMemberId && opts.orderMemberId === opts.sessionMemberId) {
      return true;
    }
  }
  return false;
}