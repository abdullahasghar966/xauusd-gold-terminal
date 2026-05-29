/**
 * Asset registry. The default XAUUSD entry is always present; other entries
 * are auto-detected on first call by probing for known CSV filenames in /public.
 * Drop a CSV at /public/<name>_Data.csv with the same Yahoo OHLCV layout and
 * it will appear in the switcher.
 */

export const DEFAULT_ASSET = {
  id: 'XAUUSD',
  label: 'Gold',
  symbol: 'XAUUSD',
  url: '/Gold_Data.csv',
};

const CANDIDATES = [
  { id: 'XAGUSD',  label: 'Silver',  symbol: 'XAGUSD',  url: '/Silver_Data.csv' },
  { id: 'XPTUSD',  label: 'Platinum', symbol: 'XPTUSD', url: '/Platinum_Data.csv' },
  { id: 'BTCUSD',  label: 'Bitcoin', symbol: 'BTCUSD',  url: '/BTCUSD_Data.csv' },
];

let cache = null;

async function probe(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) return false; // SPA fallback served the app shell
    const body = await res.text();
    // Accept anything that looks like a CSV header or a date-led row.
    const head = body.slice(0, 200);
    return /,/.test(head) && (/Price,Close/i.test(head) || /^\d{4}-\d{2}-\d{2}/m.test(head));
  } catch {
    return false;
  }
}

/** Returns all available assets — always at least the default. */
export async function discoverAssets() {
  if (cache) return cache;
  const found = await Promise.all(
    CANDIDATES.map(async (a) => ((await probe(a.url)) ? a : null)),
  );
  cache = [DEFAULT_ASSET, ...found.filter(Boolean)];
  return cache;
}
