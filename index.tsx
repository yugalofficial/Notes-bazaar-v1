import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

declare global {
  interface Window {
    __nbMounted?: boolean;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

function renderBootFallback(reason?: string) {
  if (!rootElement) return;
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#020617;color:#f8fafc;font-family:'Plus Jakarta Sans',system-ui,sans-serif;text-align:center;">
      <div style="max-width:440px;background:#0f172a;border:1px solid #1e293b;border-radius:24px;padding:32px;box-shadow:0 20px 50px rgba(0,0,0,0.4);">
        <div style="width:52px;height:52px;margin:0 auto 16px;border-radius:16px;background:linear-gradient(135deg,#1d4ed8,#0d9488);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;color:#fff;">NB</div>
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;">NotesBazaar Recovery</h1>
        <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#94a3b8;">
          ${reason || 'A temporary display issue prevented the storefront from loading. Reset cached data to reload cleanly.'}
        </p>
        <button id="nb-hard-reset-btn" style="width:100%;padding:12px 18px;border:0;border-radius:12px;background:linear-gradient(90deg,#1d4ed8,#0d9488);color:#fff;font-weight:700;font-size:13px;cursor:pointer;">
          Refresh &amp; Clear Cache
        </button>
      </div>
    </div>
  `;
  const btn = document.getElementById('nb-hard-reset-btn');
  btn?.addEventListener('click', async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    window.location.reload();
  });
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  window.__nbMounted = true;
} catch (err) {
  console.error('NotesBazaar boot mount error:', err);
  renderBootFallback();
}
