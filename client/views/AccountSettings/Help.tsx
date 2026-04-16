import React from 'react';

export default function Help() {
  return (
    <div>
      <h2>Help</h2>
      <ul className="kwt-help-list">
        <li>
          <b>Sign up for a kwtSMS account</b><br />
          <a href="https://www.kwtsms.com/signup" target="_blank" rel="noreferrer">kwtsms.com/signup</a>
        </li>
        <li>
          <b>Sender ID registration</b><br />
          <a href="https://www.kwtsms.com/sender-id-help.html" target="_blank" rel="noreferrer">kwtsms.com/sender-id-help</a>
        </li>
        <li>
          <b>Support</b><br />
          <a href="https://www.kwtsms.com/support.html" target="_blank" rel="noreferrer">www.kwtsms.com/support.html</a>
        </li>
      </ul>
    </div>
  );
}
