import React from 'react';

export default function Sparkline({ series }: { series: { d: string; sent: number; failed: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.sent + s.failed));
  return (
    <svg viewBox="0 0 140 40" width="100%" height="40">
      {series.map((s, i) => {
        const x = i * 20 + 4;
        const hSent = (s.sent / max) * 36;
        const hFail = (s.failed / max) * 36;
        return (
          <g key={s.d}>
            <rect x={x} y={40 - hSent} width={8} height={hSent} fill="#2e7d32" />
            <rect x={x + 8} y={40 - hFail} width={8} height={hFail} fill="#c62828" />
          </g>
        );
      })}
    </svg>
  );
}
