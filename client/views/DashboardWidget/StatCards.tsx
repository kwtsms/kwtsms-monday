import React from 'react';

export default function StatCards(props: { balance: number; todaySent: number; monthSent: number; failureRate: number }) {
  return (
    <div className="kwt-stat-grid">
      <Card label="Balance" value={String(props.balance)} />
      <Card label="Sent today" value={String(props.todaySent)} />
      <Card label="Sent this month" value={String(props.monthSent)} />
      <Card label="Failure rate (7d)" value={`${Math.round(props.failureRate * 100)}%`} />
    </div>
  );
}
function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="kwt-stat">
      <div className="kwt-stat-label">{label}</div>
      <div className="kwt-stat-value">{value}</div>
    </div>
  );
}
