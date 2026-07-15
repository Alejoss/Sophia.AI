import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackMetaPageView } from '../utils/metaPixel';

/**
 * Fires Meta Pixel PageView on client-side route changes (SPA).
 * Skips the first mount because initMetaPixel() already sent the initial PageView.
 */
const MetaPixelTracker = () => {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
};

export default MetaPixelTracker;
