import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import StatCards from './StatCards';
import Sparkline from './Sparkline';

export default function DashboardWidget() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  async function load() {
    try {
      setErr('');
      setData(await api<any>('/api/stats'));
    } catch (e) {
      setErr(String(e));
    }
  }
  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);
  if (err) return <div className="kwt-widget"><div className="kwt-alert kwt-alert--danger">Stats error: {err}</div></div>;
  if (!data) return <div className="kwt-widget"><div className="kwt-loading">Loading…</div></div>;
  return (
    <div className="kwt-widget">
      <StatCards balance={data.balance} todaySent={data.todaySent} monthSent={data.monthSent} failureRate={data.failureRate} />
      <div className="kwt-sparkline">
        <Sparkline series={data.series} />
      </div>
      <div className="kwt-row kwt-row--between kwt-mt-3" style={{ fontSize: 12, color: 'var(--c-ink-500)' }}>
        <span>Last sync: {data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : 'never'}</span>
        <button className="kwt-btn kwt-btn--ghost kwt-btn--sm" onClick={load}>Refresh</button>
      </div>
    </div>
  );
}
