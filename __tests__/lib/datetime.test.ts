import { toDatetimeLocal, fromDatetimeLocal, toDateInput, fromDateInput, isScheduledAhead } from '@/lib/datetime';

describe('toDateInput / fromDateInput', () => {
  it('feeds an <input type="date"> from a timestamptz', () => {
    expect(toDateInput('2026-10-08T00:00:00+00:00')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('leaves a plain `date` column untouched (no timezone shift)', () => {
    expect(toDateInput('2026-10-08')).toBe('2026-10-08');
  });

  it('never produces an empty string for the payload — empty means null', () => {
    expect(fromDateInput('')).toBeNull();
    expect(fromDateInput(null)).toBeNull();
    expect(fromDateInput(undefined)).toBeNull();
  });

  it('round-trips a picked day without drifting to the day before', () => {
    expect(toDateInput(fromDateInput('2026-10-08'))).toBe('2026-10-08');
  });
});

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
