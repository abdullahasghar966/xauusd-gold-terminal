import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { returnsHistogram, autocorrelation } from '../../lib/data.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';
import './SidePanel.css';

export default function ReturnsDistribution({ rows, bins = 36 }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);

  const { bins: hist, mean, stdev } = useMemo(() => returnsHistogram(rows, bins), [rows, bins]);
  const acf = useMemo(() => autocorrelation(rows, [1, 5, 21, 63, 252]), [rows]);

  const W = Math.max(280, size.width || 380);
  const H = 240;
  const M = { top: 18, right: 14, bottom: 36, left: 32 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  useEffect(() => {
    if (!hist.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleLinear()
      .domain([hist[0].x0, hist[hist.length - 1].x1])
      .range([0, innerW]);
    const yMax = d3.max(hist, (d) => d.count);
    const y = d3.scaleLinear().domain([0, yMax * 1.05]).range([innerH, 0]);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // Mean reference
    g.append('line')
      .attr('x1', x(mean)).attr('x2', x(mean))
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', 'rgba(201,168,76,0.5)').attr('stroke-dasharray', '3,3');

    // Bars
    const w = (innerW / hist.length) - 1;
    g.selectAll('rect.bar').data(hist).join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.x0))
      .attr('width', Math.max(1, w))
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => innerH - y(d.count))
      .attr('fill', (d) => (d.x0 + d.x1) / 2 >= 0 ? 'rgba(201,168,76,0.7)' : 'rgba(192,57,43,0.7)')
      .each(function (_, i) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;
        gsap.from(this, {
          attr: { y: innerH, height: 0 },
          duration: 0.5, ease: 'power2.out',
          delay: 1.15 + i * 0.01,
          immediateRender: false,
        });
      });

    // Bell curve overlay
    if (stdev > 0) {
      const pts = [];
      const samples = 80;
      const span = x.domain();
      for (let i = 0; i <= samples; i++) {
        const xv = span[0] + ((span[1] - span[0]) * i) / samples;
        const z = (xv - mean) / stdev;
        const pdf = Math.exp(-0.5 * z * z) / (stdev * Math.sqrt(2 * Math.PI));
        pts.push({ x: xv, y: pdf });
      }
      const yMaxPdf = d3.max(pts, (d) => d.y) || 1;
      const yScale = d3.scaleLinear().domain([0, yMaxPdf]).range([innerH, 0]);
      const line = d3.line().x((d) => x(d.x)).y((d) => yScale(d.y)).curve(d3.curveMonotoneX);
      g.append('path').datum(pts).attr('d', line)
        .attr('fill', 'none').attr('stroke', '#F0D080').attr('stroke-width', 1.2)
        .attr('opacity', 0.65)
        .attr('stroke-dasharray', '4,3');
    }

    // X axis (returns in %)
    const xt = x.ticks(5);
    g.append('g').attr('transform', `translate(0, ${innerH + 6})`)
      .selectAll('text').data(xt).join('text')
      .attr('x', (d) => x(d)).attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => `${(d * 100).toFixed(1)}%`);

    // μ/σ readout
    g.append('text')
      .attr('x', innerW).attr('y', 0).attr('dy', '0.6em')
      .attr('text-anchor', 'end')
      .attr('fill', '#A89878').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9.5)
      .text(`μ ${(mean * 100).toFixed(3)}%  σ ${(stdev * 100).toFixed(2)}%`);
  }, [hist, innerW, innerH, mean, stdev]);

  return (
    <div className="card side-card" data-anim="tertiary">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Returns</span> · Distribution</h3>
          <span className="card-eyebrow">
            Daily log returns · n {rows.length - 1}
          </span>
        </div>
      </div>
      <p className="sr-only">
        {hist.length
          ? `Histogram of daily log returns. Mean ${(mean * 100).toFixed(3)} percent, standard deviation ${(stdev * 100).toFixed(2)} percent.`
          : 'No return data available.'}
      </p>
      <div className="side-card-body" ref={boxRef}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={`Returns distribution histogram with bell-curve overlay. Mean ${(mean * 100).toFixed(3)}%, σ ${(stdev * 100).toFixed(2)}%.`}
        />
      </div>
      <div className="acf-strip" aria-label="Autocorrelation by lag">
        {acf.map(({ lag, value }) => (
          <div key={lag} className="acf-pill">
            <div className="acf-lag">{lag}d</div>
            <div className={`acf-val ${value >= 0 ? 'pos' : 'neg'}`}>
              {value >= 0 ? '+' : ''}{value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
