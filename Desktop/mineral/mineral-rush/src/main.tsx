/**
 * Vite 엔트리.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './view/ui/App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('E_MOUNT_FAILED: #root not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
