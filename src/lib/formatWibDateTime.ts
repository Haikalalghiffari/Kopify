import { TIMEZONE_WIB } from "@/lib/date";

export function formatWibDateTime(d: Date | string | number): string {
  return new Date(d).toLocaleString("id-ID", {
    timeZone: TIMEZONE_WIB,
    dateStyle: "medium",
    timeStyle: "short",
  });
}