import React from 'react';

// A proper 7-day stacked bar chart - delivered (green) stacked on failed
// (red), with per-day labels under each bar, a count on top, and a small
// legend. Days with zero traffic draw a thin baseline tick so the x-axis
// reads the same whether or not there's data.
export default function Sparkline({
  series,
}: {
  series: { d: string; sent: number; failed: number }[];
}) {
  const max = Math.max(1, ...series.map((s) => s.sent + s.failed));
  const W = 560;
  const H = 160;
  const PADDING = { top: 22, right: 12, bottom: 28, left: 12 };
  const innerW = W - PADDING.left - PADDING.right;
  const innerH = H - PADDING.top - PADDING.bottom;
  const slot = innerW / Math.max(series.length, 1);
  const barW = Math.min(slot * 0.55, 36);

  function dayLabel(d: string): string {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  }

  return (
    <div>
      <div className="kwt-row" style={{ gap: 14, fontSize: 11, color: 'var(--c-ink-500)', marginBottom: 6 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2e7d32', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Delivered</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#c62828', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Failed</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Last 7 days delivery chart">
        {/* baseline */}
        <line x1={PADDING.left} x2={W - PADDING.right} y1={H - PADDING.bottom} y2={H - PADDING.bottom} stroke="#e0e0e0" />
        {series.map((s, i) => {
          const cx = PADDING.left + slot * i + slot / 2;
          const total = s.sent + s.failed;
          const hSent = (s.sent / max) * innerH;
          const hFail = (s.failed / max) * innerH;
          const baseY = H - PADDING.bottom;
          return (
            <g key={s.d}>
              {/* empty-day baseline tick */}
              {total === 0 && (
                <rect x={cx - barW / 2} y={baseY - 2} width={barW} height={2} fill="#e0e0e0" />
              )}
              {/* failed on top (stacked) */}
              {s.failed > 0 && (
                <rect x={cx - barW / 2} y={baseY - hSent - hFail} width={barW} height={hFail} fill="#c62828" rx={2} />
              )}
              {/* delivered at bottom */}
              {s.sent > 0 && (
                <rect x={cx - barW / 2} y={baseY - hSent} width={barW} height={hSent} fill="#2e7d32" rx={2} />
              )}
              {/* count label above */}
              {total > 0 && (
                <text x={cx} y={baseY - hSent - hFail - 6} fontSize="11" fontWeight="700" textAnchor="middle" fill="#323338">
                  {total}
                </text>
              )}
              {/* day label */}
              <text x={cx} y={H - 10} fontSize="11" textAnchor="middle" fill="#676879">{dayLabel(s.d)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
