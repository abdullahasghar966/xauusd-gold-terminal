export const fmtPrice = (v, digits = 2) =>
  v == null || Number.isNaN(v)
    ? '—'
    : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtNum = (v, digits = 2) =>
  v == null || Number.isNaN(v)
    ? '—'
    : Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPct = (v, digits = 2) => {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '' : '';
  return `${sign}${Number(v).toFixed(digits)}%`;
};

export const fmtVol = (v) => {
  if (v == null || Number.isNaN(v)) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

export const fmtDate = (d, opts = { month: 'short', day: '2-digit', year: 'numeric' }) =>
  d instanceof Date ? d.toLocaleDateString('en-US', opts) : '—';

export const fmtTime = (d) =>
  d instanceof Date
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—';
