import { Role, MemberStatus, StockMovementType, OrderStatus, PaymentMethod, PaymentStatus, SaleStatus, ImportStatus } from "@prisma/client";

export type {
  Role,
  MemberStatus,
  StockMovementType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
  ImportStatus,
};

// Session User type yang diperkaya dengan role dan memberId
export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  memberId?: string | null;
  name?: string | null;
}

// Format API Response standar untuk konsistensi seluruh tim
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}
