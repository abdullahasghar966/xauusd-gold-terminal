import Papa from 'papaparse';

/**
 * Default schema for Yahoo-style XAUUSD CSV exports.
 *   row 0: Price,Close,High,Low,Open,Volume
 *   row 1: Ticker,GC=F,...
 *   row 2: Date,,,,,
 *   row 3+: 2015-01-02,1186.0,1194.5,1169.5,1184.0,138
 */
const YAHOO_OHLCV_SCHEMA = {
  isDataRow: (r) => r && typeof r[0] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r[0]),
  toRow: (r) => ({
    date: new Date(r[0]),
    close: +r[1],
    high: +r[2],
    low: +r[3],
    open: +r[4],
    volume: +r[5],
  }),
};

/** Generic CSV loader. Accepts a parsing schema; defaults to Yahoo OHLCV layout. */
export async function loadCsv(url, schema = YAHOO_OHLCV_SCHEMA) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const text = await res.text();

  const parsed = Papa.parse(text, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  return parsed.data
    .filter(schema.isDataRow)
    .map(schema.toRow)
    .filter(
      (d) =>
        d.date instanceof Date &&
        !Number.isNaN(d.date.getTime()) &&
        Number.isFinite(d.close) &&
        Number.isFinite(d.high) &&
        Number.isFinite(d.low) &&
        Number.isFinite(d.open)
    )
    .sort((a, b) => a.date - b.date);
}

/** Backwards-compatible XAUUSD loader. */
export async function loadGoldData(url = '/Gold_Data.csv') {
  return loadCsv(url, YAHOO_OHLCV_SCHEMA);
}

/** Simple moving average over `window` days. */
export function sma(rows, window, key = 'close') {
  const out = new Array(rows.length).fill(null);
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    sum += rows[i][key];
    if (i >= window) sum -= rows[i - window][key];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/** Annualized realised volatility from log returns of last `window` days. */
export function realisedVol(rows, window = 30) {
  const n = rows.length;
  if (n < window + 1) return null;
  const slice = rows.slice(-window - 1);
  const rets = [];
  for (let i = 1; i < slice.length; i++) {
    rets.push(Math.log(slice[i].close / slice[i - 1].close));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100; // %
}

/** Year-to-date return % (vs first trading day of current year in dataset). */
export function ytdReturn(rows) {
  if (!rows.length) return null;
  const lastYear = rows[rows.length - 1].date.getFullYear();
  const yearStart = rows.find((r) => r.date.getFullYear() === lastYear);
  if (!yearStart) return null;
  return ((rows[rows.length - 1].close - yearStart.close) / yearStart.close) * 100;
}

/** 24h change % (last vs prior close). */
export function dayChange(rows) {
  if (rows.length < 2) return null;
  const a = rows[rows.length - 2].close;
  const b = rows[rows.length - 1].close;
  return ((b - a) / a) * 100;
}

/** All-time high (from full dataset). */
export function allTimeHigh(rows) {
  let max = -Infinity;
  for (const r of rows) if (r.high > max) max = r.high;
  return Number.isFinite(max) ? max : null;
}

/** 52-week range. */
export function range52w(rows) {
  if (!rows.length) return { low: null, high: null, position: 0 };
  const cutoff = new Date(rows[rows.length - 1].date);
  cutoff.setDate(cutoff.getDate() - 365);
  const recent = rows.filter((r) => r.date >= cutoff);
  let lo = Infinity, hi = -Infinity;
  for (const r of recent) {
    if (r.low < lo) lo = r.low;
    if (r.high > hi) hi = r.high;
  }
  const last = rows[rows.length - 1].close;
  const position = hi > lo ? (last - lo) / (hi - lo) : 0.5;
  return { low: lo, high: hi, position };
}

/** Annual returns by calendar year (first close → last close). */
export function annualReturns(rows) {
  const buckets = new Map();
  for (const r of rows) {
    const y = r.date.getFullYear();
    if (!buckets.has(y)) buckets.set(y, { year: y, first: r, last: r });
    else buckets.get(y).last = r;
  }
  return Array.from(buckets.values())
    .map(({ year, first, last }) => ({
      year,
      return: ((last.close - first.close) / first.close) * 100,
      open: first.open,
      close: last.close,
    }))
    .sort((a, b) => a.year - b.year);
}

/** Monthly returns matrix (year x month). Used for the seasonality heatmap. */
export function monthlySeasonality(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const y = r.date.getFullYear();
    const m = r.date.getMonth();
    const k = `${y}-${m}`;
    if (!byKey.has(k)) byKey.set(k, { year: y, month: m, first: r, last: r });
    else byKey.get(k).last = r;
  }
  const cells = Array.from(byKey.values()).map(({ year, month, first, last }) => ({
    year,
    month,
    return: ((last.close - first.close) / first.close) * 100,
  }));
  const years = Array.from(new Set(cells.map((c) => c.year))).sort();
  return { cells, years, months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
}

/** Detect MA50/MA200 crossover signals (golden/death cross). */
export function crossoverSignals(rows, ma50, ma200) {
  const signals = [];
  for (let i = 1; i < rows.length; i++) {
    const prev50 = ma50[i - 1], prev200 = ma200[i - 1];
    const cur50 = ma50[i], cur200 = ma200[i];
    if (prev50 == null || prev200 == null || cur50 == null || cur200 == null) continue;
    if (prev50 <= prev200 && cur50 > cur200) signals.push({ index: i, type: 'golden', date: rows[i].date, price: rows[i].close });
    else if (prev50 >= prev200 && cur50 < cur200) signals.push({ index: i, type: 'death', date: rows[i].date, price: rows[i].close });
  }
  return signals;
}

/** Slice last N trading days (for table). */
export function lastN(rows, n) {
  return rows.slice(-n);
}

/** Filter by range key: '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL'. */
export function rangeSlice(rows, key) {
  if (key === 'ALL' || !rows.length) return rows;
  const last = rows[rows.length - 1].date;
  const map = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 365 * 5 };
  const days = map[key] ?? 365;
  const cutoff = new Date(last);
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter((r) => r.date >= cutoff);
}

/** Relative Strength Index (Wilder smoothing). Returns an array aligned with rows; nulls until warm. */
export function rsi(rows, period = 14) {
  const n = rows.length;
  const out = new Array(n).fill(null);
  if (n < period + 1) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = rows[i].close - rows[i - 1].close;
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < n; i++) {
    const ch = rows[i].close - rows[i - 1].close;
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** Bollinger Bands. Returns { middle, upper, lower } arrays aligned with rows; nulls until warm. */
export function bollinger(rows, period = 20, k = 2) {
  const n = rows.length;
  const middle = new Array(n).fill(null);
  const upper = new Array(n).fill(null);
  const lower = new Array(n).fill(null);
  if (n < period) return { middle, upper, lower };

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const c = rows[i].close;
    sum += c;
    sumSq += c * c;
    if (i >= period) {
      const old = rows[i - period].close;
      sum -= old;
      sumSq -= old * old;
    }
    if (i >= period - 1) {
      const mean = sum / period;
      const variance = Math.max(0, sumSq / period - mean * mean);
      const sd = Math.sqrt(variance);
      middle[i] = mean;
      upper[i] = mean + k * sd;
      lower[i] = mean - k * sd;
    }
  }
  return { middle, upper, lower };
}

/**
 * Drawdown series from peak-to-date close.
 *   series:        [{date, pct}]  — percent drawdown at each point (≤0)
 *   maxDrawdown:   { peakDate, troughDate, pct }
 *   currentDrawdown: number  — pct (≤0)
 */
export function drawdowns(rows) {
  if (!rows.length) {
    return { series: [], maxDrawdown: null, currentDrawdown: 0 };
  }
  let peak = rows[0].close;
  let peakDate = rows[0].date;
  let maxPeak = peak;
  let maxPeakDate = peakDate;
  let maxTroughDate = peakDate;
  let maxPct = 0;
  const series = new Array(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.close > peak) {
      peak = r.close;
      peakDate = r.date;
    }
    const pct = ((r.close - peak) / peak) * 100;
    series[i] = { date: r.date, pct };
    if (pct < maxPct) {
      maxPct = pct;
      maxPeak = peak;
      maxPeakDate = peakDate;
      maxTroughDate = r.date;
    }
  }

  return {
    series,
    maxDrawdown: { peakDate: maxPeakDate, troughDate: maxTroughDate, pct: maxPct, peak: maxPeak },
    currentDrawdown: series[series.length - 1].pct,
  };
}

/** Log returns for each adjacent pair. Length = rows.length - 1. */
export function dailyReturns(rows) {
  if (rows.length < 2) return [];
  const out = new Array(rows.length - 1);
  for (let i = 1; i < rows.length; i++) {
    out[i - 1] = Math.log(rows[i].close / rows[i - 1].close);
  }
  return out;
}

/** Histogram of daily log returns. Returns { bins:[{x0,x1,count}], mean, stdev }. */
export function returnsHistogram(rows, bins = 40) {
  const returns = dailyReturns(rows);
  if (!returns.length) return { bins: [], mean: 0, stdev: 0 };

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const stdev = Math.sqrt(variance);

  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const span = max - min || 1;
  const step = span / bins;
  const out = [];
  for (let i = 0; i < bins; i++) {
    out.push({ x0: min + i * step, x1: min + (i + 1) * step, count: 0 });
  }
  for (const r of returns) {
    let idx = Math.floor((r - min) / step);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    out[idx].count++;
  }
  return { bins: out, mean, stdev };
}

/** Autocorrelation of daily log returns at the given lags. */
export function autocorrelation(rows, lags = [1, 5, 21, 63, 252]) {
  const r = dailyReturns(rows);
  const n = r.length;
  if (n < 2) return lags.map((lag) => ({ lag, value: 0 }));

  const mean = r.reduce((a, b) => a + b, 0) / n;
  let denom = 0;
  for (let i = 0; i < n; i++) denom += (r[i] - mean) ** 2;
  if (denom === 0) return lags.map((lag) => ({ lag, value: 0 }));

  return lags.map((lag) => {
    if (lag <= 0 || lag >= n) return { lag, value: 0 };
    let num = 0;
    for (let i = lag; i < n; i++) num += (r[i] - mean) * (r[i - lag] - mean);
    return { lag, value: num / denom };
  });
}
