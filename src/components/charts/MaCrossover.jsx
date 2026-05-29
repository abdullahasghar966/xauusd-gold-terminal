import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { sma, crossoverSignals } from '../../lib/data.js';
import { fmtDate } from '../../lib/format.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';

export default function MaCrossover({ rows }) {
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);

  const { ma50, ma200, signals } = useMemo(() => {
    const ma50 = sma(rows, 50);
    const ma200 = sma(rows, 200);
    const signals = crossoverSignals(rows, ma50, ma200);
    return { ma50, ma200, signals };
  }, [rows]);

  const W = Math.max(280, size.width || 380);
  const H = 260;
  const M = { top: 18, right: 14, bottom: 28, left: 38 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  useEffect(() => {
    if (!rows.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleTime().domain(d3.extent(rows, (d) => d.date)).range([0, innerW]);
    const y = d3.scaleLinear()
      .domain([d3.min(rows, (d) => d.low) * 0.98, d3.max(rows, (d) => d.high) * 1.02])
      .range([innerH, 0]);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // gridlines
    const yt = y.ticks(4);
    g.append('g').selectAll('line').data(yt).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(201,168,76,0.05)').attr('stroke-dasharray', '2,4');
    g.append('g').selectAll('text').data(yt).join('text')
      .attr('x', -8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((d) => `$${d.toFixed(0)}`);

    // price line (subtle)
    const priceLine = d3.line().x((d) => x(d.date)).y((d) => y(d.close)).curve(d3.curveMonotoneX);
    g.append('path').datum(rows).attr('d', priceLine)
      .attr('fill', 'none').attr('stroke', 'rgba(217,207,181,0.18)').attr('stroke-width', 1);

    // MA 50
    const ma50Line = d3.line().defined((_, i) => ma50[i] != null)
      .x((d) => x(d.date)).y((_, i) => y(ma50[i])).curve(d3.curveMonotoneX);
    const p50 = g.append('path').datum(rows).attr('d', ma50Line)
      .attr('fill', 'none').attr('stroke', '#F0D080').attr('stroke-width', 1.6);

    // MA 200
    const ma200Line = d3.line().defined((_, i) => ma200[i] != null)
      .x((d) => x(d.date)).y((_, i) => y(ma200[i])).curve(d3.curveMonotoneX);
    const p200 = g.append('path').datum(rows).attr('d', ma200Line)
      .attr('fill', 'none').attr('stroke', '#8B6914').attr('stroke-width', 1.6);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      [p50, p200].forEach((p, idx) => {
        const len = p.node().getTotalLength();
        gsap.from(p.node(), {
          strokeDasharray: `${len} ${len}`,
          strokeDashoffset: len,
          duration: 1.3, ease: 'power2.inOut',
          delay: 1.0 + idx * 0.15,
          immediateRender: false,
        });
      });
    }

    // signal markers
    const sg = g.append('g').attr('class', 'signals');
    signals.forEach((s, i) => {
      const golden = s.type === 'golden';
      const cx = x(s.date);
      const cy = y(s.price);
      const m = sg.append('g').attr('transform', `translate(${cx}, ${cy})`).attr('opacity', 1);
      m.append('circle').attr('r', 8).attr('fill', golden ? 'rgba(240,208,128,0.18)' : 'rgba(192,57,43,0.2)');
      m.append('circle').attr('r', 3.5).attr('fill', golden ? '#F0D080' : '#C0392B')
        .attr('stroke', '#0A0A0B').attr('stroke-width', 1);
      if (!reduced) gsap.from(m.node(), { opacity: 0, duration: 0.4, delay: 2.0 + i * 0.06, immediateRender: false });
    });

    // legend
    const legend = g.append('g').attr('transform', `translate(0, 4)`);
    const items = [
      { lbl: 'MA50', c: '#F0D080' },
      { lbl: 'MA200', c: '#8B6914' },
      { lbl: 'Golden ×', c: '#F0D080', marker: true },
      { lbl: 'Death ×', c: '#C0392B', marker: true },
    ];
    items.forEach((it, i) => {
      const grp = legend.append('g').attr('transform', `translate(${i * 76}, 0)`);
      if (it.marker) grp.append('circle').attr('cx', 6).attr('cy', 4).attr('r', 3).attr('fill', it.c);
      else grp.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 4).attr('y2', 4).attr('stroke', it.c).attr('stroke-width', 1.5);
      grp.append('text').attr('x', it.marker ? 14 : 18).attr('y', 7).attr('fill', '#A89B7A')
        .attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9).text(it.lbl);
    });

    // x labels
    const tickStep = Math.max(1, Math.floor(rows.length / 6));
    const tickIdx = rows.map((_, i) => i).filter((i) => i % tickStep === 0);
    g.append('g').attr('transform', `translate(0, ${innerH + 8})`)
      .selectAll('text').data(tickIdx).join('text')
      .attr('x', (i) => x(rows[i].date)).attr('y', 12).attr('text-anchor', 'middle')
      .attr('fill', '#7A7060').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 9)
      .text((i) => fmtDate(rows[i].date, { year: 'numeric' }));
  }, [rows, ma50, ma200, signals, innerW, innerH]);

  return (
    <div className="card side-card" data-anim="secondary">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Crossover</span> · MA 50 / 200</h3>
          <span className="card-eyebrow">{signals.length} signals · 2015–present</span>
        </div>
      </div>
      <p className="sr-only">
        {`Moving average 50 versus 200 crossover chart. ${signals.length} crossover signals detected across the full series.`}
      </p>
      <div className="side-card-body" ref={boxRef}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={`MA50 versus MA200 crossover chart with ${signals.length} signals`}
        />
      </div>
    </div>
  );
}
