import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if ((session.user as any)?.role === "ANGGOTA") {
    redirect("/member/catalog");
  }
  redirect("/admin/dashboard");
}
