import React, { useState } from 'react';
import { api } from '../api/client';

interface Template {
  id: string;
  name: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

interface Props {
  // Called after a template is created successfully. The parent should
  // refresh its template list and, if desired, auto-select the new one.
  onCreated: (t: Template) => void;
}

// Opens a lightweight in-iframe modal so the user can add a template without
// leaving the current composer. monday iframes each feature separately so we
// can't deep-link into the Account Settings view from here reliably.
export default function NewTemplateButton({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!name.trim() || !body.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const created = await api<Template>('/api/templates', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), body }),
      });
      onCreated(created);
      setOpen(false);
      setName('');
      setBody('');
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="kwt-btn kwt-btn--ghost kwt-btn--sm"
        onClick={() => setOpen(true)}
        style={{ fontSize: 12, padding: '4px 10px' }}
        title="Create a new template"
      >
        + New template
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(22,26,51,0.4)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 10, width: 440, maxWidth: '92vw',
              boxShadow: '0 24px 48px rgba(22,26,51,0.25)', padding: 20,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 14, fontSize: 16, fontWeight: 700 }}>New template</h3>
            <div className="kwt-field">
              <label className="kwt-label" htmlFor="kwt-new-t-name">Name</label>
              <input
                id="kwt-new-t-name"
                className="kwt-input"
                placeholder="e.g. Order shipped"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="kwt-field">
              <label className="kwt-label" htmlFor="kwt-new-t-body">Body</label>
              <textarea
                id="kwt-new-t-body"
                className="kwt-textarea"
                rows={4}
                placeholder="Hi {item.name}, your order has shipped."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            {err && <div className="kwt-alert kwt-alert--danger kwt-mt-3">{err}</div>}
            <div className="kwt-row kwt-row--between kwt-mt-3">
              <button
                type="button"
                className="kwt-btn kwt-btn--ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kwt-btn kwt-btn--primary"
                onClick={save}
                disabled={busy || !name.trim() || !body.trim()}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
