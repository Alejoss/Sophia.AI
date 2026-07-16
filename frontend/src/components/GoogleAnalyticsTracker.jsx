import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackGooglePageView } from '../utils/googleAnalytics';

/**
 * Fires GA4 page_view on client-side route changes (SPA).
 * Skips the first mount because initGoogleAnalytics() already sent the initial page_view.
 */
const GoogleAnalyticsTracker = () => {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackGooglePageView();
  }, [location.pathname, location.search]);

  return null;
};

export default GoogleAnalyticsTracker;
