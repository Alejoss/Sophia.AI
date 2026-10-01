import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  TextField,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext.jsx';
import { createOrGetCoursePurchase, getCourse } from '../api/paymentsApi.js';
import CourseCheckout from '../payments/adapters/CourseCheckout.jsx';
import '../styles/brand-home.css';
import '../styles/course-real-historia-bitcoin.css';

const COURSE_PATH = '/courses/real-historia-bitcoin';
const CHECKOUT_PATH = `${COURSE_PATH}/checkout`;
const COURSE_CODE = 'real-historia-bitcoin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const checkoutErrorMessage = (err) => {
  const raw = err?.error || err?.detail || err?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  return 'No se pudo abrir el pago.';
};

const formatPrice = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `$${value.toFixed(2)} USD`;
};

const RealHistoriaBitcoinCheckout = () => {
  const navigate = useNavigate();
  const { authState, authInitialized } = useAuth();
  const accountEmail = authState.user?.email || '';
  const emailPrefillDone = useRef(false);

  const [course, setCourse] = useState(null);
  const [purchase, setPurchase] = useState(null);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Pago — La real historia de Bitcoin';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!authInitialized) return undefined;
    if (!authState.isAuthenticated) {
      navigate(`/profiles/login?next=${encodeURIComponent(CHECKOUT_PATH)}`, { replace: true });
    }
    return undefined;
  }, [authInitialized, authState.isAuthenticated, navigate]);

  useEffect(() => {
    if (emailPrefillDone.current || !accountEmail) return;
    emailPrefillDone.current = true;
    setEmail(accountEmail);
  }, [accountEmail]);

  useEffect(() => {
    if (!authInitialized || !authState.isAuthenticated) return undefined;
    let cancelled = false;
    setLoadingCourse(true);
    setError('');
    getCourse(COURSE_CODE)
      .then((data) => {
        if (cancelled) return;
        setCourse(data);
        if (!data?.is_for_sale || !data?.price_usd) {
          setError('Este curso no tiene un precio de pago.');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(checkoutErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingCourse(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, authState.isAuthenticated]);

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    if (!trimmed) return 'El correo electrónico es requerido.';
    if (!EMAIL_RE.test(trimmed)) return 'Introduce un correo electrónico válido.';
    return '';
  }, [email]);

  const priceLabel = formatPrice(purchase?.price_amount ?? course?.price_usd);
  const title = purchase?.title || course?.title || 'La real historia de Bitcoin';

  const continueToPayment = (event) => {
    event.preventDefault();
    setEmailTouched(true);
    if (emailError) return;
    setSubmitting(true);
    setError('');
    createOrGetCoursePurchase(COURSE_CODE, { receiptEmail: email.trim().toLowerCase() })
      .then((data) => {
        setPurchase(data);
        if (data.is_paid || data.payment_status === 'PAID') {
          setPaid(true);
          setCheckoutOpen(false);
          return;
        }
        if (!data.id || !data.price_amount) {
          setError('Este curso no tiene un precio de pago.');
          return;
        }
        setCheckoutOpen(true);
      })
      .catch((err) => {
        if (err?.status === 401) {
          navigate(`/profiles/login?next=${encodeURIComponent(CHECKOUT_PATH)}`, { replace: true });
          return;
        }
        setError(checkoutErrorMessage(err));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  if (!authInitialized || !authState.isAuthenticated) {
    return (
      <Box className="brand-home rhb-page">
        <Box className="rhb-checkout-status">
          <CircularProgress size={28} />
        </Box>
      </Box>
    );
  }

  if (paid) {
    return (
      <Box className="brand-home rhb-page">
        <Box className="rhb-checkout-status">
          <Typography component="p">Tu lugar en el curso está confirmado.</Typography>
          <Box className="rhb-checkout-actions">
            <Button
              component={Link}
              to={COURSE_PATH}
              variant="contained"
              className="brand-button brand-button-primary"
            >
              Volver al curso
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="brand-home rhb-page">
      <Box className="rhb-checkout-shell">
        <Container maxWidth="sm" className="rhb-checkout-container">
          <nav className="rhb-checkout-steps" aria-label="Pasos del pago">
            <span className={`rhb-checkout-step ${checkoutOpen ? 'is-done' : 'is-current'}`}>
              1. Correo
            </span>
            <span className="rhb-checkout-step-sep" aria-hidden="true" />
            <span className={`rhb-checkout-step ${checkoutOpen ? 'is-current' : ''}`}>
              2. Pago
            </span>
          </nav>

          <Typography component="h1" className="rhb-checkout-heading">
            Checkout
          </Typography>
          <Typography component="p" className="rhb-checkout-lead">
            Confirma tu correo para el recibo y el acceso al curso. Luego elige cómo pagar.
          </Typography>

          <Box className="rhb-checkout-summary" component="section" aria-label="Resumen del pedido">
            <Typography component="h2" className="rhb-checkout-summary-title">
              {title}
            </Typography>
            {loadingCourse && !priceLabel ? (
              <CircularProgress size={22} />
            ) : (
              <Typography component="p" className="rhb-checkout-summary-price">
                {priceLabel || '—'}
              </Typography>
            )}
          </Box>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <Box
            component="form"
            className="rhb-checkout-form"
            onSubmit={continueToPayment}
            noValidate
          >
            <TextField
              id="course-receipt-email"
              label="Correo para el recibo"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              error={emailTouched && Boolean(emailError)}
              helperText={
                emailTouched && emailError
                  ? emailError
                  : 'Te enviaremos la confirmación de pago a este correo.'
              }
              fullWidth
              required
              disabled={submitting || Boolean(error && !course)}
            />

            <Box className="rhb-checkout-actions rhb-checkout-actions-form">
              <Button
                type="submit"
                variant="contained"
                className="brand-button brand-button-primary"
                disabled={submitting || loadingCourse || !course?.is_for_sale}
              >
                {submitting ? 'Preparando…' : 'Continuar al pago'}
              </Button>
              <Button component={Link} to={COURSE_PATH} className="brand-button">
                Volver al curso
              </Button>
            </Box>
          </Box>

          <Typography component="p" className="rhb-checkout-note">
            Puedes pagar con Bitcoin Cash directo, otras criptos vía NOWPayments,
            o acordar Monero por mensaje.
          </Typography>
        </Container>
      </Box>

      <CourseCheckout
        open={checkoutOpen && !submitting}
        onClose={() => {
          setCheckoutOpen(false);
        }}
        purchaseId={purchase?.id}
        title={purchase?.title}
        priceUsd={purchase?.price_amount}
        onPaid={() => {
          setPaid(true);
          setCheckoutOpen(false);
        }}
      />
    </Box>
  );
};

export default RealHistoriaBitcoinCheckout;
