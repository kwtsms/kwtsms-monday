import React, { useEffect, useState } from 'react';
import AccountSettings from './views/AccountSettings';
import ItemView from './views/ItemView';
import DashboardWidget from './views/DashboardWidget';
import BoardMenuBulk from './views/BoardMenuBulk/Modal';
import SendOne from './views/ItemAction/SendOne';
import BoardView from './views/BoardView';
import { isViewOnly, prewarm } from './api/client';

function ViewerBlock() {
  return (
    <div className="kwt-panel" style={{ textAlign: 'center', paddingTop: 48 }}>
      <h2 style={{ color: 'var(--c-ink-500)' }}>View-only access</h2>
      <p style={{ color: 'var(--c-ink-500)' }}>
        As a viewer, you are unable to use this app.
        Contact your workspace admin for access.
      </p>
    </div>
  );
}

export default function App() {
  const [viewOnly, setViewOnly] = useState<boolean | null>(null);

  useEffect(() => {
    // Fire prewarm immediately on iframe mount so any subsequent GET (logs,
    // templates, settings) lands on a warm Cloud Run instance. GET retries
    // on 503 with 1s/3s/6s backoff, so by the time this resolves the SDK
    // auth handshake is paid.
    void prewarm();
    isViewOnly().then(setViewOnly);
  }, []);

  const path = window.location.pathname;
  const isReadOnly = path.startsWith('/views/dashboard-widget');

  if (viewOnly === null) return <div className="kwt-loading">Loading…</div>;
  if (viewOnly && !isReadOnly) return <ViewerBlock />;

  if (path.startsWith('/views/item-view')) return <ItemView />;
  if (path.startsWith('/views/dashboard-widget')) return <DashboardWidget />;
  if (path.startsWith('/views/board-view')) return <BoardView />;
  if (path.startsWith('/actions/board-menu-bulk')) return <BoardMenuBulk />;
  if (path.startsWith('/actions/item-send-sms')) return <SendOne />;
  return <AccountSettings />;
}
