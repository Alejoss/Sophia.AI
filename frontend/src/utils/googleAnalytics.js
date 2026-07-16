const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export function initGoogleAnalytics() {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || typeof window.gtag === 'function') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  // SPA: send page_view ourselves on each React Router navigation.
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  trackGooglePageView();
}

export function trackGooglePageView() {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: `${window.location.pathname}${window.location.search}`,
    page_title: document.title,
    page_location: window.location.href,
    send_to: GA_MEASUREMENT_ID,
  });
}
