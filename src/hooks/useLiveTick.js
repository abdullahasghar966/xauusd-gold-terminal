import { useEffect, useState } from 'react';

/**
 * Live price tick. By default emits a simulated drift around `seed`.
 *
 * If `import.meta.env.VITE_LIVE_FEED_URL` is set (or `opts.url` is passed),
 * opens a WebSocket and pipes the incoming messages through `opts.parseTick`
 * (or a default JSON parser looking for { price } / { p } / { last }). When
 * the socket disconnects or fails, the hook gracefully falls back to the
 * simulator without unmounting the consumer.
 *
 * Pass `opts.simulate: true` to force the simulated path regardless of env
 * — used by tests.
 */
export function useLiveTick(seed, opts = {}) {
  const {
    intervalMs = 4000,
    simulate = false,
    url: explicitUrl,
    parseTick,
    WebSocketImpl,
  } = typeof opts === 'number' ? { intervalMs: opts } : opts;

  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_LIVE_FEED_URL
      : undefined;
  const url = simulate ? null : explicitUrl || envUrl || null;

  const [tick, setTick] = useState({
    price: seed ?? 0,
    prev: seed ?? 0,
    dir: 0,
    n: 0,
    source: url ? 'live' : 'sim',
  });

  useEffect(() => {
    if (!Number.isFinite(seed)) return;
    setTick({ price: seed, prev: seed, dir: 0, n: 0, source: url ? 'live' : 'sim' });

    // ── Simulated path ──
    const startSim = () => {
      const id = setInterval(() => {
        setTick((t) => {
          const drift = (Math.random() - 0.48) * 0.006;
          const next = +(t.price * (1 + drift)).toFixed(2);
          const dir = next > t.price ? 1 : next < t.price ? -1 : 0;
          return { price: next, prev: t.price, dir, n: t.n + 1, source: 'sim' };
        });
      }, intervalMs);
      return () => clearInterval(id);
    };

    if (!url) return startSim();

    // ── Live WebSocket path ──
    let ws;
    let fallback = null;
    const WS = WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : null);
    if (!WS) return startSim();

    const parser =
      parseTick ||
      ((raw) => {
        if (raw == null) return null;
        if (typeof raw === 'number') return { price: raw };
        if (typeof raw === 'string') {
          try {
            return parser(JSON.parse(raw));
          } catch {
            const n = Number(raw);
            return Number.isFinite(n) ? { price: n } : null;
          }
        }
        if (typeof raw === 'object') {
          const price = raw.price ?? raw.p ?? raw.last ?? raw.c ?? raw.close;
          return Number.isFinite(+price) ? { price: +price } : null;
        }
        return null;
      });

    try {
      ws = new WS(url);
    } catch {
      return startSim();
    }

    const onMessage = (event) => {
      const parsed = parser(event.data);
      if (!parsed || !Number.isFinite(+parsed.price)) return;
      const next = +(+parsed.price).toFixed(2);
      setTick((t) => {
        const dir = next > t.price ? 1 : next < t.price ? -1 : 0;
        return { price: next, prev: t.price, dir, n: t.n + 1, source: 'live' };
      });
    };
    const onError = () => {
      if (!fallback) fallback = startSim();
    };
    const onClose = () => {
      if (!fallback) fallback = startSim();
    };

    ws.addEventListener('message', onMessage);
    ws.addEventListener('error', onError);
    ws.addEventListener('close', onClose);

    return () => {
      ws.removeEventListener?.('message', onMessage);
      ws.removeEventListener?.('error', onError);
      ws.removeEventListener?.('close', onClose);
      try { ws.close(); } catch { /* noop */ }
      if (fallback) fallback();
    };
  }, [seed, intervalMs, url, simulate, parseTick, WebSocketImpl]);

  return tick;
}
