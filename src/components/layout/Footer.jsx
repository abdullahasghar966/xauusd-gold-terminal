import { fmtDate } from '../../lib/format.js';

export default function Footer({ rows }) {
  const last = rows[rows.length - 1];
  const first = rows[0];
  return (
    <footer className="hdr-footer" data-anim="tail">
      <div className="footer-inner">
        <div className="footer-col">
          <div className="footer-eyebrow">Source</div>
          <div className="footer-val mono">Yahoo Finance · GC=F</div>
        </div>
        <div className="footer-col">
          <div className="footer-eyebrow">Window</div>
          <div className="footer-val mono">
            {first ? fmtDate(first.date) : '—'} → {last ? fmtDate(last.date) : '—'}
          </div>
        </div>
        <div className="footer-col">
          <div className="footer-eyebrow">Records</div>
          <div className="footer-val mono">{rows.length.toLocaleString()} sessions</div>
        </div>
        <div className="footer-col">
          <div className="footer-eyebrow">Updated</div>
          <div className="footer-val mono">{last ? fmtDate(last.date) : '—'}</div>
        </div>
        <div className="footer-mark">
          <span className="serif">XAUUSD Gold Intelligence</span> · v0.1
        </div>
      </div>
    </footer>
  );
}
