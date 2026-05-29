import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { rangeSlice } from '../../lib/data.js';
import { fmtVol, fmtDate } from '../../lib/format.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';

export default function VolumeBars({ rows, range = '1Y' }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);
  const data = useMemo(() => rangeSlice(rows, range), [rows, range]);

  const W = Math.max(280, size.width || 360);
  const H = 200;
  const M = { top: 14, right: 14, bottom: 22, left: 36 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  useEffect(() => {
    if (!data.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleBand().domain(data.map((_, i) => i)).range([0, innerW]).paddingInner(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.volume) * 1.1]).range([innerH, 0]);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // baseline
    g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', innerH).attr('y2', innerH)
      .attr('stroke', 'rgba(201,168,76,0.18)');

    // y ticks
    const yt = y.ticks(3);
    g.append('g').selectAll('line').data(yt).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(201,168,76,0.05)').attr('stroke-dasharray', '2,4');
    g.append('g').selectAll('text').data(yt).join('text')
      .attr('x', -8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => fmtVol(d));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    g.selectAll('rect.bar').data(data).join('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(i))
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.volume))
      .attr('height', (d) => innerH - y(d.volume))
      .attr('fill', (d) => d.close >= d.open ? 'rgba(201,168,76,0.55)' : 'rgba(192,57,43,0.55)')
      .attr('rx', Math.min(1.2, x.bandwidth() / 2))
      .each(function (d, i) {
        if (reduced) return;
        gsap.from(this, {
          attr: { y: innerH, height: 0 },
          duration: 0.6,
          ease: 'back.out(1.6)',
          delay: 1.1 + (i / data.length) * 0.3,
          immediateRender: false,
        });
      });

    // x ticks (sparse)
    const step = Math.max(1, Math.floor(data.length / 5));
    const ticks = data.map((_, i) => i).filter((i) => i % step === 0);
    g.append('g').attr('transform', `translate(0, ${innerH + 6})`)
      .selectAll('text').data(ticks).join('text')
      .attr('x', (i) => x(i) + x.bandwidth() / 2).attr('y', 10).attr('text-anchor', 'middle')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((i) => fmtDate(data[i].date, { month: 'short', year: '2-digit' }));
  }, [data, innerW, innerH]);

  return (
    <div className="card side-card" data-anim="tail">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Volume</span> · Daily</h3>
          <span className="card-eyebrow">Contracts traded</span>
        </div>
      </div>
      <p className="sr-only">
        {data.length
          ? `Daily volume bars over ${range}. Latest volume ${fmtVol(data[data.length - 1].volume)} on ${fmtDate(
              data[data.length - 1].date,
            )}.`
          : 'Volume unavailable.'}
      </p>
      <div className="side-card-body" ref={boxRef}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={`Daily volume bars, range ${range}`}
        />
      </div>
    </div>
  );
}
