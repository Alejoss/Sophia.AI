import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const COURSE_PATH = '/cursos/real-historia-bitcoin';
const CHECKOUT_PATH = `${COURSE_PATH}/checkout`;
const COURSE_CODE = 'real-historia-bitcoin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const checkoutErrorMessage = (err, fallback) => {
  const raw = err?.error || err?.detail || err?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
};

const formatPrice = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `$${value.toFixed(2)} USD`;
};

const RealHistoriaBitcoinCheckout = () => {
  const { t } = useTranslation('courses');
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
    document.title = t('checkout.documentTitle', { title: t('title') });
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

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
          setError(t('checkout.noPrice'));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(checkoutErrorMessage(err, t('checkout.openFailed')));
      })
      .finally(() => {
        if (!cancelled) setLoadingCourse(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, authState.isAuthenticated, t]);

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    if (!trimmed) return t('checkout.emailRequired');
    if (!EMAIL_RE.test(trimmed)) return t('checkout.emailInvalid');
    return '';
  }, [email, t]);

  const priceLabel = formatPrice(purchase?.price_amount ?? course?.price_usd);
  const title = purchase?.title || course?.title || t('title');

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
          setError(t('checkout.noPrice'));
          return;
        }
        setCheckoutOpen(true);
      })
      .catch((err) => {
        if (err?.status === 401) {
          navigate(`/profiles/login?next=${encodeURIComponent(CHECKOUT_PATH)}`, { replace: true });
          return;
        }
        setError(checkoutErrorMessage(err, t('checkout.openFailed')));
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
          <Typography component="p">{t('checkout.confirmed')}</Typography>
          <Box className="rhb-checkout-actions">
            <Button
              component={Link}
              to={COURSE_PATH}
              variant="contained"
              className="brand-button brand-button-primary"
            >
              {t('checkout.backToCourse')}
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
          <nav className="rhb-checkout-steps" aria-label={t('checkout.stepsAria')}>
            <span className={`rhb-checkout-step ${checkoutOpen ? 'is-done' : 'is-current'}`}>
              {t('checkout.stepEmail')}
            </span>
            <span className="rhb-checkout-step-sep" aria-hidden="true" />
            <span className={`rhb-checkout-step ${checkoutOpen ? 'is-current' : ''}`}>
              {t('checkout.stepPayment')}
            </span>
          </nav>

          <Typography component="h1" className="rhb-checkout-heading">
            {t('checkout.heading')}
          </Typography>
          <Typography component="p" className="rhb-checkout-lead">
            {t('checkout.lead')}
          </Typography>

          <Box className="rhb-checkout-summary" component="section" aria-label={t('checkout.summaryAria')}>
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
              label={t('checkout.emailLabel')}
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
                  : t('checkout.emailHelper')
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
                {submitting ? t('checkout.preparing') : t('checkout.continue')}
              </Button>
              <Button component={Link} to={COURSE_PATH} className="brand-button">
                {t('checkout.backToCourse')}
              </Button>
            </Box>
          </Box>

          <Typography component="p" className="rhb-checkout-note">
            {t('checkout.note')}
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
