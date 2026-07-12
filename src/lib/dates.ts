/** Weeks run Monday → Sunday (ISO). The family shops on the weekend for the
 *  week starting the following Monday. All dates are YYYY-MM-DD strings. */

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function mondayOf(dateStr: string): string {
  const d = parseDate(dateStr);
  const diff = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - diff);
  return toDateString(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isWeekday(dateStr: string): boolean {
  const day = parseDate(dateStr).getDay();
  return day >= 1 && day <= 5;
}

export function todayString(): string {
  return toDateString(new Date());
}
