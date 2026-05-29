import { fmtPrice, fmtPct } from '../../lib/format.js';
import './Ticker.css';

/**
 * Continuously scrolling gold ticker tape (CSS-only marquee, GPU translate).
 * `rows` is the last N points; duplicated twice for seamless loop.
 */
export default function Ticker({ rows = [] }) {
  if (!rows.length) return <div className="ticker placeholder" />;

  const items = rows.slice(-32);
  const tape = [...items, ...items];

  return (
    <div className="ticker" aria-label="XAUUSD price tape">
      <div className="ticker-edge ticker-edge-l" />
      <div className="ticker-edge ticker-edge-r" />
      <div className="ticker-track">
        {tape.map((d, i) => {
          const prev = i === 0 ? d.close : tape[i - 1].close;
          const chg = ((d.close - prev) / prev) * 100;
          const up = chg >= 0;
          return (
            <span className="ticker-cell" key={`${d.date.getTime()}-${i}`}>
              <span className="ticker-symbol">XAU</span>
              <span className="ticker-price mono">{fmtPrice(d.close)}</span>
              <span className={`ticker-delta mono ${up ? 'pos' : 'neg'}`}>
                {up ? '▲' : '▼'} {fmtPct(chg)}
              </span>
              <span className="ticker-sep" />
            </span>
          );
        })}
      </div>
    </div>
  );
}
