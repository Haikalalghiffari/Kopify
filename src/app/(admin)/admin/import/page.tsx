import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/import/ImportWizard";
import { ImportHistoryPanel } from "@/components/import/ImportHistoryPanel";

export default async function AdminImportPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <>
      <ImportWizard />
      <ImportHistoryPanel />
    </>
  );
}