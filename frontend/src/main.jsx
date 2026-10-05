// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import { initMetaPixel } from './utils/metaPixel';
import { initGoogleAnalytics } from './utils/googleAnalytics';
import { sentryBeforeSend, shouldEnableSentry } from './utils/sentryEnv';
import './index.css';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const viteMode = import.meta.env.MODE || 'development';
// Label only — enable/disable is decided from Vite MODE (mirrors backend ENVIRONMENT).
const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT || viteMode;
const userAgent = navigator.userAgent || '';
const isTelegramOrWebView = /Telegram|wv|WebView/i.test(userAgent);

// Match backend policy: DSN alone is not enough — skip Vite development/test modes.
if (shouldEnableSentry({ dsn: SENTRY_DSN, mode: viteMode })) {
  const sentryIntegrations = [Sentry.browserTracingIntegration()];
  if (!isTelegramOrWebView) {
    sentryIntegrations.push(
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })
    );
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: sentryEnvironment,
    integrations: sentryIntegrations,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: isTelegramOrWebView ? 0 : 0.1,
    beforeSend: sentryBeforeSend,
  });
}

initMetaPixel();
initGoogleAnalytics();

const root = ReactDOM.createRoot(document.getElementById('root'));
const app = (
  <Sentry.ErrorBoundary fallback={<p>Algo salió mal. Recarga la página o contacta soporte.</p>}>
    <App />
  </Sentry.ErrorBoundary>
);

root.render(
  import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app,
);
