import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { fmtPrice, fmtPct, fmtTime } from '../../lib/format.js';
import Ticker from './Ticker.jsx';
import AssetSwitcher from './AssetSwitcher.jsx';
import './Header.css';

function MarketBadge() {
  const [isOpen, setIsOpen] = useState(true);
  useEffect(() => {
    const check = () => {
      const d = new Date();
      const day = d.getUTCDay();
      const hour = d.getUTCHours();
      // CME Globex: Sun 22:00 UTC → Fri 22:00 UTC (rough)
      const closed =
        (day === 5 && hour >= 22) ||
        day === 6 ||
        (day === 0 && hour < 22);
      setIsOpen(!closed);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={`market-badge ${isOpen ? 'open' : 'closed'}`}>
      <span className="dot" /> {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
    </span>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="clock mono">
      <span className="clock-time">{fmtTime(now)}</span>
      <span className="clock-tz">UTC{(-(now.getTimezoneOffset() / 60))
        .toLocaleString('en-US', { signDisplay: 'always' })}</span>
    </span>
  );
}

export default function Header({
  price,
  dayChangePct,
  tickerRows,
  tickDir,
  asset,
  assets,
  onAssetChange,
  extras,
}) {
  return (
    <header className="hdr" data-anim="header">
      <div className="hdr-inner">
        <div className="hdr-mark">
          <Sparkles size={18} strokeWidth={1.4} className="mark-icon" />
          <div>
            <div className="hdr-eyebrow">
              {asset?.symbol || 'XAU/USD'} · Yahoo {asset?.symbol === 'XAUUSD' ? 'GC=F' : 'OHLCV'}
            </div>
            <h1 className="hdr-title">
              <span className="shimmer-text">{asset?.label || 'Gold'} Intelligence</span>
              <span className="hdr-title-tail"> Terminal</span>
            </h1>
            <div className="hdr-mark-actions">
              <AssetSwitcher assets={assets} value={asset} onChange={onAssetChange} />
              {extras}
            </div>
          </div>
        </div>

        <div className="hdr-live">
          <div className="hdr-live-row">
            <span className="hdr-live-symbol">{asset?.symbol || 'XAUUSD'}</span>
            <span
              className={`hdr-live-price mono ${tickDir > 0 ? 'flash-up' : tickDir < 0 ? 'flash-down' : ''}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {fmtPrice(price)}
            </span>
            <span className={`hdr-live-delta mono ${dayChangePct >= 0 ? 'pos' : 'neg'}`}>
              {dayChangePct >= 0 ? '▲' : '▼'} {fmtPct(dayChangePct)}
            </span>
          </div>
          <div className="hdr-live-meta">
            <MarketBadge />
            <span className="hdr-divider" />
            <Clock />
          </div>
        </div>
      </div>
      <Ticker rows={tickerRows} />
    </header>
  );
}
