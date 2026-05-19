import React, { useCallback, useEffect, useState } from 'react';
import {
  createRegistrationPayment,
  getPaymentStatus,
} from '../api/paymentsApi';

const STATUS_LABELS = {
  waiting: 'Esperando pago',
  confirming: 'Confirmando en la red',
  confirmed: 'Confirmado',
  sending: 'Enviando a tu wallet',
  partially_paid: 'Pago parcial',
  finished: 'Pago completado',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
  expired: 'Expirado',
};

const CryptoPaymentModal = ({
  open,
  onClose,
  registrationId,
  eventTitle,
  priceUsd,
  onPaymentComplete,
}) => {
  const [payCurrency, setPayCurrency] = useState('bch');
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const refreshPayment = useCallback(async (paymentId) => {
    const data = await getPaymentStatus(paymentId);
    setPayment(data);
    if (data.is_paid) {
      onPaymentComplete?.(data);
    }
    return data;
  }, [onPaymentComplete]);

  useEffect(() => {
    if (!open) {
      setPayment(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !payment?.id || payment.is_paid) return undefined;
    const interval = setInterval(() => {
      refreshPayment(payment.id).catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [open, payment?.id, payment?.is_paid, refreshPayment]);

  const handleCreatePayment = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await createRegistrationPayment(registrationId, payCurrency);
      setPayment(data);
    } catch (err) {
      const msg = err?.error || err?.detail || 'No se pudo crear el pago';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async () => {
    if (!payment?.pay_address) return;
    try {
      await navigator.clipboard.writeText(payment.pay_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar la dirección');
    }
  };

  if (!open) return null;

  const statusLabel = STATUS_LABELS[payment?.payment_status] || payment?.payment_status;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
            <div className="modal-content crypto-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Pagar con criptomoneda</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">
          {error && <p className="error-message">{error}</p>}
          {!payment ? (
            <>
              <p>Evento: <strong>{eventTitle}</strong> — ${priceUsd} USD</p>
              <p>Elige la moneda con la que deseas pagar:</p>
              <div className="crypto-currency-picker">
                <label>
                  <input type="radio" name="payCurrency" value="bch" checked={payCurrency === 'bch'} onChange={() => setPayCurrency('bch')} />
                  Bitcoin Cash (BCH)
                </label>
                <label>
                  <input type="radio" name="payCurrency" value="xmr" checked={payCurrency === 'xmr'} onChange={() => setPayCurrency('xmr')} />
                  Monero (XMR)
                </label>
              </div>
            </>
          ) : (
                        <div className="payment-details">
              <p><strong>Estado:</strong> {statusLabel}</p>
              <p><strong>Moneda:</strong> {payment.pay_currency_display}</p>
              <p><strong>Monto a enviar:</strong> {payment.pay_amount} {payment.pay_currency?.toUpperCase()}</p>
              <p className="pay-address"><strong>Dirección:</strong> {payment.pay_address}</p>
              <button type="button" className="btn btn-outline" onClick={copyAddress}>
                {copied ? 'Copiado' : 'Copiar dirección'}
              </button>
              {payment.invoice_url && (
                <p><a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">Abrir factura NOWPayments</a></p>
              )}
              {payment.is_paid && (
                <p className="payment-success">Pago recibido. Gracias.</p>
              )}
            </div>
          )}
        </div>
                <div className="modal-footer">
          {!payment ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cerrar
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreatePayment} disabled={loading}>
                {loading ? 'Generando pago...' : 'Continuar'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {payment.is_paid ? 'Cerrar' : 'Pagar después'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CryptoPaymentModal;
