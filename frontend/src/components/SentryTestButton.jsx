import React from 'react';
import * as Sentry from '@sentry/react';

/**
 * Botón para verificar que Sentry recibe eventos. Solo se muestra en desarrollo
 * cuando VITE_SENTRY_DSN está definido. Puedes eliminarlo o ocultarlo en producción.
 */
export default function SentryTestButton() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isDev = import.meta.env.DEV;

  if (!dsn || !isDev) return null;

  const handleTest = () => {
    Sentry.captureException(new Error('Test de Sentry desde el frontend'));
  };

  return (
    <button
      type="button"
      onClick={handleTest}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        padding: '8px 12px',
        fontSize: 12,
        background: '#6f42c1',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
      title="Enviar un error de prueba a Sentry"
    >
      Test Sentry
    </button>
  );
}
