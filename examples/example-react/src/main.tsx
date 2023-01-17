import { CasperDappProvider } from '@usedapp/react';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CasperDappProvider>
      <App />
    </CasperDappProvider>
  </React.StrictMode>,
);
