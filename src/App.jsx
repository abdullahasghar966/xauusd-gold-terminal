import { useEffect, useMemo, useState } from 'react';
import {
  loadCsv,
  dayChange,
  ytdReturn,
  allTimeHigh,
  range52w,
  realisedVol,
  lastN,
} from './lib/data.js';
import { discoverAssets, DEFAULT_ASSET } from './lib/assets.js';
import { useEntranceTimeline } from './hooks/useEntranceTimeline.js';
import { useLiveTick } from './hooks/useLiveTick.js';

import ParticleField from './components/ambient/ParticleField.jsx';
import GridBackdrop from './components/ambient/GridBackdrop.jsx';
import Header from './components/layout/Header.jsx';
import ExportButton from './components/layout/ExportButton.jsx';
import Footer from './components/layout/Footer.jsx';
import KpiStrip from './components/KpiStrip.jsx';
import CandlestickChart from './components/charts/CandlestickChart.jsx';
import PriceLineChart from './components/charts/PriceLineChart.jsx';
import VolumeBars from './components/charts/VolumeBars.jsx';
import AnnualReturns from './components/charts/AnnualReturns.jsx';
import SeasonalityHeatmap from './components/charts/SeasonalityHeatmap.jsx';
import MaCrossover from './components/charts/MaCrossover.jsx';
import RsiPanel from './components/charts/RsiPanel.jsx';
import DrawdownChart from './components/charts/DrawdownChart.jsx';
import ReturnsDistribution from './components/charts/ReturnsDistribution.jsx';
import DataTable from './components/DataTable.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

import './components/layout/Footer.css';
import './components/charts/Heatmap.css';
import './App.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-mark serif">XAUUSD</div>
      <div className="loading-orb"><span /></div>
      <div className="loading-eyebrow">Calibrating gold market intelligence…</div>
    </div>
  );
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [ready, setReady] = useState(false);
  const [asset, setAsset] = useState(DEFAULT_ASSET);
  const [assets, setAssets] = useState([DEFAULT_ASSET]);

  useEffect(() => {
    let alive = true;
    discoverAssets().then((list) => alive && setAssets(list));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setRows([]);
    setReady(false);
    loadCsv(asset.url)
      .then((r) => {
        if (!alive) return;
        setRows(r);
        // wait one tick so the DOM has [data-anim] nodes mounted
        setTimeout(() => alive && setReady(true), 0);
      })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [asset]);

  useEntranceTimeline(ready);

  // Metrics
  const lastClose = rows.length ? rows[rows.length - 1].close : null;
  const tick = useLiveTick(lastClose ?? 0, 4000);

  const metrics = useMemo(() => {
    if (!rows.length) return {};
    return {
      dayChangePct: dayChange(rows),
      ytdPct: ytdReturn(rows),
      ath: allTimeHigh(rows),
      range: range52w(rows),
      vol: realisedVol(rows, 30),
    };
  }, [rows]);

  const tickerRows = useMemo(() => lastN(rows, 32), [rows]);

  if (err) {
    return (
      <div className="error-screen">
        <h2>Data load failed</h2>
        <p>{err}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!rows.length) return <LoadingScreen />;

  // The current "live" price overrides the displayed last close
  const livePrice = tick.price || lastClose;

  return (
    <>
      <GridBackdrop />
      <ParticleField count={28} />

      <ErrorBoundary section="Header">
        <Header
          price={livePrice}
          dayChangePct={metrics.dayChangePct}
          tickerRows={tickerRows}
          tickDir={tick.dir}
          asset={asset}
          assets={assets}
          onAssetChange={setAsset}
          extras={<ExportButton />}
        />
      </ErrorBoundary>

      <main className="shell">
        <ErrorBoundary section="KPI strip">
          <KpiStrip
            price={livePrice}
            dayChangePct={metrics.dayChangePct}
            ytdPct={metrics.ytdPct}
            ath={metrics.ath}
            range={metrics.range}
            vol={metrics.vol}
          />
        </ErrorBoundary>

        <section className="row main-row">
          <ErrorBoundary section="Candlestick chart">
            <CandlestickChart rows={rows} />
          </ErrorBoundary>
          <div className="row side-stack">
            <ErrorBoundary section="Price line">
              <PriceLineChart rows={rows} range="1Y" />
            </ErrorBoundary>
            <ErrorBoundary section="Volume">
              <VolumeBars rows={rows} range="1Y" />
            </ErrorBoundary>
          </div>
        </section>

        <section className="row second-row">
          <ErrorBoundary section="Annual returns">
            <AnnualReturns rows={rows} />
          </ErrorBoundary>
          <ErrorBoundary section="Seasonality">
            <SeasonalityHeatmap rows={rows} />
          </ErrorBoundary>
          <ErrorBoundary section="Crossover">
            <MaCrossover rows={rows} />
          </ErrorBoundary>
        </section>

        <section className="row tertiary-row">
          <ErrorBoundary section="RSI">
            <RsiPanel rows={rows} range="1Y" />
          </ErrorBoundary>
          <ErrorBoundary section="Drawdown">
            <DrawdownChart rows={rows} />
          </ErrorBoundary>
          <ErrorBoundary section="Returns distribution">
            <ReturnsDistribution rows={rows} />
          </ErrorBoundary>
        </section>

        <section className="row table-row">
          <ErrorBoundary section="Data table">
            <DataTable rows={rows} />
          </ErrorBoundary>
        </section>
      </main>

      <ErrorBoundary section="Footer">
        <Footer rows={rows} />
      </ErrorBoundary>
    </>
  );
}
