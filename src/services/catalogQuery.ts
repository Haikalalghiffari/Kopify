import { Prisma } from "@prisma/client";

export type CatalogSearchParams = {
  q?: string;
  categoryId?: string;
};

export function buildCatalogProductWhere(params: CatalogSearchParams): Prisma.ProductWhereInput {
  const q = params.q?.trim();
  const categoryId = params.categoryId?.trim();

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}