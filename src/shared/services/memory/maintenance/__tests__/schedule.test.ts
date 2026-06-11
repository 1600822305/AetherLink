import { describe, it, expect } from 'vitest';
import { isMaintenanceDue } from '../schedule';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('isMaintenanceDue', () => {
  const now = Date.parse('2026-06-11T00:00:00.000Z');

  it('is due when never maintained', () => {
    expect(isMaintenanceDue(undefined, 7, now)).toBe(true);
    expect(isMaintenanceDue('', 7, now)).toBe(true);
  });

  it('is due when last maintenance time is unparseable', () => {
    expect(isMaintenanceDue('not-a-date', 7, now)).toBe(true);
  });

  it('is not due within the interval', () => {
    const last = new Date(now - 3 * DAY_MS).toISOString();
    expect(isMaintenanceDue(last, 7, now)).toBe(false);
  });

  it('is due exactly at and beyond the interval', () => {
    expect(isMaintenanceDue(new Date(now - 7 * DAY_MS).toISOString(), 7, now)).toBe(true);
    expect(isMaintenanceDue(new Date(now - 30 * DAY_MS).toISOString(), 7, now)).toBe(true);
  });
});
