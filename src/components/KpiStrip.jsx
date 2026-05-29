import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ArrowUpRight, ArrowDownRight, Crown, Activity, Gauge } from 'lucide-react';
import { fmtPrice, fmtPct, fmtNum } from '../lib/format.js';
import { useCountUp } from '../hooks/useCountUp.js';
import './KpiStrip.css';

function KpiCard({ delay, icon, label, children, accent, srSummary }) {
  return (
    <motion.div
      data-anim="kpi"
      className={`kpi-card kpi-${accent || 'neutral'}`}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      role="group"
      aria-label={label}
    >
      <div className="kpi-head">
        <span className="kpi-icon" aria-hidden="true">{icon}</span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-body">{children}</div>
      {srSummary ? <p className="sr-only">{srSummary}</p> : null}
      <div className="kpi-corner" aria-hidden="true" />
    </motion.div>
  );
}

function CurrentPriceCard({ price, delay }) {
  const ref = useCountUp(price ?? 0, {
    delay,
    duration: 1.1,
    format: (v) =>
      `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  });
  return (
    <KpiCard
      accent="gold"
      delay={delay}
      icon={<Activity size={13} strokeWidth={1.6} />}
      label="Spot Price"
      srSummary={price != null ? `Spot price ${fmtPrice(price)} USD per troy ounce.` : 'Spot price unavailable.'}
    >
      <div className="kpi-value mono" ref={ref}>$0.00</div>
      <div className="kpi-sub">USD / troy oz</div>
    </KpiCard>
  );
}

function DayChangeCard({ value, delay }) {
  const ref = useCountUp(value ?? 0, {
    delay,
    duration: 1.0,
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
  });
  const positive = (value ?? 0) >= 0;
  return (
    <KpiCard accent={positive ? 'gold' : 'crimson'} delay={delay}
      icon={positive ? <ArrowUpRight size={13} strokeWidth={1.8} /> : <ArrowDownRight size={13} strokeWidth={1.8} />}
      label="24h Change"
      srSummary={value != null ? `24-hour change ${fmtPct(value)} versus prior close.` : 'No 24-hour change available.'}>
      <div className="kpi-value mono" ref={ref}>0.00%</div>
      <div className="kpi-sub">Last close vs prior</div>
    </KpiCard>
  );
}

function YtdCard({ value, delay }) {
  const ref = useCountUp(value ?? 0, {
    delay,
    duration: 1.1,
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
  });
  const positive = (value ?? 0) >= 0;
  return (
    <KpiCard accent={positive ? 'gold' : 'crimson'} delay={delay}
      icon={positive ? <ArrowUpRight size={13} strokeWidth={1.8} /> : <ArrowDownRight size={13} strokeWidth={1.8} />}
      label="YTD Return"
      srSummary={value != null ? `Year-to-date return ${fmtPct(value)}.` : 'No YTD data.'}>
      <div className="kpi-value mono" ref={ref}>0.00%</div>
      <div className="kpi-sub">Year to date</div>
    </KpiCard>
  );
}

function AthCard({ value, delay }) {
  const ref = useCountUp(value ?? 0, {
    delay,
    duration: 1.2,
    format: (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  });
  return (
    <KpiCard accent="gold" delay={delay} icon={<Crown size={13} strokeWidth={1.6} />} label="All-Time High"
      srSummary={value != null ? `All-time high ${fmtPrice(value)}.` : 'No ATH available.'}>
      <div className="kpi-value mono shimmer-text" ref={ref}>$0.00</div>
      <div className="kpi-sub">Dataset 2015 – 2026</div>
    </KpiCard>
  );
}

function RangeCard({ low, high, position, delay }) {
  const fillRef = useRef(null);
  useEffect(() => {
    if (!fillRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(fillRef.current, {
      width: `${Math.min(100, Math.max(0, (position ?? 0) * 100))}%`,
      duration: reduced ? 0.001 : 1.2,
      ease: 'power3.out',
      delay,
    });
  }, [position, delay]);
  return (
    <KpiCard accent="bronze" delay={delay} icon={<Gauge size={13} strokeWidth={1.6} />} label="52-Week Range"
      srSummary={
        low != null && high != null
          ? `52-week range ${fmtPrice(low)} to ${fmtPrice(high)}, currently at ${(((position ?? 0) * 100).toFixed(0))}% of range.`
          : 'No 52-week range available.'
      }>
      <div className="kpi-range mono">
        <span>{fmtPrice(low)}</span>
        <span>{fmtPrice(high)}</span>
      </div>
      <div className="kpi-range-track">
        <div className="kpi-range-fill" ref={fillRef} />
        <div className="kpi-range-marker" style={{ left: `${(position ?? 0) * 100}%` }} />
      </div>
    </KpiCard>
  );
}

function VolatilityCard({ value, delay }) {
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, (value ?? 0) / 40));
  const ref = useRef(null);
  const labelRef = useCountUp(value ?? 0, {
    delay,
    duration: 1.1,
    format: (v) => `${v.toFixed(1)}%`,
  });
  useEffect(() => {
    if (!ref.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.fromTo(
      ref.current,
      { strokeDashoffset: circ },
      { strokeDashoffset: circ * (1 - pct), duration: reduced ? 0.001 : 1.2, ease: 'power3.out', delay }
    );
  }, [pct, circ, delay]);
  return (
    <KpiCard accent="bronze" delay={delay} icon={<Activity size={13} strokeWidth={1.6} />} label="Volatility · 30d"
      srSummary={value != null ? `Annualised 30-day realised volatility ${value.toFixed(1)} percent.` : 'No volatility data.'}>
      <div className="kpi-gauge">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(201,168,76,0.12)" strokeWidth="4" />
          <circle
            ref={ref}
            cx="28" cy="28" r={radius}
            fill="none"
            stroke="url(#vol-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            transform="rotate(-90 28 28)"
          />
          <defs>
            <linearGradient id="vol-grad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#F0D080" />
              <stop offset="100%" stopColor="#8B6914" />
            </linearGradient>
          </defs>
        </svg>
        <div className="kpi-gauge-meta">
          <div className="kpi-value mono" ref={labelRef}>0.0%</div>
          <div className="kpi-sub">Annualised σ</div>
        </div>
      </div>
    </KpiCard>
  );
}

export default function KpiStrip({ price, dayChangePct, ytdPct, ath, range, vol }) {
  return (
    <div className="kpi-strip">
      <CurrentPriceCard price={price} delay={0.3} />
      <DayChangeCard value={dayChangePct} delay={0.4} />
      <YtdCard value={ytdPct} delay={0.5} />
      <AthCard value={ath} delay={0.6} />
      <RangeCard low={range?.low} high={range?.high} position={range?.position} delay={0.7} />
      <VolatilityCard value={vol} delay={0.8} />
    </div>
  );
}
