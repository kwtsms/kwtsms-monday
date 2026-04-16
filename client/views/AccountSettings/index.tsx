import React from 'react';
import Connect from './Connect';
import GatewayDefaults from './GatewayDefaults';
import Templates from './Templates';
import Logs from './Logs';
import Notifications from './Notifications';
import Help from './Help';

export default function AccountSettings() {
  return (
    <div className="kwtsms-settings">
      <div className="kwt-brand">
        <h1>kwtSMS</h1>
        <span className="kwt-badge">for monday.com</span>
      </div>
      <nav className="kwtsms-anchors">
        <a href="#connect">Connect</a>
        <a href="#defaults">Defaults</a>
        <a href="#templates">Templates</a>
        <a href="#logs">Logs</a>
        <a href="#notifications">Notifications</a>
        <a href="#help">Help</a>
      </nav>
      <section id="connect"><Connect /></section>
      <section id="defaults"><GatewayDefaults /></section>
      <section id="templates"><Templates /></section>
      <section id="logs"><Logs /></section>
      <section id="notifications"><Notifications /></section>
      <section id="help"><Help /></section>
    </div>
  );
}
