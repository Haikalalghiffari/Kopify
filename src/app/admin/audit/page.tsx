import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import AuditClient from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; action?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role;
  if (role !== "ADMIN") redirect("/admin/dashboard");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const perPage = 50;
  const entityFilter = params.entity || "";
  const actionFilter = params.action || "";
  const search = params.q || "";

  const where: any = {};
  if (entityFilter) where.entity = entityFilter;
  if (actionFilter) where.action = actionFilter;
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entity: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { user: { username: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { username: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.auditLog.count({ where }),
  ]);

  // Distinct values for filters
  const distinctEntities = await db.auditLog.findMany({
    select: { entity: true },
    distinct: ["entity"],
    orderBy: { entity: "asc" },
  });
  const distinctActions = await db.auditLog.findMany({
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
  });

  return (
    <AuditClient
      logs={JSON.parse(JSON.stringify(logs))}
      total={total}
      page={page}
      perPage={perPage}
      entities={distinctEntities.map((e) => e.entity)}
      actions={distinctActions.map((a) => a.action)}
      filters={{ entity: entityFilter, action: actionFilter, q: search }}
    />
  );
}
