import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext.jsx';
import { createOrGetCoursePurchase } from '../api/paymentsApi.js';
import CourseCheckout from '../payments/adapters/CourseCheckout.jsx';
import '../styles/brand-home.css';
import '../styles/course-real-historia-bitcoin.css';

const COURSE_PATH = '/courses/real-historia-bitcoin';
const CHECKOUT_PATH = `${COURSE_PATH}/checkout`;
const COURSE_CODE = 'real-historia-bitcoin';

const checkoutErrorMessage = (err) => {
  const raw = err?.error || err?.detail || err?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  return 'No se pudo abrir el pago.';
};

const RealHistoriaBitcoinCheckout = () => {
  const navigate = useNavigate();
  const { authState, authInitialized } = useAuth();
  const startedRef = useRef(false);
  const [purchase, setPurchase] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Pago — La real historia de Bitcoin';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const openPurchase = useCallback(() => {
    setError('');
    setPaid(false);
    setCheckoutOpen(false);
    setLoading(true);
    createOrGetCoursePurchase(COURSE_CODE)
      .then((data) => {
        setPurchase(data);
        if (data.is_paid || data.payment_status === 'PAID') {
          setPaid(true);
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
        setLoading(false);
      });
  }, [navigate]);

  useEffect(() => {
    if (!authInitialized || startedRef.current) return undefined;
    if (!authState.isAuthenticated) {
      navigate(`/profiles/login?next=${encodeURIComponent(CHECKOUT_PATH)}`, { replace: true });
      return undefined;
    }
    startedRef.current = true;
    openPurchase();
    return undefined;
  }, [authInitialized, authState.isAuthenticated, navigate, openPurchase]);

  const retry = () => {
    openPurchase();
  };

  return (
    <Box className="brand-home rhb-page">
      <Box className="rhb-checkout-status">
        {error ? (
          <>
            <Typography component="p">{error}</Typography>
            <Box className="rhb-checkout-actions">
              <Button
                variant="contained"
                className="brand-button brand-button-primary"
                onClick={retry}
              >
                Reintentar
              </Button>
              <Button component={Link} to={COURSE_PATH} className="brand-button">
                Volver al curso
              </Button>
            </Box>
          </>
        ) : paid ? (
          <>
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
          </>
        ) : (
          <CircularProgress size={28} />
        )}
      </Box>
      <CourseCheckout
        open={checkoutOpen && !loading}
        onClose={() => {
          setCheckoutOpen(false);
          navigate(COURSE_PATH);
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
