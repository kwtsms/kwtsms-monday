import React, { useState } from 'react';

// Surface a full ApiError with a retry button. Used in list views where a
// transient 503 / cold-start can fail the fetch and leave the table empty.
// The details panel expands the raw error for support/debugging.
interface Props {
  label: string;                // "Load templates failed" or similar
  error: unknown;
  onRetry: () => void | Promise<void>;
}

function extract(e: unknown): {
  summary: string;
  details: Record<string, unknown>;
} {
  const any = e as Record<string, unknown>;
  const summary = (any?.message as string) ?? String(e);
  const details: Record<string, unknown> = {};
  for (const k of ['status', 'path', 'method', 'attempts', 'serverMessage', 'timestamp']) {
    if (any && k in any) details[k] = any[k];
  }
  return { summary, details };
}

export default function ApiErrorBlock({ label, error, onRetry }: Props) {
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const { summary, details } = extract(error);

  async function retry() {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kwt-alert kwt-alert--danger" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}>
          <b>{label}:</b> {summary}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="kwt-btn kwt-btn--ghost kwt-btn--sm"
            onClick={() => setShow((v) => !v)}
          >
            {show ? 'Hide details' : 'Details'}
          </button>
          <button
            type="button"
            className="kwt-btn kwt-btn--primary kwt-btn--sm"
            onClick={retry}
            disabled={busy}
          >
            {busy ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </div>
      {show && Object.keys(details).length > 0 && (
        <pre
          style={{
            marginTop: 8, padding: 10, background: '#fff', borderRadius: 6,
            border: '1px solid var(--c-border)', fontSize: 11,
            fontFamily: 'SF Mono, Menlo, Consolas, monospace',
            overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#1f2028',
          }}
        >
{JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}
