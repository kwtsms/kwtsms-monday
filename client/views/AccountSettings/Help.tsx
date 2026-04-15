import React from 'react';

export default function Help() {
  return (
    <div>
      <h2>Help</h2>
      <ul>
        <li>Sign up for a kwtSMS account: <a href="https://www.kwtsms.com/signup.html" target="_blank" rel="noreferrer">kwtsms.com/signup</a></li>
        <li>Sender ID registration help: <a href="https://www.kwtsms.com/sender-id-help.html" target="_blank" rel="noreferrer">Sender ID help</a></li>
        <li>Support: <a href="mailto:support@kwtsms.com">support@kwtsms.com</a></li>
        <li>Error codes: ERR001 through ERR033. Most common: ERR002 invalid credentials, ERR009 insufficient balance, ERR011 sender ID not approved.</li>
      </ul>
    </div>
  );
}
