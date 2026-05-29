# XAUUSD · Gold Intelligence Terminal

A single-page React dashboard visualising 2,846 daily XAUUSD records (2015–2026)
in the aesthetic of a private Swiss wealth terminal: deep obsidian background,
molten gold accents, Playfair Display + JetBrains Mono typography, orchestrated
entrance choreography.

> Live data, six KPIs, eight charts, real-time-feed adapter, PDF/PNG export,
> screen-reader-friendly, touch-usable, 62 unit tests, zero backend.

---

## Quick start

```bash
npm install
npm run dev      # vite on http://localhost:5173
```

Or on Windows, double-click `dev.cmd`.

Other scripts:

```bash
npm test           # vitest run (jsdom)
npm run test:watch # re-run on save
npm run build      # production bundle into dist/
npm run preview    # serve the production build locally
```

The OHLCV CSV (`public/Gold_Data.csv`) is fetched at runtime — no rebuild
needed when the data refreshes; just replace the file.

---

## What's on the screen

| Section | Details |
|---|---|
| **Header** | Asset switcher, live price with ±0.3 % drift (or real WebSocket feed), market-open badge, UTC clock, PNG/PDF export menu |
| **KPI strip** | Spot, 24 h change, YTD return, all-time high, 52-week range, 30 d realised volatility — count-up animated |
| **Candlestick** | OHLC, MA 50 / MA 200, golden/death cross detection, optional Bollinger Bands overlay, 1M / 3M / 6M / 1Y / 5Y / ALL ranges, mouse + touch crosshair tooltip |
| **Trend + Compare** | Close-trend line with golden glow; "Compare" toggle overlays a second user-selected window normalised to 100 |
| **Volume** | Daily traded volume, bull/bear tinted |
| **Annual returns** | Per-calendar-year bar chart |
| **Seasonality** | Year × month return heatmap |
| **Crossover** | MA 50 vs MA 200 with golden/death cross markers |
| **RSI 14 d** | Wilder smoothing, 30/70 reference shading, live readout chip |
| **Drawdown** | Peak-to-trough drawdown area chart with worst-event annotation |
| **Returns distribution** | Daily-log-return histogram with normal-curve overlay + autocorrelation strip (lags 1, 5, 21, 63, 252) |
| **Data table** | Sortable last-30-day OHLCV table |

---

## Stack

| Lib | Why it's here |
|---|---|
| **Vite 5** | Dev server + HMR; ESM-native cold start |
| **React 18** | Component model, StrictMode on |
| **D3 v7** | Scales, generators, color interpolators — but **not** D3 transitions; GSAP owns animations |
| **GSAP** | Orchestrated entrance (`useEntranceTimeline.js`) + per-element tweens. Every tween uses `immediateRender: false` so off-frame renderers don't lock elements at the FROM state |
| **Framer Motion** | KPI-card hover springs only |
| **Papa Parse** | Yahoo-style 3-header-row CSV |
| **Lucide React** | Stroke-based SVG icons |
| **html-to-image + jsPDF** | Lazy-loaded chunks behind the export button |
| **Vitest + RTL** | 62 unit tests across data, format, and live-tick adapter |

---

## Multi-asset

Drop additional Yahoo-style CSVs into `public/` and they appear in the header
switcher automatically:

```
public/
  Gold_Data.csv         ← shipped
  Silver_Data.csv       ← auto-detected
  Platinum_Data.csv     ← auto-detected
  BTCUSD_Data.csv       ← auto-detected
```

Discovery sniffs the first ~200 bytes (not just HTTP status) so Vite's
SPA fallback doesn't spoof matches.

Any custom asset works via the generic loader:

```js
import { loadCsv } from './lib/data.js';
const rows = await loadCsv('/MyAsset.csv', mySchema);
```

---

## Live price feed

By default `useLiveTick` simulates a ±0.3 % drift every 4 s. To wire a real
feed, set:

```bash
# .env.local
VITE_LIVE_FEED_URL=wss://your-feed.example/xauusd
```

The hook subscribes over WebSocket and parses `{ price }`, `{ p }`,
`{ last }`, `{ c }`, raw numbers, or anything you hand it via a custom
`parseTick`. On disconnect or error it transparently falls back to the
simulator — the UI never knows the difference.

```js
const tick = useLiveTick(seed, {
  url: 'wss://...',
  parseTick: (raw) => ({ price: JSON.parse(raw).bid }),
});
```

---

## Accessibility

- Every chart `<svg>` is `role="img"` with a computed `aria-label`
- Every card body carries an `.sr-only` plain-text summary so screen readers
  get the numbers without needing the chart
- Range / Bollinger / Compare toggles use `aria-pressed`
- The live price element is `aria-live="polite"` so updates are announced
- All animations honour `prefers-reduced-motion`
- 44 px minimum touch targets below 720 px wide

---

## Animation strategy (non-obvious)

> Every animated element must render at its **final** visible state by
> default, and entrance tweens must use `immediateRender: false`.

Reason: in some renderers (background tabs, headless preview, throttled
tabs) `requestAnimationFrame` doesn't fire promptly. With normal
`gsap.fromTo({opacity:0}, {opacity:1})` the FROM state is applied
synchronously when the tween is created — if the ticker never advances,
the element is permanently invisible. With `gsap.from(..., {immediateRender:
false})`, the FROM state is only applied when the tween actually starts; if
it never starts, the element stays at its CSS default.

KPI counters use `setInterval` (not RAF) for the same reason.

---

## Project structure

```
public/Gold_Data.csv                     # raw OHLCV
src/
  main.jsx
  App.jsx
  lib/
    data.js                              # CSV loader + indicators
    format.js                            # fmtPrice, fmtPct, fmtNum, fmtVol, fmtDate, fmtTime
    assets.js                            # multi-asset registry + auto-discovery
  hooks/
    useEntranceTimeline.js
    useCountUp.js
    useLiveTick.js                       # simulated drift OR WebSocket adapter
    useResizeObserver.js
  components/
    ErrorBoundary.jsx                    # per-section
    KpiStrip.jsx
    DataTable.jsx
    layout/{Header,Footer,Ticker,AssetSwitcher,ExportButton}.jsx
    ambient/{ParticleField,GridBackdrop}.jsx
    charts/
      CandlestickChart.jsx               # + Bollinger overlay toggle
      PriceLineChart.jsx                 # + Compare window overlay
      VolumeBars.jsx
      AnnualReturns.jsx
      SeasonalityHeatmap.jsx
      MaCrossover.jsx
      RsiPanel.jsx                       # new
      DrawdownChart.jsx                  # new
      ReturnsDistribution.jsx            # new
  styles/globals.css                     # design tokens
  test/setup.js                          # vitest jsdom shims
```

---

## Testing

```bash
npm test
```

Covers every pure function in `lib/data.js` and `lib/format.js`, plus the
WebSocket and simulated branches of `useLiveTick`. Fixtures are tiny
synthetic OHLCV arrays — deterministic and fast.

---

## License

MIT — do what you like with it.
