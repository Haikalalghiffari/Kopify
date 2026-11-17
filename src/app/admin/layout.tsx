import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/layout/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role;
  if (role === "ANGGOTA") redirect("/member/catalog");

  return (
    <div className="flex h-screen bg-gray-50 print:h-auto print:block print:bg-white">
      <aside className="w-64 hidden md:flex flex-col flex-shrink-0 print:hidden">
        <AdminSidebar />
      </aside>
      <main className="flex-1 overflow-auto print:overflow-visible print:h-auto print:p-0">
        <div className="p-6 print:p-0">{children}</div>
      </main>
    </div>
  );
}
