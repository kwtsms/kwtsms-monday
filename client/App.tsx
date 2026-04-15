import React from 'react';
import AccountSettings from './views/AccountSettings';
import ItemView from './views/ItemView';
import DashboardWidget from './views/DashboardWidget';
import BoardMenuBulk from './views/BoardMenuBulk/Modal';
import SendOne from './views/ItemAction/SendOne';
import BoardView from './views/BoardView';

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith('/views/item-view')) return <ItemView />;
  if (path.startsWith('/views/dashboard-widget')) return <DashboardWidget />;
  if (path.startsWith('/views/board-view')) return <BoardView />;
  if (path.startsWith('/actions/board-menu-bulk')) return <BoardMenuBulk />;
  if (path.startsWith('/actions/item-send-sms')) return <SendOne />;
  return <AccountSettings />;
}
