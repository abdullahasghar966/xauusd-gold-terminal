# XAUUSD Gold Intelligence Terminal

A single-page React dashboard visualising 2,846 daily XAUUSD records (2015 – 2026) in the
aesthetic of a private Swiss wealth terminal: deep obsidian background, molten gold accents,
Playfair Display + JetBrains Mono typography, orchestrated entrance choreography.

## Run

```
npm install
npm run dev      # vite on :5173
npm test         # vitest run (jsdom)
```

Or double-click `dev.cmd` (sets the cwd, runs `npm run dev`).

The CSV (`public/Gold_Data.csv`) is fetched at runtime — no build step needed when
the data refreshes; just replace the file.

**Multi-asset** — drop additional Yahoo-style CSVs into `public/` named
`Silver_Data.csv`, `Platinum_Data.csv`, `BTCUSD_Data.csv`. They're auto-detected
on load (HEAD probe + content sniff) and surface in the header asset switcher.
Any custom asset works via `loadCsv(url, schema?)` in `src/lib/data.js`.

**Live feed** — set `VITE_LIVE_FEED_URL=wss://your-feed` and `useLiveTick` will
subscribe over WebSocket, parsing `{ price }` / `{ p }` / `{ last }` / `{ c }`
shapes or raw numeric payloads. On disconnect or error, it falls back to the
simulated ±0.3 % drift. Pass `parseTick` via the hook options for custom feeds.

## Stack

| Lib | Why it's here |
|---|---|
| **Vite** | Dev server + HMR; ESM-native, ~1s cold start. |
| **React 18** | Component model, state for live tick + range selector. StrictMode is on. |
| **D3 v7** | Scales (`scaleBand`/`scaleLinear`/`scaleTime`), path/area/line generators, color interpolators for the seasonality heatmap. We do **not** use D3's `enter().transition()` — animations are orchestrated by GSAP so they slot into the unified entrance timeline. |
| **GSAP** | Orchestrated entrance sequence (`useEntranceTimeline.js`) and per-element entrances (candle drop-in, MA path draw-in, volume bar grow). Every tween uses `immediateRender: false` — see *Animation strategy* below. |
| **Framer Motion** | Hover micro-interactions on KPI cards (`whileHover` spring) only. Not used for the entrance timeline. |
| **Papa Parse** | Robust CSV parsing, used to skip Yahoo's 3-row prelude (`Price,Close,…` / `Ticker,GC=F,…` / `Date,,,,,`). |
| **Lucide React** | Stroke-based SVG icons (Sparkles, Crown, Activity, Gauge, ArrowUp/Down, ArrowUpDown). Consistent 1.4–1.8 stroke weight throughout. |
| **Google Fonts** | Playfair Display (display, italic), JetBrains Mono (data), Cormorant Garamond (loading mark). Loaded once via `<link>` in `index.html`. |

## File map

```
public/Gold_Data.csv             # raw OHLCV data, 2015-01-02 → 2026-04-24
src/
  main.jsx                       # ReactDOM root
  App.jsx                        # orchestrator: load → render → entrance → live tick
  App.css                        # row layouts, loading/error screens
  styles/globals.css             # ALL design tokens, base, shimmer, flash, scrollbar
  lib/
    data.js                      # CSV loader + indicators (sma, ytdReturn, ath, range52w,
                                 #   realisedVol, annualReturns, monthlySeasonality,
                                 #   crossoverSignals, rangeSlice, lastN)
    format.js                    # fmtPrice, fmtPct, fmtNum, fmtVol, fmtDate, fmtTime
  hooks/
    useEntranceTimeline.js       # GSAP timeline keyed off [data-anim="..."] selectors
    useCountUp.js                # setInterval-based numeric tween, tweens from current
                                 #   value (not 0) on subsequent updates
    useLiveTick.js               # setInterval every 4s, ±0.3% drift, returns {price,prev,dir,n}
    useResizeObserver.js         # ResizeObserver → {width,height} for chart sizing
  components/
    layout/
      Header.jsx + .css          # Logo title, live price, market badge, UTC clock
      Ticker.jsx + .css          # CSS marquee scrolling price tape
      Footer.jsx + .css          # Source / Window / Records / Updated
    ambient/
      ParticleField.jsx          # 28 gold particles on a fixed canvas
      GridBackdrop.jsx           # SVG grid + gradient mesh + animated scan line
    KpiStrip.jsx + .css          # 6 cards: Spot, 24h, YTD, ATH, 52w Range, Volatility
    DataTable.jsx + .css         # Last 30 days, sortable, hover gold-wash
    charts/
      CandlestickChart.jsx + .css   # Primary chart with 1M..ALL ranges + crosshair tooltip
      PriceLineChart.jsx            # Close trend with golden glow
      VolumeBars.jsx                # Daily volume bars
      AnnualReturns.jsx             # Per-year close-to-close returns, gold/red gradient
      SeasonalityHeatmap.jsx        # year × month, diverging color scale
      MaCrossover.jsx               # MA50 vs MA200 + golden/death cross markers
      SidePanel.css                 # shared chrome for the side cards
      Heatmap.css                   # heatmap tooltip
```

## Data pipeline

```
public/Gold_Data.csv
  └─→ loadGoldData()                     // Papa.parse, skip header rows by regex
        └─→ rows: [{date,open,high,low,close,volume}]   // sorted asc by date
              ├─→ dayChange()           // last vs prior close
              ├─→ ytdReturn()           // first-of-year vs last
              ├─→ allTimeHigh()         // max high across full set
              ├─→ range52w()            // low/high/position
              ├─→ realisedVol(30)       // annualized σ of log returns
              ├─→ sma(50) / sma(200)    // moving averages
              ├─→ annualReturns()       // by calendar year
              ├─→ monthlySeasonality()  // year × month grid
              ├─→ crossoverSignals()    // golden/death cross detection
              └─→ rangeSlice(key)       // 1M / 3M / 6M / 1Y / 5Y / ALL
```

`rows` is computed once on mount; per-chart slices and indicators are memoised per
component via `useMemo`.

## Animation strategy — IMPORTANT

There is a non-obvious correctness rule throughout this codebase:

> **Every animated element must render at its FINAL visible state by default,
> and entrance tweens must use `immediateRender: false`.**

Why: in some renderers (background tabs, headless preview, throttled tabs)
`requestAnimationFrame` doesn't fire promptly, which means GSAP's ticker
doesn't advance. With normal `gsap.fromTo({opacity:0}, {opacity:1})`, the FROM
state is applied synchronously when the tween is created — if the ticker
never advances, the element is permanently invisible. With `gsap.from(...,
{immediateRender: false})`, the FROM state is only applied when the tween
actually starts; if it never starts, the element stays at its CSS default.

Concretely:
- D3 element creation sets the **final** attrs (e.g. volume bar gets `y=y(d.volume)` and
  `height=innerH-y(d.volume)`, candle gets `opacity=1`).
- GSAP entrance is added on top with `gsap.from(node, { ...fromState, immediateRender: false })`.
- `useEntranceTimeline.js` does the same for the `[data-anim]` orchestration.

**KPI counters** use `setInterval` (not `requestAnimationFrame`) for the same reason
(`hooks/useCountUp.js`).

When adding a new chart or animated section, follow the same pattern.

## Design tokens (`src/styles/globals.css`)

- **Surfaces**: `--obsidian-{0..5}` (deepest to lightest neutrals).
- **Gold scale**: `--gold-{50..900}`, signature is `--gold-500: #C9A84C`.
- **Sentiment**: `--bull` (gold) / `--bear` (#C0392B). Always pair with an arrow ▲▼ glyph,
  never colour alone (a11y).
- **Type**: `--font-display` (Playfair Display, italic for accents), `--font-mono`
  (JetBrains Mono, all numerics use `font-variant-numeric: tabular-nums`).
- **Motion**: `--ease-out-quart`, `--ease-spring`. `prefers-reduced-motion` is honoured globally.

## Adding new content

**A new KPI card** → add a `<KpiCard>` in `src/components/KpiStrip.jsx`, pass
`accent="gold"|"crimson"|"bronze"`, give it a `delay` ~0.05s after the previous one.
If it has a numeric value, use `useCountUp(value, { delay, format })`.

**A new chart** → start from `src/components/charts/PriceLineChart.jsx` as the simplest
template. Wrap in `<div className="card side-card" data-anim="secondary">` so the entrance
timeline picks it up. Always set elements to final state then use `gsap.from(... immediateRender:false)`.

**A new range** → extend `RANGES` in `CandlestickChart.jsx` and the `map` inside
`rangeSlice()` in `lib/data.js`.

## Layout

- 6-column KPI strip at top, collapses to 3 then 2 below 1280 / 720px.
- Main row 60/40 (candlestick / line+volume), collapses to 1-col below 1100px.
- Second row 3-col (annual / heatmap / crossover), collapses to 1-col below 1100px.
- Data table is full-width with sticky header.
- Particle canvas + grid backdrop are `position: fixed` z-index 0; everything else is z-index 1+.

## Things not to do

- Do not animate `width` / `height` / `top` / `left` — use `transform` and `opacity`.
  (Volume / annual bar entrances animate the SVG `attr` height because there's no
  CSS-transformable equivalent for SVG geometry; this is acceptable inside a self-contained
  SVG and avoids reflowing the page.)
- Do not use emoji as icons. Use Lucide React.
- Do not introduce `Inter` / `Roboto` / generic gradients. The aesthetic is committed.
- Do not add a build step for the CSV — keep it as a runtime fetch from `public/`.
- Do not skip the `immediateRender: false` discipline. See *Animation strategy* above.
