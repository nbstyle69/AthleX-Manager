/**
 * Conversions between a Postgres `timestamptz` and the value format expected by
 * an `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`, always local time).
 *
 * The browser silently renders an empty field when the value is not in that
 * exact format, and a raw local string sent to a `timestamptz` column is read
 * as UTC by Postgres.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function isScheduledAhead(value: string | null | undefined, now: number = Date.now()): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t > now;
}
