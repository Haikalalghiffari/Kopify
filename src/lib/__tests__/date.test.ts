import { describe, it, expect } from "vitest";
import {
  startOfDayWIB,
  endOfDayWIB,
  startOfWeekWIB,
  startOfMonthWIB,
  startOfYearWIB,
  formatDateWIB,
} from "../date";

describe("Date Utility (P1) - Asia/Jakarta (WIB = UTC+7)", () => {
  it("startOfDayWIB menghasilkan waktu 00:00:00.000 WIB (17:00:00 UTC hari sebelumnya)", () => {
    // 2026-11-16 10:00:00 UTC (17:00:00 WIB)
    const testDate = new Date("2026-11-16T10:00:00.000Z");
    const start = startOfDayWIB(testDate);

    // 00:00 WIB pada 16 Nov 2026 adalah 15 Nov 2026 17:00:00 UTC
    expect(start.toISOString()).toBe("2026-11-15T17:00:00.000Z");
  });

  it("endOfDayWIB menghasilkan waktu 23:59:59.999 WIB (16:59:59.999 UTC)", () => {
    const testDate = new Date("2026-11-16T10:00:00.000Z");
    const end = endOfDayWIB(testDate);

    // 23:59:59.999 WIB pada 16 Nov 2026 adalah 16 Nov 2026 16:59:59.999 UTC
    expect(end.toISOString()).toBe("2026-11-16T16:59:59.999Z");
  });

  it("startOfWeekWIB menghasilkan Senin 00:00:00 WIB untuk pekan berjalan", () => {
    // 2026-11-18 (Rabu) 05:00 UTC (12:00 WIB)
    const wednesday = new Date("2026-11-18T05:00:00.000Z");
    const startWeek = startOfWeekWIB(wednesday);

    // Senin pekan itu adalah 16 Nov 2026 pukul 00:00:00 WIB (15 Nov 2026 17:00:00 UTC)
    expect(startWeek.toISOString()).toBe("2026-11-15T17:00:00.000Z");

    // Jika input hari Minggu 22 Nov 2026, awal pekan tetap Senin 16 Nov 2026
    const sunday = new Date("2026-11-22T05:00:00.000Z");
    const startWeekSunday = startOfWeekWIB(sunday);
    expect(startWeekSunday.toISOString()).toBe("2026-11-15T17:00:00.000Z");
  });

  it("startOfMonthWIB menghasilkan tanggal 1 bulan berjalan 00:00:00 WIB", () => {
    const testDate = new Date("2026-11-16T10:00:00.000Z");
    const startMonth = startOfMonthWIB(testDate);

    // 1 Nov 2026 00:00:00 WIB adalah 31 Okt 2026 17:00:00 UTC
    expect(startMonth.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  it("startOfYearWIB menghasilkan 1 Januari tahun berjalan 00:00:00 WIB", () => {
    const testDate = new Date("2026-11-16T10:00:00.000Z");
    const startYear = startOfYearWIB(testDate);

    // 1 Jan 2026 00:00:00 WIB adalah 31 Des 2025 17:00:00 UTC
    expect(startYear.toISOString()).toBe("2025-12-31T17:00:00.000Z");
  });

  it("formatDateWIB memformat tanggal sesuai zona waktu Indonesia", () => {
    // 2026-11-16 02:00 UTC = 09:00 WIB
    const testDate = new Date("2026-11-16T02:00:00.000Z");
    const formatted = formatDateWIB(testDate);
    expect(formatted).toContain("16");
    expect(formatted).toContain("November");
    expect(formatted).toContain("2026");
  });
});
