import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext.jsx';
import knowledgePathsApi from '../api/knowledgePathsApi.js';
import {
  fetchEventById,
  fetchEvents,
  getUserEventRegistrations,
  registerForEvent,
} from '../api/eventsApi.js';
import PathCheckout from '../payments/adapters/PathCheckout.jsx';
import EventCheckout from '../payments/adapters/EventCheckout.jsx';
import '../styles/brand-home.css';
import '../styles/course-real-historia-bitcoin.css';

const CHECKOUT_PATH = '/courses/real-historia-bitcoin/checkout';
const COURSE_TITLE = 'La real historia de Bitcoin';
const LISTED_PRICE_USD = 35;

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

const matchesCourse = (item) => {
  const title = normalize(item?.title);
  return title.includes('real historia') && title.includes('bitcoin');
};

const isPaid = (item) => Number(item?.reference_price) > 0 || item?.is_for_sale || item?.is_paid_path;

const loginPath = () => `/profiles/login?next=${encodeURIComponent(CHECKOUT_PATH)}`;

const RealHistoriaBitcoinCheckout = () => {
  const navigate = useNavigate();
  const { authState, authInitialized } = useAuth();
  const startedRef = useRef(false);
  const [path, setPath] = useState(null);
  const [event, setEvent] = useState(null);
  const [purchaseId, setPurchaseId] = useState(null);
  const [registrationId, setRegistrationId] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Pago — La real historia de Bitcoin';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const openExistingCheckout = async () => {
    const configuredPathId = Number(import.meta.env.VITE_RHB_KNOWLEDGE_PATH_ID);
    const configuredEventId = Number(import.meta.env.VITE_RHB_EVENT_ID);

    if (Number.isFinite(configuredPathId) && configuredPathId > 0) {
      const detail = await knowledgePathsApi.getKnowledgePath(configuredPathId);
      const purchase = await knowledgePathsApi.createOrGetPurchase(detail.id);
      setPath(detail);
      setPurchaseId(purchase.id);
      if (purchase.is_paid || purchase.payment_status === 'PAID') {
        navigate(`/knowledge_path/${detail.id}`, { replace: true });
        return;
      }
      setCheckoutOpen(true);
      return;
    }

    if (Number.isFinite(configuredEventId) && configuredEventId > 0) {
      await openEventCheckout(configuredEventId);
      return;
    }

    const pathList = await knowledgePathsApi.getKnowledgePaths(1, 100);
    const paths = Array.isArray(pathList?.results) ? pathList.results : [];
    const pathMatch = paths.find((item) => matchesCourse(item) && isPaid(item))
      || paths.find(matchesCourse);
    if (pathMatch?.id) {
      const detail = await knowledgePathsApi.getKnowledgePath(pathMatch.id);
      const purchase = await knowledgePathsApi.createOrGetPurchase(detail.id);
      setPath(detail);
      setPurchaseId(purchase.id);
      if (purchase.is_paid || purchase.payment_status === 'PAID') {
        navigate(`/knowledge_path/${detail.id}`, { replace: true });
        return;
      }
      setCheckoutOpen(true);
      return;
    }

    const eventList = await fetchEvents();
    const events = Array.isArray(eventList) ? eventList : (eventList?.results || []);
    const eventMatch = events.find((item) => matchesCourse(item) && Number(item.reference_price) > 0)
      || events.find(matchesCourse);
    if (eventMatch?.id) {
      await openEventCheckout(eventMatch.id);
      return;
    }

    throw new Error('Este curso todavía no tiene un camino o evento de pago.');
  };

  const openEventCheckout = async (eventId) => {
    const detail = await fetchEventById(eventId);
    setEvent(detail);
    if (!(Number(detail?.reference_price) > 0)) {
      throw new Error('El evento de este curso no tiene un precio de pago.');
    }
    const registrations = await getUserEventRegistrations();
    const existing = (Array.isArray(registrations) ? registrations : []).find(
      (row) => Number(row.event) === Number(eventId) || Number(row.event?.id) === Number(eventId),
    );
    if (existing?.payment_status === 'PAID') {
      navigate(`/events/${eventId}`, { replace: true });
      return;
    }
    const registration = existing?.id
      ? existing
      : await registerForEvent(eventId);
    setRegistrationId(registration.id);
    setCheckoutOpen(true);
  };

  useEffect(() => {
    if (!authInitialized || startedRef.current) return undefined;
    if (!authState.isAuthenticated) {
      navigate(loginPath(), { replace: true });
      return undefined;
    }
    startedRef.current = true;
    let cancelled = false;
    openExistingCheckout().catch((err) => {
      if (cancelled) return;
      setError(
        err?.response?.data?.error
        || err?.error
        || err?.message
        || 'No se pudo abrir el pago.',
      );
    });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, authState.isAuthenticated]);

  const closeCheckout = () => {
    setCheckoutOpen(false);
    navigate('/courses/real-historia-bitcoin');
  };

  return (
    <Box className="brand-home rhb-page">
      <Box sx={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {error ? (
          <Typography component="p" className="brand-section-lead rhb-centered-lead">
            {error}
          </Typography>
        ) : (
          <CircularProgress size={28} />
        )}
      </Box>

      <PathCheckout
        open={checkoutOpen && path != null}
        onClose={closeCheckout}
        purchaseId={purchaseId}
        title={path?.title || COURSE_TITLE}
        priceUsd={path?.reference_price || LISTED_PRICE_USD}
        isForSale={path ? Boolean(path.is_for_sale) : true}
        bchDirectAvailable={Boolean(path?.bch_direct_available)}
        onPaid={() => navigate(`/knowledge_path/${path.id}`, { replace: true })}
      />

      <EventCheckout
        open={checkoutOpen && event != null}
        onClose={closeCheckout}
        registrationId={registrationId}
        title={event?.title || COURSE_TITLE}
        priceUsd={event?.reference_price || LISTED_PRICE_USD}
        onPaid={() => navigate(`/events/${event.id}`, { replace: true })}
      />
    </Box>
  );
};

export default RealHistoriaBitcoinCheckout;
