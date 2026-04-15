import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import StatCards from './StatCards';
import Sparkline from './Sparkline';

export default function DashboardWidget() {
  const [data, setData] = useState<any>(null);
  async function load() { setData(await api<any>('/api/stats')); }
  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);
  if (!data) return <p>Loading...</p>;
  return (
    <div style={{ padding: 12 }}>
      <StatCards balance={data.balance} todaySent={data.todaySent} monthSent={data.monthSent} failureRate={data.failureRate} />
      <div style={{ marginTop: 12 }}>
        <Sparkline series={data.series} />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        last sync: {data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : 'never'}
        <button style={{ marginLeft: 8 }} onClick={load}>Refresh</button>
      </div>
    </div>
  );
}
