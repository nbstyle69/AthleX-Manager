import { toDatetimeLocal, fromDatetimeLocal, isScheduledAhead } from '@/lib/datetime';

describe('toDatetimeLocal', () => {
  it('converts a Postgres timestamptz to the datetime-local format', () => {
    const out = toDatetimeLocal('2026-08-12T12:23:00+00:00');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(out).getTime()).toBe(new Date('2026-08-12T12:23:00+00:00').getTime());
  });

  it('returns an empty string for null/undefined/invalid values', () => {
    expect(toDatetimeLocal(null)).toBe('');
    expect(toDatetimeLocal(undefined)).toBe('');
    expect(toDatetimeLocal('pas une date')).toBe('');
  });
});

describe('fromDatetimeLocal', () => {
  it('reads the input as local time, not UTC', () => {
    const local = '2026-08-12T14:23';
    expect(fromDatetimeLocal(local)).toBe(new Date(local).toISOString());
  });

  it('round-trips through toDatetimeLocal without drift', () => {
    const stored = '2026-08-12T12:23:00+00:00';
    const back = fromDatetimeLocal(toDatetimeLocal(stored));
    expect(new Date(back as string).getTime()).toBe(new Date(stored).getTime());
  });

  it('maps an empty field to null (clears the column)', () => {
    expect(fromDatetimeLocal('')).toBeNull();
    expect(fromDatetimeLocal(null)).toBeNull();
  });
});

describe('isScheduledAhead', () => {
  const now = new Date('2026-08-10T10:55:00Z').getTime();

  it('is true only for a future opening', () => {
    expect(isScheduledAhead('2026-08-12T12:23:00+00:00', now)).toBe(true);
    expect(isScheduledAhead('2026-08-09T12:23:00+00:00', now)).toBe(false);
    expect(isScheduledAhead(null, now)).toBe(false);
  });
});
