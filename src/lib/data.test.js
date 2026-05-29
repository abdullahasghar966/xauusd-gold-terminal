import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sma,
  realisedVol,
  ytdReturn,
  dayChange,
  allTimeHigh,
  range52w,
  annualReturns,
  monthlySeasonality,
  crossoverSignals,
  lastN,
  rangeSlice,
  rsi,
  bollinger,
  drawdowns,
  dailyReturns,
  returnsHistogram,
  autocorrelation,
  loadCsv,
  loadGoldData,
} from './data.js';

/**
 * Build a synthetic OHLCV series. `closes` drives close; high/low/open are derived.
 */
function makeRows(startISO, closes, volume = 1000) {
  const start = new Date(startISO);
  return closes.map((c, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return {
      date: d,
      open: c,
      high: c * 1.005,
      low: c * 0.995,
      close: c,
      volume,
    };
  });
}

describe('sma', () => {
  it('returns null for indices before window-1', () => {
    const rows = makeRows('2024-01-01', [10, 20, 30, 40, 50]);
    const out = sma(rows, 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
  });

  it('computes a rolling mean once enough samples exist', () => {
    const rows = makeRows('2024-01-01', [10, 20, 30, 40, 50]);
    const out = sma(rows, 3);
    expect(out[2]).toBeCloseTo(20);
    expect(out[3]).toBeCloseTo(30);
    expect(out[4]).toBeCloseTo(40);
  });

  it('respects an alternate key', () => {
    const rows = makeRows('2024-01-01', [10, 20, 30]);
    const out = sma(rows, 2, 'volume');
    expect(out[1]).toBe(1000);
    expect(out[2]).toBe(1000);
  });
});

describe('realisedVol', () => {
  it('returns null when not enough samples', () => {
    const rows = makeRows('2024-01-01', [10, 11]);
    expect(realisedVol(rows, 30)).toBeNull();
  });

  it('returns zero for a flat series', () => {
    const rows = makeRows('2024-01-01', Array(50).fill(100));
    expect(realisedVol(rows, 30)).toBeCloseTo(0);
  });

  it('returns a positive number for a volatile series', () => {
    const closes = [];
    for (let i = 0; i < 50; i++) closes.push(100 * (1 + 0.02 * Math.sin(i)));
    const rows = makeRows('2024-01-01', closes);
    const v = realisedVol(rows, 30);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(100);
  });
});

describe('ytdReturn', () => {
  it('returns null on empty', () => {
    expect(ytdReturn([])).toBeNull();
  });

  it('computes from first trading day of last year in dataset', () => {
    const a = makeRows('2024-01-02', [100]);
    const b = makeRows('2025-01-03', [110, 120, 132]);
    const rows = [...a, ...b];
    expect(ytdReturn(rows)).toBeCloseTo(20, 5);
  });
});

describe('dayChange', () => {
  it('returns null when fewer than two rows', () => {
    expect(dayChange([])).toBeNull();
    expect(dayChange(makeRows('2024-01-01', [100]))).toBeNull();
  });

  it('returns percent change between last two closes', () => {
    const rows = makeRows('2024-01-01', [100, 101]);
    expect(dayChange(rows)).toBeCloseTo(1);
  });
});

describe('allTimeHigh', () => {
  it('returns the highest high', () => {
    const rows = makeRows('2024-01-01', [100, 200, 50, 150]);
    expect(allTimeHigh(rows)).toBeCloseTo(200 * 1.005, 5);
  });

  it('returns null when no data', () => {
    expect(allTimeHigh([])).toBeNull();
  });
});

describe('range52w', () => {
  it('returns low/high/position from last 365 days', () => {
    const closes = Array.from({ length: 400 }, (_, i) => 100 + i);
    const rows = makeRows('2024-01-01', closes);
    const r = range52w(rows);
    expect(r.low).toBeGreaterThan(0);
    expect(r.high).toBeGreaterThan(r.low);
    expect(r.position).toBeGreaterThan(0);
    expect(r.position).toBeLessThanOrEqual(1);
  });

  it('handles empty input safely', () => {
    const r = range52w([]);
    expect(r.low).toBeNull();
    expect(r.high).toBeNull();
  });
});

describe('annualReturns', () => {
  it('groups by calendar year', () => {
    const rows = [
      ...makeRows('2023-01-02', [100, 110]),
      ...makeRows('2024-01-02', [110, 165]),
    ];
    const out = annualReturns(rows);
    expect(out).toHaveLength(2);
    expect(out[0].year).toBe(2023);
    expect(out[0].return).toBeCloseTo(10);
    expect(out[1].year).toBe(2024);
    expect(out[1].return).toBeCloseTo(50);
  });
});

describe('monthlySeasonality', () => {
  it('builds a year × month grid', () => {
    const rows = [
      ...makeRows('2024-01-02', [100, 110]),
      ...makeRows('2024-02-01', [110, 121]),
    ];
    const { cells, years, months } = monthlySeasonality(rows);
    expect(months).toHaveLength(12);
    expect(years).toContain(2024);
    const jan = cells.find((c) => c.year === 2024 && c.month === 0);
    expect(jan.return).toBeCloseTo(10);
  });
});

describe('crossoverSignals', () => {
  it('emits a golden cross when MA50 crosses above MA200', () => {
    const rows = makeRows('2024-01-01', [1, 2, 3, 4, 5]);
    const ma200 = [3, 3, 3, 3, 3];
    const ma50 =  [1, 2, 3, 4, 5];
    const signals = crossoverSignals(rows, ma50, ma200);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('golden');
    expect(signals[0].index).toBe(3);
  });

  it('emits a death cross when MA50 crosses below MA200', () => {
    const rows = makeRows('2024-01-01', [5, 4, 3, 2, 1]);
    const ma200 = [3, 3, 3, 3, 3];
    const ma50 =  [5, 4, 3, 2, 1];
    const signals = crossoverSignals(rows, ma50, ma200);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('death');
  });

  it('ignores nullish values', () => {
    const rows = makeRows('2024-01-01', [1, 2, 3]);
    expect(crossoverSignals(rows, [null, null, 1], [null, null, 1])).toHaveLength(0);
  });
});

describe('lastN', () => {
  it('returns the last N elements', () => {
    const rows = makeRows('2024-01-01', [1, 2, 3, 4, 5]);
    expect(lastN(rows, 2)).toHaveLength(2);
    expect(lastN(rows, 2)[1].close).toBe(5);
  });
});

describe('rangeSlice', () => {
  const rows = makeRows('2020-01-01', Array.from({ length: 365 * 6 }, (_, i) => 100 + i));

  it('returns all rows for ALL', () => {
    expect(rangeSlice(rows, 'ALL')).toBe(rows);
  });

  it('returns a smaller window for 1M than 1Y', () => {
    const oneMonth = rangeSlice(rows, '1M');
    const oneYear = rangeSlice(rows, '1Y');
    expect(oneMonth.length).toBeLessThan(oneYear.length);
    expect(oneMonth.length).toBeGreaterThan(0);
  });

  it('handles empty input safely', () => {
    expect(rangeSlice([], '1Y')).toEqual([]);
  });
});

describe('rsi', () => {
  it('returns nulls when fewer than period+1 samples', () => {
    const rows = makeRows('2024-01-01', [1, 2, 3]);
    const out = rsi(rows, 14);
    expect(out.every((v) => v === null)).toBe(true);
  });

  it('returns 100 when there are no losses', () => {
    const rows = makeRows('2024-01-01', Array.from({ length: 20 }, (_, i) => 100 + i));
    const out = rsi(rows, 14);
    expect(out[14]).toBe(100);
  });

  it('returns a value bounded 0..100', () => {
    const rows = makeRows('2024-01-01', Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5));
    const out = rsi(rows, 14);
    const last = out[out.length - 1];
    expect(last).toBeGreaterThanOrEqual(0);
    expect(last).toBeLessThanOrEqual(100);
  });
});

describe('bollinger', () => {
  it('returns nulls when fewer than period samples', () => {
    const rows = makeRows('2024-01-01', [1, 2, 3]);
    const { middle, upper, lower } = bollinger(rows, 20, 2);
    expect(middle.every((v) => v === null)).toBe(true);
    expect(upper.every((v) => v === null)).toBe(true);
    expect(lower.every((v) => v === null)).toBe(true);
  });

  it('middle equals mean and upper > middle > lower', () => {
    const rows = makeRows('2024-01-01', Array.from({ length: 40 }, (_, i) => 100 + i));
    const { middle, upper, lower } = bollinger(rows, 20, 2);
    const idx = 30;
    expect(middle[idx]).toBeCloseTo((100 + idx + 100 + idx - 19) / 2);
    expect(upper[idx]).toBeGreaterThan(middle[idx]);
    expect(lower[idx]).toBeLessThan(middle[idx]);
  });

  it('collapses to middle for a flat series', () => {
    const rows = makeRows('2024-01-01', Array(40).fill(100));
    const { middle, upper, lower } = bollinger(rows, 20, 2);
    expect(middle[30]).toBeCloseTo(100);
    expect(upper[30]).toBeCloseTo(100);
    expect(lower[30]).toBeCloseTo(100);
  });
});

describe('drawdowns', () => {
  it('returns zero drawdown for monotonic up', () => {
    const rows = makeRows('2024-01-01', [10, 20, 30, 40]);
    const dd = drawdowns(rows);
    expect(dd.currentDrawdown).toBeCloseTo(0);
    expect(dd.maxDrawdown.pct).toBeCloseTo(0);
  });

  it('reports peak/trough on a single dip', () => {
    const rows = makeRows('2024-01-01', [100, 120, 60, 80]);
    const dd = drawdowns(rows);
    expect(dd.maxDrawdown.pct).toBeCloseTo(-50);
    expect(dd.maxDrawdown.troughDate.toISOString().slice(0, 10)).toBe('2024-01-03');
    expect(dd.currentDrawdown).toBeCloseTo(-100 / 3, 1);
  });

  it('handles empty input safely', () => {
    const dd = drawdowns([]);
    expect(dd.series).toEqual([]);
    expect(dd.maxDrawdown).toBeNull();
  });
});

describe('dailyReturns', () => {
  it('returns one fewer than rows', () => {
    const rows = makeRows('2024-01-01', [10, 20, 30]);
    expect(dailyReturns(rows)).toHaveLength(2);
  });

  it('log returns are roughly equal to relative change for small moves', () => {
    const rows = makeRows('2024-01-01', [100, 101]);
    expect(dailyReturns(rows)[0]).toBeCloseTo(Math.log(101 / 100));
  });
});

describe('returnsHistogram', () => {
  it('produces the requested number of bins', () => {
    const rows = makeRows('2024-01-01', Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i) * 5));
    const { bins, mean, stdev } = returnsHistogram(rows, 25);
    expect(bins).toHaveLength(25);
    expect(typeof mean).toBe('number');
    expect(stdev).toBeGreaterThanOrEqual(0);
  });

  it('counts sum to rows.length-1', () => {
    const rows = makeRows('2024-01-01', Array.from({ length: 50 }, (_, i) => 100 + i));
    const { bins } = returnsHistogram(rows, 10);
    const total = bins.reduce((a, b) => a + b.count, 0);
    expect(total).toBe(49);
  });
});

describe('autocorrelation', () => {
  it('returns one entry per lag', () => {
    const rows = makeRows('2024-01-01', Array.from({ length: 100 }, (_, i) => 100 + i));
    const out = autocorrelation(rows, [1, 5, 10]);
    expect(out).toHaveLength(3);
    expect(out[0].lag).toBe(1);
  });

  it('handles flat returns gracefully', () => {
    const rows = makeRows('2024-01-01', Array(20).fill(100));
    const out = autocorrelation(rows, [1, 5]);
    expect(out.every((v) => Number.isFinite(v.value))).toBe(true);
  });
});

describe('loadCsv / loadGoldData', () => {
  const fixture = `Price,Close,High,Low,Open,Volume
Ticker,GC=F,GC=F,GC=F,GC=F,GC=F
Date,,,,,
2024-01-02,2050.0,2060.0,2040.0,2045.0,1000
2024-01-03,2070.0,2080.0,2055.0,2050.0,1100
not-a-date,foo,bar,baz,qux,quux
2024-01-04,2080.0,2090.0,2065.0,2070.0,1200
`;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixture,
    }));
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('parses valid rows and skips the header + invalid lines', async () => {
    const rows = await loadCsv('/anything.csv');
    expect(rows).toHaveLength(3);
    expect(rows[0].close).toBe(2050);
    expect(rows[2].close).toBe(2080);
  });

  it('sorts ascending by date', async () => {
    const rows = await loadCsv('/anything.csv');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].date.getTime()).toBeGreaterThanOrEqual(rows[i - 1].date.getTime());
    }
  });

  it('throws on non-200', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(loadCsv('/missing.csv')).rejects.toThrow(/404/);
  });

  it('loadGoldData delegates to loadCsv', async () => {
    const rows = await loadGoldData();
    expect(rows).toHaveLength(3);
  });
});
