import {
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getYearlyReport,
  getStockValuationReport,
} from "@/services/reportService";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: paramDate } = await searchParams;
  const todayStr = paramDate || new Date().toISOString().split("T")[0];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Approximate current week number
  const startOfYear = new Date(year, 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );

  const [daily, weekly, monthly, yearly, stockValuation] = await Promise.all([
    getDailyReport(todayStr),
    getWeeklyReport(year, weekNumber),
    getMonthlyReport(year, month),
    getYearlyReport(year),
    getStockValuationReport(),
  ]);

  return (
    <ReportsClient
      initialDaily={daily}
      initialWeekly={weekly}
      initialMonthly={monthly}
      initialYearly={yearly}
      initialStockValuation={stockValuation}
    />
  );
}
