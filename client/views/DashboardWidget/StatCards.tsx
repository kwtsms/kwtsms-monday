import React from 'react';

export default function StatCards(props: { balance: number; todaySent: number; monthSent: number; failureRate: number }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Card label="Balance" value={String(props.balance)} />
      <Card label="Sent today" value={String(props.todaySent)} />
      <Card label="Sent this month" value={String(props.monthSent)} />
      <Card label="Failure rate (7d)" value={`${Math.round(props.failureRate * 100)}%`} />
    </div>
  );
}
function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, background: '#f7f7f9', borderRadius: 6, flex: 1 }}>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
