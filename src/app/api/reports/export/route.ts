import { NextRequest, NextResponse } from "next/server";
import { generateReportExcel } from "@/services/reportService";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "HARIAN").toUpperCase();
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());
  const week = searchParams.get("week") ? parseInt(searchParams.get("week")!) : undefined;

  const buffer = await generateReportExcel(type, { date, year, month, week });
  const filename = `Laporan_Kopify_${type}_${date}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
