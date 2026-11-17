import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { id } from "date-fns/locale";

export const TIMEZONE = "Asia/Jakarta";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMMM yyyy", { locale: id });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMMM yyyy HH:mm", { locale: id });
}

export function getDayRange(date: Date) {
  return { start: startOfDay(date), end: endOfDay(date) };
}

export function getWeekRange(date: Date) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getMonthRange(date: Date) {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function getYearRange(date: Date) {
  return { start: startOfYear(date), end: endOfYear(date) };
}
