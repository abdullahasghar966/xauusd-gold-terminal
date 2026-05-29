import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { rangeSlice } from '../../lib/data.js';
import { fmtPrice, fmtDate } from '../../lib/format.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';
import './SidePanel.css';

function clampMonth(value, min, max) {
  if (!value) return value;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function monthKey(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function fromMonthKey(k) {
  if (!k) return null;
  const [y, m] = k.split('-').map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

function sliceMonths(rows, fromKey, toKey) {
  const from = fromMonthKey(fromKey);
  const to = fromMonthKey(toKey);
  if (!from || !to) return [];
  const end = new Date(to.getFullYear(), to.getMonth() + 1, 0, 23, 59, 59);
  return rows.filter((r) => r.date >= from && r.date <= end);
}

export default function PriceLineChart({ rows, range = '1Y' }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);

  const data = useMemo(() => rangeSlice(rows, range), [rows, range]);

  // ── Period compare state ──
  const [compareOn, setCompareOn] = useState(false);
  const minMonth = rows.length ? monthKey(rows[0].date) : '';
  const maxMonth = rows.length ? monthKey(rows[rows.length - 1].date) : '';
  const defaultFrom = '2020-03';
  const defaultTo = '2020-10';
  const [fromMonth, setFromMonth] = useState(defaultFrom);
  const [toMonth, setToMonth] = useState(defaultTo);

  const compareSlice = useMemo(
    () => (compareOn ? sliceMonths(rows, fromMonth, toMonth) : []),
    [compareOn, rows, fromMonth, toMonth],
  );

  const W = Math.max(280, size.width || 360);
  const H = 220;
  const M = { top: 14, right: 14, bottom: 22, left: 36 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  useEffect(() => {
    if (!data.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'pl-area').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(201,168,76,0.45)');
    grad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(201,168,76,0)');

    const x = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, innerW]);
    const y = d3.scaleLinear().domain([d3.min(data, (d) => d.low) * 0.995, d3.max(data, (d) => d.high) * 1.005]).range([innerH, 0]);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // gridlines
    const yt = y.ticks(4);
    g.append('g').selectAll('line').data(yt).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(201,168,76,0.06)').attr('stroke-dasharray', '2,4');

    g.append('g').selectAll('text').data(yt).join('text')
      .attr('x', -8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => fmtPrice(d, 0));

    // area
    const area = d3.area()
      .x((d) => x(d.date))
      .y0(innerH)
      .y1((d) => y(d.close))
      .curve(d3.curveMonotoneX);

    const areaPath = g.append('path').datum(data).attr('d', area).attr('fill', 'url(#pl-area)').attr('opacity', 1);

    // line
    const line = d3.line().x((d) => x(d.date)).y((d) => y(d.close)).curve(d3.curveMonotoneX);
    const path = g.append('path').datum(data).attr('d', line)
      .attr('fill', 'none').attr('stroke', '#F0D080').attr('stroke-width', 1.6)
      .attr('filter', 'drop-shadow(0 0 6px rgba(240,208,128,0.5))');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      const len = path.node().getTotalLength();
      gsap.from(path.node(), {
        strokeDasharray: `${len} ${len}`,
        strokeDashoffset: len,
        duration: 1.2, ease: 'power2.inOut', delay: 0.95,
        immediateRender: false,
      });
      gsap.from(areaPath.node(), { opacity: 0, duration: 0.8, delay: 1.3, immediateRender: false });
    }

    // last marker
    const last = data[data.length - 1];
    g.append('circle')
      .attr('cx', x(last.date)).attr('cy', y(last.close))
      .attr('r', 3).attr('fill', '#F0D080')
      .attr('stroke', '#0A0A0B').attr('stroke-width', 1.5);

    // ── Period compare overlay ──
    if (compareOn && compareSlice.length > 1) {
      // Normalize both series to start=100 and project them on a shared y-axis
      const baseStart = data[0].close;
      const baseEnd = data[data.length - 1].close;
      const cmpStart = compareSlice[0].close;

      const baseNorm = data.map((d) => ({ date: d.date, v: (d.close / baseStart) * 100 }));
      const cmpNorm = compareSlice.map((d, i) => ({
        // Re-time the compare slice onto the same X-domain so both lines share
        // the same horizontal axis (helps visual comparison).
        date: new Date(
          data[0].date.getTime() +
            (i / (compareSlice.length - 1)) * (data[data.length - 1].date.getTime() - data[0].date.getTime()),
        ),
        v: (d.close / cmpStart) * 100,
      }));

      const yMin = Math.min(d3.min(baseNorm, (d) => d.v), d3.min(cmpNorm, (d) => d.v)) * 0.99;
      const yMax = Math.max(d3.max(baseNorm, (d) => d.v), d3.max(cmpNorm, (d) => d.v)) * 1.01;
      const yN = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

      const lineN = d3.line().x((d) => x(d.date)).y((d) => yN(d.v)).curve(d3.curveMonotoneX);

      // Soft re-baseline of current line in normalized space
      g.append('path').datum(baseNorm).attr('d', lineN)
        .attr('fill', 'none').attr('stroke', '#F0D080').attr('stroke-width', 1.1)
        .attr('opacity', 0.35);

      g.append('path').datum(cmpNorm).attr('d', lineN)
        .attr('fill', 'none').attr('stroke', '#9CC4E4').attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '4,3').attr('opacity', 0.9);

      // Legend
      const lg = g.append('g').attr('transform', `translate(${innerW - 130}, 4)`);
      lg.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 5).attr('y2', 5)
        .attr('stroke', '#F0D080').attr('stroke-width', 1.1);
      lg.append('text').attr('x', 18).attr('y', 8)
        .attr('fill', '#A89878').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
        .text(`Current · ${range}`);
      lg.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 19).attr('y2', 19)
        .attr('stroke', '#9CC4E4').attr('stroke-width', 1.4).attr('stroke-dasharray', '4,3');
      lg.append('text').attr('x', 18).attr('y', 22)
        .attr('fill', '#A89878').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
        .text(`${fromMonth} → ${toMonth}`);
    }
  }, [data, innerW, innerH, compareOn, compareSlice, fromMonth, toMonth, range]);

  return (
    <div className="card side-card" data-anim="secondary">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Close</span> · Trend</h3>
          <span className="card-eyebrow">Range · {range}</span>
        </div>
        <button
          type="button"
          className={`bb-toggle ${compareOn ? 'active' : ''}`}
          onClick={() => setCompareOn((v) => !v)}
          aria-pressed={compareOn}
          title="Compare a second window (normalized to 100)"
        >
          Compare
        </button>
      </div>
      {compareOn && (
        <div className="compare-controls" role="group" aria-label="Compare window">
          <label className="compare-label">
            <span>From</span>
            <input
              type="month"
              value={fromMonth}
              min={minMonth}
              max={maxMonth}
              onChange={(e) => setFromMonth(clampMonth(e.target.value, minMonth, maxMonth))}
            />
          </label>
          <label className="compare-label">
            <span>To</span>
            <input
              type="month"
              value={toMonth}
              min={minMonth}
              max={maxMonth}
              onChange={(e) => setToMonth(clampMonth(e.target.value, minMonth, maxMonth))}
            />
          </label>
        </div>
      )}
      <p className="sr-only">
        {data.length
          ? `Closing price over ${range}, latest ${fmtPrice(data[data.length - 1].close)}.`
          : 'Closing price unavailable.'}
      </p>
      <div className="side-card-body" ref={boxRef}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={`Closing price line over ${range}`}
        />
      </div>
    </div>
  );
}
