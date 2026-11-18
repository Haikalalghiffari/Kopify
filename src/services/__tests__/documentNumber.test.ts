import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextDocumentNumber, wibYmdCompact } from "../documentNumber";

const mockTx = {
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.$executeRaw.mockResolvedValue(undefined);
});

describe("documentNumber", () => {
  it("formats WIB calendar date as YYYYMMDD", () => {
    expect(wibYmdCompact(new Date("2026-11-18T10:00:00.000Z"))).toBe("20261118");
  });

  it("uses Asia/Jakarta, not UTC, at the day boundary", () => {
    // 18:00 UTC on 18 Nov == 01:00 WIB on 19 Nov
    expect(wibYmdCompact(new Date("2026-11-18T18:00:00.000Z"))).toBe("20261119");
    // 16:59 UTC on 18 Nov == 23:59 WIB on 18 Nov
    expect(wibYmdCompact(new Date("2026-11-18T16:59:00.000Z"))).toBe("20261118");
  });

  it("acquires the advisory lock before reading the max sequence (ORD)", async () => {
    const order: string[] = [];
    mockTx.$executeRaw.mockImplementation(async () => {
      order.push("lock");
    });
    mockTx.$queryRaw.mockImplementation(async () => {
      order.push("read");
      return [{ max_seq: 3 }];
    });
    const no = await nextDocumentNumber(mockTx as never, "ORD");
    expect(order).toEqual(["lock", "read"]);
    expect(no).toMatch(/^ORD-\d{8}-0004$/);
  });

  it("uses the same lock pattern for SLS numbers", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ max_seq: 0 }]);
    const no = await nextDocumentNumber(mockTx as never, "SLS");
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(no).toMatch(/^SLS-\d{8}-0001$/);
  });

  it("continues after the highest used number when there are gaps", async () => {
    // e.g. 0001, 0003, 0007 exist (0002 etc. were deleted) -> next must be 0008, not count+1
    mockTx.$queryRaw.mockResolvedValue([{ max_seq: 7 }]);
    expect(await nextDocumentNumber(mockTx as never, "ORD")).toMatch(/-0008$/);
  });

  it("does not truncate sequences beyond 9999", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ max_seq: 9999 }]);
    expect(await nextDocumentNumber(mockTx as never, "SLS")).toMatch(/-10000$/);
  });

  it("starts at 0001 when no rows exist or the query returns nothing", async () => {
    mockTx.$queryRaw.mockResolvedValue([]);
    expect(await nextDocumentNumber(mockTx as never, "ORD")).toMatch(/-0001$/);
  });
});