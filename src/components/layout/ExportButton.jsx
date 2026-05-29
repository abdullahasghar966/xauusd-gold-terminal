import { useState, useRef, useEffect } from 'react';
import { Download, FileImage, FileText } from 'lucide-react';
import './ExportButton.css';

const FILE_BASE = 'xauusd-terminal';
const TARGET_SELECTOR = 'main.shell';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function captureNode() {
  const node = document.querySelector(TARGET_SELECTOR);
  if (!node) throw new Error('Capture target not found');
  document.body.classList.add('exporting');
  // Let the browser settle before reading layout
  await new Promise((r) => setTimeout(r, 80));
  try {
    const { toPng } = await import('html-to-image');
    return await toPng(node, {
      pixelRatio: 2,
      backgroundColor: '#050507',
      cacheBust: true,
      filter: (n) => !(n?.classList?.contains?.('export-skip')),
    });
  } finally {
    document.body.classList.remove('exporting');
  }
}

async function exportPng() {
  const dataUrl = await captureNode();
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${FILE_BASE}-${timestamp()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function exportPdf() {
  const dataUrl = await captureNode();
  const { jsPDF } = await import('jspdf');
  // Build a PDF sized to the captured image, in landscape if wider than tall.
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const pdf = new jsPDF({
    orientation: w > h ? 'landscape' : 'portrait',
    unit: 'px',
    format: [w, h],
    compress: true,
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
  pdf.save(`${FILE_BASE}-${timestamp()}.pdf`);
}

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      await fn();
    } catch (e) {
      console.error('[export]', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-btn-wrap export-skip" ref={wrapRef}>
      <button
        type="button"
        className={`export-btn ${busy ? 'busy' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export dashboard"
        disabled={busy}
      >
        <Download size={13} strokeWidth={1.6} />
        <span>{busy ? 'Exporting…' : 'Export'}</span>
      </button>
      {open && (
        <div className="export-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => run(exportPng)}>
            <FileImage size={13} strokeWidth={1.6} /> PNG
          </button>
          <button type="button" role="menuitem" onClick={() => run(exportPdf)}>
            <FileText size={13} strokeWidth={1.6} /> PDF
          </button>
        </div>
      )}
    </div>
  );
}
