import React, { useEffect, useRef, useState } from 'react';

// Compact "?" icon next to a Message textarea. Click toggles a popover that
// lists the supported placeholders. Source of truth is still the Templates
// settings page; this is a point-of-use reminder so authors don't have to
// context-switch to remember what's available.
const PLACEHOLDERS: Array<{ token: string; note?: string }> = [
  { token: '{item.name}' },
  { token: '{item.id}' },
  { token: '{item.url}' },
  { token: '{item.group}' },
  { token: '{item.created_at}' },
  { token: '{item.updated_at}' },
  { token: '{item.creator_name}' },
  { token: '{item.creator_email}' },
  { token: '{column.<Title>}', note: 'any column title' },
  { token: '{user.name}' },
  { token: '{user.email}' },
  { token: '{user.phone}' },
  { token: '{user.title}' },
  { token: '{user.location}' },
  { token: '{board.name}' },
  { token: '{board.url}' },
  { token: '{date}' },
  { token: '{time}' },
];

export default function PlaceholdersHelp() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Show available placeholders"
        title="Show available placeholders"
        style={{
          width: 18, height: 18, borderRadius: '50%', border: '1px solid #d0d4e4',
          background: '#fff', color: '#676879', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', padding: 0, lineHeight: '16px',
        }}
      >
        ?
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 24, left: 0, zIndex: 50,
            background: '#fff', border: '1px solid #e6e8ee', borderRadius: 8,
            boxShadow: '0 6px 20px rgba(22,26,51,0.1)',
            padding: '10px 12px', width: 280, fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#1f2028' }}>Placeholders</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PLACEHOLDERS.map((p) => (
              <code
                key={p.token}
                style={{
                  background: '#f6f7fb', border: '1px solid #e6e8ee', borderRadius: 4,
                  padding: '1px 6px', fontSize: 11, fontFamily: 'SF Mono, Menlo, Consolas, monospace',
                  color: '#1f2028',
                }}
                title={p.note}
              >
                {p.token}
              </code>
            ))}
          </div>
          <div style={{ marginTop: 8, color: '#676879', fontSize: 11 }}>
            Missing values substitute to empty.
          </div>
        </div>
      )}
    </span>
  );
}
