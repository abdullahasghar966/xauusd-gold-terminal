import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { annualReturns } from '../../lib/data.js';
import { fmtPct } from '../../lib/format.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';

export default function AnnualReturns({ rows }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);
  const data = useMemo(() => annualReturns(rows), [rows]);

  const W = Math.max(280, size.width || 380);
  const H = 260;
  const M = { top: 18, right: 14, bottom: 28, left: 36 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  useEffect(() => {
    if (!data.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleBand().domain(data.map((d) => d.year)).range([0, innerW]).paddingInner(0.28);
    const yMax = d3.max(data, (d) => Math.abs(d.return));
    const y = d3.scaleLinear().domain([-yMax * 1.1, yMax * 1.1]).range([innerH, 0]).nice();
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // zero baseline
    g.append('line').attr('x1', 0).attr('x2', innerW)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', 'rgba(201,168,76,0.4)').attr('stroke-dasharray', '3,3');

    // y ticks
    const yt = y.ticks(5);
    g.append('g').selectAll('line').data(yt).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(201,168,76,0.05)').attr('stroke-dasharray', '2,4');
    g.append('g').selectAll('text').data(yt).join('text')
      .attr('x', -8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => `${d > 0 ? '+' : ''}${d.toFixed(0)}%`);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // bars
    g.selectAll('rect.bar').data(data).join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.year))
      .attr('width', x.bandwidth())
      .attr('y', (d) => d.return >= 0 ? y(d.return) : y(0))
      .attr('height', (d) => Math.abs(y(d.return) - y(0)))
      .attr('rx', Math.min(2, x.bandwidth() / 4))
      .attr('fill', (d) => d.return >= 0 ? 'url(#ar-up)' : 'url(#ar-down)')
      .each(function (d, i) {
        if (reduced) return;
        gsap.from(this, {
          attr: { y: y(0), height: 0 },
          duration: 0.7, ease: 'back.out(1.5)',
          delay: 1.0 + i * 0.05,
          immediateRender: false,
        });
      });

    // gradients
    const defs = svg.append('defs');
    const up = defs.append('linearGradient').attr('id', 'ar-up').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    up.append('stop').attr('offset', '0%').attr('stop-color', '#F0D080');
    up.append('stop').attr('offset', '100%').attr('stop-color', '#8B6914');
    const dn = defs.append('linearGradient').attr('id', 'ar-down').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    dn.append('stop').attr('offset', '0%').attr('stop-color', '#8B2418');
    dn.append('stop').attr('offset', '100%').attr('stop-color', '#C0392B');

    // value labels
    g.selectAll('text.lbl').data(data).join('text')
      .attr('class', 'lbl')
      .attr('x', (d) => x(d.year) + x.bandwidth() / 2)
      .attr('y', (d) => d.return >= 0 ? y(d.return) - 4 : y(d.return) + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => d.return >= 0 ? '#F0D080' : '#E97266')
      .attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9.5).attr('font-weight', 600)
      .text((d) => fmtPct(d.return, 1))
      .attr('opacity', 1)
      .each(function (_, i) {
        if (reduced) return;
        gsap.from(this, { opacity: 0, duration: 0.3, delay: 1.5 + i * 0.05, immediateRender: false });
      });

    // x labels
    g.append('g').attr('transform', `translate(0, ${innerH + 8})`)
      .selectAll('text').data(data).join('text')
      .attr('x', (d) => x(d.year) + x.bandwidth() / 2).attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 10)
      .text((d) => `'${String(d.year).slice(2)}`);
  }, [data, innerW, innerH]);

  return (
    <div className="card side-card" data-anim="secondary">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Annual</span> · Returns</h3>
          <span className="card-eyebrow">{data[0]?.year}–{data[data.length - 1]?.year}</span>
        </div>
      </div>
      <p className="sr-only">
        {data.length
          ? `Annual returns from ${data[0].year} to ${data[data.length - 1].year}. Latest year ${data[data.length - 1].year} returned ${fmtPct(data[data.length - 1].return)}.`
          : 'No annual returns available.'}
      </p>
      <div className="side-card-body" ref={boxRef}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={
            data.length
              ? `Annual returns chart, ${data[0].year} to ${data[data.length - 1].year}`
              : 'Annual returns chart'
          }
        />
      </div>
    </div>
  );
}
