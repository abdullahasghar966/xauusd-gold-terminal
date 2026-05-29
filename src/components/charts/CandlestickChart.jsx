import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import gsap from 'gsap';
import { fmtPrice, fmtNum, fmtDate, fmtVol } from '../../lib/format.js';
import { sma, rangeSlice, bollinger } from '../../lib/data.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';
import './CandlestickChart.css';

const RANGES = ['1M', '3M', '6M', '1Y', '5Y', 'ALL'];

export default function CandlestickChart({ rows }) {
  const [range, setRange] = useState('1Y');
  const [showBands, setShowBands] = useState(false);
  const [hover, setHover] = useState(null);
  const [boxRef, size] = useResizeObserver();
  const svgRef = useRef(null);
  const gWrapRef = useRef(null);
  const tooltipRef = useRef(null);

  // Filter the visible window
  const visible = useMemo(() => rangeSlice(rows, range), [rows, range]);
  // MAs computed over the FULL series so the line continues even when zoomed in
  const ma50Full = useMemo(() => sma(rows, 50), [rows]);
  const ma200Full = useMemo(() => sma(rows, 200), [rows]);
  const bbFull = useMemo(() => bollinger(rows, 20, 2), [rows]);
  // Map indicators onto the visible slice by date alignment
  const visMa50 = useMemo(() => {
    const fromIndex = rows.length - visible.length;
    return ma50Full.slice(fromIndex);
  }, [ma50Full, rows, visible]);
  const visMa200 = useMemo(() => {
    const fromIndex = rows.length - visible.length;
    return ma200Full.slice(fromIndex);
  }, [ma200Full, rows, visible]);
  const visBb = useMemo(() => {
    const fromIndex = rows.length - visible.length;
    return {
      upper: bbFull.upper.slice(fromIndex),
      middle: bbFull.middle.slice(fromIndex),
      lower: bbFull.lower.slice(fromIndex),
    };
  }, [bbFull, rows, visible]);

  const W = Math.max(420, size.width || 800);
  const H = 460;
  const M = { top: 18, right: 60, bottom: 30, left: 14 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  // Scales
  const { x, y, candleW } = useMemo(() => {
    if (!visible.length) return { x: null, y: null, candleW: 4 };
    const x = d3.scaleBand()
      .domain(visible.map((d, i) => i))
      .range([0, innerW])
      .paddingInner(0.28)
      .paddingOuter(0.1);
    const yMin = d3.min(visible, (d) => d.low);
    const yMax = d3.max(visible, (d) => d.high);
    const pad = (yMax - yMin) * 0.06;
    const y = d3.scaleLinear()
      .domain([yMin - pad, yMax + pad])
      .nice()
      .range([innerH, 0]);
    return { x, y, candleW: Math.max(1.5, x.bandwidth()) };
  }, [visible, innerW, innerH]);

  // Render
  useEffect(() => {
    if (!x || !y || !visible.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'cs-bg').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(201,168,76,0.06)');
    grad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0)');

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
    gWrapRef.current = g.node();

    // background plot wash
    g.append('rect').attr('width', innerW).attr('height', innerH).attr('fill', 'url(#cs-bg)');

    // y gridlines
    const yTicks = y.ticks(6);
    g.append('g').attr('class', 'cs-grid')
      .selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(201,168,76,0.08)')
      .attr('stroke-dasharray', '2,4');

    // y axis labels (right)
    g.append('g').attr('class', 'cs-axis-y')
      .attr('transform', `translate(${innerW}, 0)`)
      .selectAll('text').data(yTicks).join('text')
      .attr('x', 8).attr('y', (d) => y(d))
      .attr('dy', '0.32em')
      .attr('fill', '#7A7060')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 10)
      .text((d) => fmtPrice(d, 0));

    // x axis (date ticks at roughly 6 positions)
    const tickStep = Math.max(1, Math.floor(visible.length / 7));
    const xTickIdx = visible.map((_, i) => i).filter((i) => i % tickStep === 0);
    g.append('g').attr('class', 'cs-axis-x')
      .attr('transform', `translate(0, ${innerH + 6})`)
      .selectAll('text').data(xTickIdx).join('text')
      .attr('x', (i) => x(i) + x.bandwidth() / 2)
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7A7060')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 10)
      .text((i) => fmtDate(visible[i].date, { month: 'short', year: '2-digit' }));

    // candles
    const wicks = g.append('g').attr('class', 'cs-wicks');
    const bodies = g.append('g').attr('class', 'cs-bodies');

    visible.forEach((d, i) => {
      const up = d.close >= d.open;
      const xPos = x(i) + x.bandwidth() / 2;
      const bx = x(i);
      const bw = x.bandwidth();
      const oy = y(d.open);
      const cy = y(d.close);
      const top = Math.min(oy, cy);
      const bh = Math.max(1, Math.abs(cy - oy));
      const fill = up ? '#C9A84C' : '#C0392B';
      const stroke = up ? '#F0D080' : '#E97266';

      const wick = wicks.append('line')
        .attr('x1', xPos).attr('x2', xPos)
        .attr('y1', y(d.high)).attr('y2', y(d.low))
        .attr('stroke', stroke)
        .attr('stroke-width', 1)
        .attr('opacity', 0.9);

      const body = bodies.append('rect')
        .attr('x', bx)
        .attr('y', top)
        .attr('width', bw)
        .attr('height', bh)
        .attr('rx', Math.min(1.4, bw / 2))
        .attr('fill', fill)
        .attr('stroke', stroke)
        .attr('stroke-width', 0.7)
        .attr('opacity', 1);

      if (!reduced) {
        const delay = 0.6 + (i / Math.max(visible.length, 1)) * 0.45;
        gsap.fromTo(body.node(),
          { y: -innerH * 0.35, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, ease: 'elastic.out(0.7, 0.7)', delay, immediateRender: false }
        );
        gsap.fromTo(wick.node(),
          { opacity: 0 },
          { opacity: 0.9, duration: 0.35, delay: delay + 0.1, immediateRender: false }
        );
      }
    });

    // Moving averages
    const lineFn = d3.line()
      .defined((_, i) => visMa50[i] != null)
      .x((_, i) => x(i) + x.bandwidth() / 2)
      .y((_, i) => y(visMa50[i]))
      .curve(d3.curveMonotoneX);

    const line200 = d3.line()
      .defined((_, i) => visMa200[i] != null)
      .x((_, i) => x(i) + x.bandwidth() / 2)
      .y((_, i) => y(visMa200[i]))
      .curve(d3.curveMonotoneX);

    const p50 = g.append('path')
      .datum(visible)
      .attr('class', 'ma-line ma-50')
      .attr('d', lineFn)
      .attr('fill', 'none')
      .attr('stroke', '#F0D080')
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '5,4')
      .attr('opacity', 0.95);

    const p200 = g.append('path')
      .datum(visible)
      .attr('class', 'ma-line ma-200')
      .attr('d', line200)
      .attr('fill', 'none')
      .attr('stroke', '#8B6914')
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '2,5')
      .attr('opacity', 0.95);

    if (!reduced) {
      [p50, p200].forEach((p, idx) => {
        const total = p.node().getTotalLength();
        // animate via gsap.from so initial state is only applied when the tween starts
        gsap.from(p.node(), {
          strokeDasharray: `${total} ${total}`,
          strokeDashoffset: total,
          duration: 1.2,
          ease: 'power2.inOut',
          delay: 1.0 + idx * 0.15,
          immediateRender: false,
        });
      });
    }

    // Bollinger Bands (optional)
    if (showBands) {
      const bbArea = d3.area()
        .defined((_, i) => visBb.upper[i] != null && visBb.lower[i] != null)
        .x((_, i) => x(i) + x.bandwidth() / 2)
        .y0((_, i) => y(visBb.upper[i]))
        .y1((_, i) => y(visBb.lower[i]))
        .curve(d3.curveMonotoneX);

      g.insert('path', '.cs-wicks')
        .datum(visible)
        .attr('class', 'bb-area')
        .attr('d', bbArea)
        .attr('fill', 'rgba(201,168,76,0.07)');

      const bbLine = (key, stroke, dash, width) => {
        const ln = d3.line()
          .defined((_, i) => visBb[key][i] != null)
          .x((_, i) => x(i) + x.bandwidth() / 2)
          .y((_, i) => y(visBb[key][i]))
          .curve(d3.curveMonotoneX);
        g.append('path')
          .datum(visible)
          .attr('class', `bb-line bb-${key}`)
          .attr('d', ln)
          .attr('fill', 'none')
          .attr('stroke', stroke)
          .attr('stroke-width', width)
          .attr('stroke-dasharray', dash)
          .attr('opacity', 0.78);
      };
      bbLine('upper', '#C9A84C', '1,4', 1);
      bbLine('lower', '#C9A84C', '1,4', 1);
      bbLine('middle', '#A89878', '4,3', 1);
    }

    // legend
    const legend = g.append('g').attr('class', 'cs-legend').attr('transform', `translate(8, 8)`);
    const items = [
      { label: 'MA 50', dash: '5,4', color: '#F0D080' },
      { label: 'MA 200', dash: '2,5', color: '#8B6914' },
    ];
    items.forEach((it, i) => {
      const grp = legend.append('g').attr('transform', `translate(${i * 92}, 0)`);
      grp.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 6).attr('y2', 6)
        .attr('stroke', it.color).attr('stroke-width', 1.4).attr('stroke-dasharray', it.dash);
      grp.append('text').attr('x', 24).attr('y', 9)
        .attr('fill', '#A89B7A').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 10)
        .text(it.label);
    });

    // crosshair + hover
    const cross = g.append('g').attr('class', 'cs-cross').style('display', 'none');
    cross.append('line').attr('class', 'cs-cross-v').attr('y1', 0).attr('y2', innerH)
      .attr('stroke', 'rgba(240,208,128,0.45)').attr('stroke-dasharray', '2,3');
    cross.append('line').attr('class', 'cs-cross-h').attr('x1', 0).attr('x2', innerW)
      .attr('stroke', 'rgba(240,208,128,0.45)').attr('stroke-dasharray', '2,3');

    const overlay = g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    const updateFromPointer = (mx, my) => {
      const step = x.step();
      const idx = Math.max(0, Math.min(visible.length - 1, Math.round(mx / step)));
      const d = visible[idx];
      if (!d) return;
      const xc = x(idx) + x.bandwidth() / 2;
      cross.style('display', null);
      cross.select('.cs-cross-v').attr('x1', xc).attr('x2', xc);
      cross.select('.cs-cross-h').attr('y1', my).attr('y2', my);
      setHover({ d, mx: xc + M.left, my: my + M.top, idx });
    };

    overlay.on('mousemove', (event) => {
      const [mx, my] = d3.pointer(event);
      updateFromPointer(mx, my);
    });
    overlay.on('mouseleave', () => {
      cross.style('display', 'none');
      setHover(null);
    });

    // Touch — pin tooltip on tap, drag-track on touchmove
    overlay.on('touchstart', (event) => {
      event.preventDefault();
      const t = event.touches?.[0];
      if (!t) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = svgRef.current.viewBox?.baseVal?.width
        ? svgRef.current.viewBox.baseVal.width / rect.width
        : 1;
      const mx = (t.clientX - rect.left) * scaleX - M.left;
      const my = (t.clientY - rect.top) * scaleX - M.top;
      updateFromPointer(mx, my);
    }, { passive: false });
    overlay.on('touchmove', (event) => {
      event.preventDefault();
      const t = event.touches?.[0];
      if (!t) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = svgRef.current.viewBox?.baseVal?.width
        ? svgRef.current.viewBox.baseVal.width / rect.width
        : 1;
      const mx = (t.clientX - rect.left) * scaleX - M.left;
      const my = (t.clientY - rect.top) * scaleX - M.top;
      updateFromPointer(mx, my);
    }, { passive: false });
  }, [visible, x, y, innerW, innerH, visMa50, visMa200, visBb, showBands]);

  return (
    <div className="card primary-chart" data-anim="primary-chart">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">XAUUSD</span> · Price Action</h3>
          <span className="card-eyebrow">Candlestick · OHLC</span>
        </div>
        <div className="chart-controls">
          <button
            type="button"
            className={`bb-toggle ${showBands ? 'active' : ''}`}
            onClick={() => setShowBands((v) => !v)}
            aria-pressed={showBands}
            title="Bollinger Bands (20, 2σ)"
          >
            BB
          </button>
          <div className="range-group" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`range-btn ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="sr-only">
        {visible.length
          ? `Candlestick chart of ${visible.length} sessions over ${range}. Latest close ${fmtPrice(
              visible[visible.length - 1].close,
            )} on ${fmtDate(visible[visible.length - 1].date)}.`
          : 'Candlestick chart unavailable.'}
      </p>
      <div className="primary-chart-body" ref={boxRef} onTouchEnd={() => { /* keep tooltip pinned */ }}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={
            visible.length
              ? `Candlestick chart, range ${range}, latest close ${fmtPrice(
                  visible[visible.length - 1].close,
                )}`
              : 'Candlestick chart'
          }
        />
        {hover && (
          <div
            ref={tooltipRef}
            className="cs-tooltip"
            style={{
              left: Math.min(W - 220, Math.max(8, hover.mx + 14)),
              top: Math.max(8, hover.my - 12),
            }}
          >
            <div className="cs-tt-date">{fmtDate(hover.d.date)}</div>
            <div className="cs-tt-grid">
              <span>Open</span><span className="mono">{fmtPrice(hover.d.open)}</span>
              <span>High</span><span className="mono" style={{ color: 'var(--gold-200)' }}>{fmtPrice(hover.d.high)}</span>
              <span>Low</span><span className="mono" style={{ color: '#E97266' }}>{fmtPrice(hover.d.low)}</span>
              <span>Close</span><span className="mono" style={{ color: hover.d.close >= hover.d.open ? 'var(--gold-300)' : '#E97266' }}>{fmtPrice(hover.d.close)}</span>
              <span>Volume</span><span className="mono">{fmtVol(hover.d.volume)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
