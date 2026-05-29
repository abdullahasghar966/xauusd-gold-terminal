import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { monthlySeasonality } from '../../lib/data.js';
import { fmtPct } from '../../lib/format.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function SeasonalityHeatmap({ rows }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const { cells, years, months } = useMemo(() => monthlySeasonality(rows), [rows]);

  const W = Math.max(280, size.width || 380);
  const H = 260;
  const M = { top: 18, right: 8, bottom: 22, left: 38 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  useEffect(() => {
    if (!cells.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    const x = d3.scaleBand().domain(months).range([0, innerW]).padding(0.08);
    const y = d3.scaleBand().domain(years).range([0, innerH]).padding(0.08);
    const ext = d3.extent(cells, (d) => d.return);
    const max = Math.max(Math.abs(ext[0]), Math.abs(ext[1]));
    const color = d3.scaleDiverging(d3.interpolateRgbBasis(['#7B1E13', '#1A1A1F', '#F0D080']))
      .domain([-max, 0, max]);

    // year labels
    g.append('g').selectAll('text').data(years).join('text')
      .attr('x', -8).attr('y', (d) => y(d) + y.bandwidth() / 2)
      .attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => `'${String(d).slice(2)}`);

    // month labels
    g.append('g').attr('transform', `translate(0, ${innerH + 6})`)
      .selectAll('text').data(months).join('text')
      .attr('x', (m) => x(m) + x.bandwidth() / 2).attr('y', 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 10)
      .text((m) => MONTHS[m]);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tiles = g.selectAll('rect.tile').data(cells, (d) => `${d.year}-${d.month}`).join('rect')
      .attr('class', 'tile')
      .attr('x', (d) => x(d.month))
      .attr('y', (d) => y(d.year))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('rx', 2)
      .attr('fill', (d) => color(d.return))
      .attr('stroke', 'rgba(0,0,0,0.4)')
      .attr('stroke-width', 0.5)
      .attr('opacity', 1)
      .on('mousemove', (event, d) => {
        const [mx, my] = d3.pointer(event, svg.node());
        setHover({ d, mx, my });
      })
      .on('mouseleave', () => setHover(null));

    if (!reduced) {
      gsap.from(tiles.nodes(), { opacity: 0, duration: 0.5, stagger: 0.003, delay: 1.0, immediateRender: false });
    }
  }, [cells, years, months, innerW, innerH]);

  return (
    <div className="card side-card heatmap-card" data-anim="secondary">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Seasonality</span> · Monthly</h3>
          <span className="card-eyebrow">Returns intensity</span>
        </div>
      </div>
      <p className="sr-only">
        {cells?.length
          ? `Monthly seasonality heatmap covering ${years.length} years and ${months.length} months.`
          : 'Seasonality data unavailable.'}
      </p>
      <div className="side-card-body" ref={boxRef} style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label="Monthly seasonality heatmap, returns intensity by month and year"
        />
        {hover && (
          <div className="heatmap-tooltip"
            style={{ left: Math.min(W - 140, hover.mx + 10), top: Math.max(0, hover.my - 36) }}>
            <div className="ht-date">
              {hover.d.year} · {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][hover.d.month]}
            </div>
            <div className="ht-val mono" style={{ color: hover.d.return >= 0 ? 'var(--gold-200)' : '#E97266' }}>
              {fmtPct(hover.d.return)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
