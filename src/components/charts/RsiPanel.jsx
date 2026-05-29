import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { rangeSlice, rsi } from '../../lib/data.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';
import './SidePanel.css';

export default function RsiPanel({ rows, range = '1Y', period = 14 }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);

  const data = useMemo(() => {
    const slice = rangeSlice(rows, range);
    const values = rsi(slice, period);
    return slice
      .map((r, i) => ({ date: r.date, value: values[i] }))
      .filter((d) => d.value != null);
  }, [rows, range, period]);

  const W = Math.max(280, size.width || 380);
  const H = 240;
  const M = { top: 18, right: 14, bottom: 26, left: 32 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const last = data.length ? data[data.length - 1].value : null;
  const tone =
    last == null ? 'neutral' : last >= 70 ? 'over' : last <= 30 ? 'under' : 'neutral';

  useEffect(() => {
    if (!data.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // Overbought / oversold bands
    g.append('rect')
      .attr('x', 0).attr('width', innerW)
      .attr('y', y(70)).attr('height', y(100) - y(70) || 0)
      .attr('fill', 'rgba(192,57,43,0.07)');
    g.append('rect')
      .attr('x', 0).attr('width', innerW)
      .attr('y', y(30)).attr('height', y(0) - y(30) || 0)
      .attr('fill', 'rgba(201,168,76,0.06)');

    // Reference lines
    for (const ref of [30, 50, 70]) {
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', y(ref)).attr('y2', y(ref))
        .attr('stroke', ref === 50 ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.18)')
        .attr('stroke-dasharray', ref === 50 ? '2,4' : '3,3');
      g.append('text')
        .attr('x', innerW - 2).attr('y', y(ref) - 3)
        .attr('text-anchor', 'end')
        .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
        .text(ref);
    }

    // Y axis labels (0/50/100)
    g.append('g').selectAll('text').data([0, 50, 100]).join('text')
      .attr('x', -8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => d);

    // X axis ticks
    const xt = x.ticks(4);
    g.append('g').attr('transform', `translate(0, ${innerH + 6})`)
      .selectAll('text').data(xt).join('text')
      .attr('x', (d) => x(d)).attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => d3.timeFormat("%b '%y")(d));

    // Line
    const line = d3.line().x((d) => x(d.date)).y((d) => y(d.value)).curve(d3.curveMonotoneX);
    const path = g.append('path').datum(data).attr('d', line)
      .attr('fill', 'none').attr('stroke', '#F0D080').attr('stroke-width', 1.6)
      .attr('filter', 'drop-shadow(0 0 4px rgba(240,208,128,0.35))');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      const len = path.node().getTotalLength();
      gsap.from(path.node(), {
        strokeDasharray: `${len} ${len}`,
        strokeDashoffset: len,
        duration: 1.1, ease: 'power2.inOut', delay: 1.1,
        immediateRender: false,
      });
    }

    // Last marker
    const lastPt = data[data.length - 1];
    g.append('circle')
      .attr('cx', x(lastPt.date)).attr('cy', y(lastPt.value))
      .attr('r', 3).attr('fill', '#F0D080')
      .attr('stroke', '#0A0A0B').attr('stroke-width', 1.5);
  }, [data, innerW, innerH]);

  return (
    <div className="card side-card" data-anim="tertiary">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">RSI</span> · {period}d</h3>
          <span className="card-eyebrow">Range · {range}</span>
        </div>
        <div className={`rsi-readout rsi-${tone}`}>
          {last == null ? '—' : last.toFixed(1)}
        </div>
      </div>
      <p className="sr-only">
        {data.length
          ? `Relative Strength Index over ${range}. Latest value ${last?.toFixed(1)} — ${
              tone === 'over' ? 'overbought' : tone === 'under' ? 'oversold' : 'neutral'
            }.`
          : 'No RSI data available.'}
      </p>
      <div className="side-card-body" ref={boxRef}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={`RSI ${period}-day, latest ${last == null ? 'unavailable' : last.toFixed(1)}`}
        />
      </div>
    </div>
  );
}
