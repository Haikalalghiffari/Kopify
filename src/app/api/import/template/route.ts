import { NextRequest, NextResponse } from "next/server";
import { generateExcelTemplate } from "@/services/importService";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "BARANG").toUpperCase() as "ANGGOTA" | "BARANG";

  const buffer = await generateExcelTemplate(type);

  const filename = type === "ANGGOTA" ? "Template_Import_Anggota_Kopify.xlsx" : "Template_Import_Barang_Kopify.xlsx";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
