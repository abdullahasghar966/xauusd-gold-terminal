import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { fmtPrice, fmtVol, fmtDate, fmtPct } from '../lib/format.js';
import { lastN } from '../lib/data.js';
import './DataTable.css';

const COLS = [
  { key: 'date',   label: 'Date',   align: 'left'  },
  { key: 'open',   label: 'Open',   align: 'right' },
  { key: 'high',   label: 'High',   align: 'right' },
  { key: 'low',    label: 'Low',    align: 'right' },
  { key: 'close',  label: 'Close',  align: 'right' },
  { key: 'change', label: 'Chg %',  align: 'right' },
  { key: 'volume', label: 'Volume', align: 'right' },
];

export default function DataTable({ rows }) {
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const data = useMemo(() => {
    const last30 = lastN(rows, 30);
    const withChg = last30.map((d, i, arr) => {
      const prev = i === 0 ? d.close : arr[i - 1].close;
      return { ...d, change: ((d.close - prev) / prev) * 100 };
    });
    const sorted = [...withChg].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'date') { av = a.date.getTime(); bv = b.date.getTime(); }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  const onSort = (k) => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  return (
    <div className="card data-table-card" data-anim="tail">
      <div className="card-head">
        <div>
          <h3 className="card-title"><span className="accent">Last 30</span> · Trading Days</h3>
          <span className="card-eyebrow">OHLCV · sortable</span>
        </div>
      </div>
      <div className="dt-scroll">
        <table className="dt mono">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} style={{ textAlign: c.align }}>
                  <button className="dt-th" onClick={() => onSort(c.key)}>
                    <span>{c.label}</span>
                    {sortKey === c.key
                      ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                      : <ArrowUpDown size={11} className="dt-th-idle" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const up = d.change >= 0;
              return (
                <tr key={d.date.getTime()} className={`dt-row ${up ? 'up' : 'down'}`}>
                  <td>{fmtDate(d.date)}</td>
                  <td className="num">{fmtPrice(d.open)}</td>
                  <td className="num hi">{fmtPrice(d.high)}</td>
                  <td className="num lo">{fmtPrice(d.low)}</td>
                  <td className="num close">{fmtPrice(d.close)}</td>
                  <td className={`num chg ${up ? 'pos' : 'neg'}`}>
                    <span className="chg-arrow">{up ? '▲' : '▼'}</span>{fmtPct(d.change)}
                  </td>
                  <td className="num vol">{fmtVol(d.volume)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
