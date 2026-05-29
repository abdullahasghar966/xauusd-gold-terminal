import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { drawdowns } from '../../lib/data.js';
import { fmtPct, fmtDate } from '../../lib/format.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';
import './SidePanel.css';

export default function DrawdownChart({ rows }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);

  const stats = useMemo(() => drawdowns(rows), [rows]);
  const data = stats.series;

  const W = Math.max(280, size.width || 380);
  const H = 240;
  const M = { top: 18, right: 14, bottom: 26, left: 38 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  useEffect(() => {
    if (!data.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'dd-area').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(192,57,43,0.05)');
    grad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(192,57,43,0.45)');

    const x = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, innerW]);
    const yMin = d3.min(data, (d) => d.pct);
    const y = d3.scaleLinear().domain([Math.min(yMin * 1.05, -1), 0]).range([innerH, 0]).nice();
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    const yt = y.ticks(4);
    g.append('g').selectAll('line').data(yt).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(201,168,76,0.06)').attr('stroke-dasharray', '2,4');
    g.append('g').selectAll('text').data(yt).join('text')
      .attr('x', -8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => `${d.toFixed(0)}%`);

    const xt = x.ticks(4);
    g.append('g').attr('transform', `translate(0, ${innerH + 6})`)
      .selectAll('text').data(xt).join('text')
      .attr('x', (d) => x(d)).attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => d3.timeFormat("%b '%y")(d));

    const area = d3.area()
      .x((d) => x(d.date))
      .y0(y(0))
      .y1((d) => y(d.pct))
      .curve(d3.curveMonotoneX);

    const areaPath = g.append('path').datum(data).attr('d', area).attr('fill', 'url(#dd-area)').attr('opacity', 1);

    const line = d3.line().x((d) => x(d.date)).y((d) => y(d.pct)).curve(d3.curveMonotoneX);
    const linePath = g.append('path').datum(data).attr('d', line)
      .attr('fill', 'none').attr('stroke', '#E97266').attr('stroke-width', 1.2)
      .attr('opacity', 0.9);

    // Annotate max drawdown
    const md = stats.maxDrawdown;
    if (md) {
      const cx = x(md.troughDate);
      const cy = y(md.pct);
      g.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', 3.5)
        .attr('fill', '#E97266').attr('stroke', '#0A0A0B').attr('stroke-width', 1.2);
      g.append('text')
        .attr('x', cx).attr('y', cy + 14)
        .attr('text-anchor', cx > innerW / 2 ? 'end' : 'start')
        .attr('fill', '#E97266').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 10)
        .text(`Max ${fmtPct(md.pct, 1)}`);
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      gsap.from(areaPath.node(), { opacity: 0, duration: 0.9, delay: 1.2, immediateRender: false });
      const len = linePath.node().getTotalLength();
      gsap.from(linePath.node(), {
        strokeDasharray: `${len} ${len}`,
        strokeDashoffset: len,
        duration: 1.0, ease: 'power2.inOut', delay: 1.1,
        immediateRender: false,
      });
    }
  }, [data, innerW, innerH, stats]);

  return (
    <div className="card side-card" data-anim="tertiary">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Drawdown</span> · Peak-to-trough</h3>
          <span className="card-eyebrow">
            {stats.maxDrawdown
              ? `Worst ${fmtPct(stats.maxDrawdown.pct, 1)} · ${fmtDate(stats.maxDrawdown.troughDate)}`
              : '—'}
          </span>
        </div>
        <div className={`rsi-readout ${stats.currentDrawdown < -1 ? 'rsi-under' : 'rsi-neutral'}`}>
          {fmtPct(stats.currentDrawdown, 1)}
        </div>
      </div>
      <p className="sr-only">
        {stats.maxDrawdown
          ? `Drawdown from running peak. Worst drawdown ${stats.maxDrawdown.pct.toFixed(
              2,
            )}% on ${fmtDate(stats.maxDrawdown.troughDate)}. Currently ${stats.currentDrawdown.toFixed(2)}%.`
          : 'Drawdown chart unavailable.'}
      </p>
      <div className="side-card-body" ref={boxRef}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={`Drawdown chart, current ${stats.currentDrawdown.toFixed(2)}%`}
        />
      </div>
    </div>
  );
}
