// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import './index.css';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const userAgent = navigator.userAgent || '';
const isTelegramOrWebView = /Telegram|wv|WebView/i.test(userAgent);

if (SENTRY_DSN) {
  const sentryIntegrations = [Sentry.browserTracingIntegration()];
  if (!isTelegramOrWebView) {
    sentryIntegrations.push(
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })
    );
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    integrations: sentryIntegrations,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: isTelegramOrWebView ? 0 : 0.1,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const app = (
  <Sentry.ErrorBoundary fallback={<p>Algo salió mal. Recarga la página o contacta soporte.</p>}>
    <App />
  </Sentry.ErrorBoundary>
);

root.render(
  import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app,
);
