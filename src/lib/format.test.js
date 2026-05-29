import { describe, it, expect } from 'vitest';
import { fmtPrice, fmtNum, fmtPct, fmtVol, fmtDate, fmtTime } from './format.js';

describe('fmtPrice', () => {
  it('formats a positive number with $ and 2 dp by default', () => {
    expect(fmtPrice(1234.5)).toBe('$1,234.50');
  });
  it('respects custom digits', () => {
    expect(fmtPrice(1234.5678, 4)).toBe('$1,234.5678');
  });
  it('returns em-dash for null/NaN', () => {
    expect(fmtPrice(null)).toBe('—');
    expect(fmtPrice(NaN)).toBe('—');
  });
});

describe('fmtNum', () => {
  it('formats with locale thousands separators', () => {
    expect(fmtNum(1000000)).toBe('1,000,000.00');
  });
  it('returns em-dash for null/NaN', () => {
    expect(fmtNum(null)).toBe('—');
  });
});

describe('fmtPct', () => {
  it('prefixes positive numbers with +', () => {
    expect(fmtPct(1.234)).toBe('+1.23%');
  });
  it('leaves negative numbers as-is', () => {
    expect(fmtPct(-0.5)).toBe('-0.50%');
  });
  it('returns em-dash for null/NaN', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(NaN)).toBe('—');
  });
});

describe('fmtVol', () => {
  it('renders raw numbers under 1000', () => {
    expect(fmtVol(500)).toBe('500');
  });
  it('renders K for thousands', () => {
    expect(fmtVol(12500)).toBe('12.5K');
  });
  it('renders M for millions', () => {
    expect(fmtVol(2_500_000)).toBe('2.50M');
  });
  it('returns em-dash for null/NaN', () => {
    expect(fmtVol(null)).toBe('—');
  });
});

describe('fmtDate', () => {
  it('formats a Date', () => {
    const d = new Date('2024-06-15T00:00:00Z');
    const out = fmtDate(d);
    expect(typeof out).toBe('string');
    expect(out).not.toBe('—');
  });
  it('returns em-dash for non-date input', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('not a date')).toBe('—');
  });
});

describe('fmtTime', () => {
  it('formats a time string', () => {
    const d = new Date('2024-06-15T12:30:45Z');
    const out = fmtTime(d);
    expect(typeof out).toBe('string');
    expect(out).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
  it('returns em-dash for non-date input', () => {
    expect(fmtTime(null)).toBe('—');
  });
});
