import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Box, Button, Container, Typography } from '@mui/material';
import { getCourse } from '../api/paymentsApi.js';
import '../styles/brand-home.css';
import '../styles/course-real-historia-bitcoin.css';

const PULL_IDS = ['ideas', 'people', 'code', 'money', 'power', 'community', 'incentives', 'infrastructure'];
const VISION_IDS = ['p2p', 'store', 'settlement'];
const PATH_IDS = ['before', 'satoshi', 'early', 'war', 'split', 'market', 'beyond'];
const SOURCE_IDS = ['documents', 'discussions', 'interviews', 'timelines'];
const FOR_WHOM_IDS = ['users', 'followers', 'enthusiasts', 'students', 'curious', 'witnesses'];
const NOT_FOR_IDS = ['signals', 'advice', 'predictions', 'getRich'];
const MEETING_IDS = [
  { id: '01', key: 'm1' },
  { id: '02', key: 'm2' },
  { id: '03', key: 'm3' },
];

const scrollToHash = (event, id) => {
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
};

const COURSE_CODE = 'real-historia-bitcoin';

const formatCoursePrice = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} USD`;
};

const RealHistoriaBitcoinLanding = () => {
  const { t } = useTranslation('courses');
  const [priceLabel, setPriceLabel] = useState('');
  const [offerState, setOfferState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    getCourse(COURSE_CODE)
      .then((course) => {
        if (cancelled) return;
        if (!course?.is_for_sale) {
          setOfferState('closed');
          return;
        }
        setPriceLabel(formatCoursePrice(course.price_usd));
        setOfferState('ready');
      })
      .catch(() => {
        if (!cancelled) setOfferState('missing');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t('landing.documentTitle', { title: t('title') });
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  useEffect(() => {
    const { hash } = window.location;
    if (!hash) return undefined;
    const id = hash.slice(1);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <Box className="rhb-page brand-home">
      <section className="rhb-hero" aria-labelledby="rhb-hero-title">
        <Container maxWidth="lg" className="brand-hero-container">
          <Box className="rhb-hero-copy brand-hero-copy">
            <Typography component="p" className="brand-kicker">
              {t('landing.kicker')}
            </Typography>
            <Typography component="h1" id="rhb-hero-title" className="brand-display">
              {t('title')}
            </Typography>
            <Typography component="p" className="brand-hero-lead">
              {t('landing.lead')}
            </Typography>
            <Box className="brand-hero-actions rhb-hero-actions">
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                href="#curso"
                onClick={(event) => scrollToHash(event, 'curso')}
                className="brand-button brand-button-primary"
              >
                {t('landing.explore')}
              </Button>
              {offerState !== 'closed' ? (
                <Button
                  component={Link}
                  to="/cursos/real-historia-bitcoin/checkout"
                  variant="text"
                  className="brand-button brand-button-secondary"
                >
                  {t('landing.enroll')}
                </Button>
              ) : null}
            </Box>
            <div className="rhb-hero-signals" aria-label={t('landing.signalsAria')}>
              <span>{t('landing.signalStructured')}</span>
              <span>{t('landing.signalResearch')}</span>
              <span>{t('landing.signalLive')}</span>
            </div>
          </Box>
        </Container>
      </section>

      <section className="rhb-section brand-statement" id="curso" aria-labelledby="rhb-rupture-title">
        <Container maxWidth="lg">
          <div className="brand-section-grid">
            <div>
              <Typography component="p" className="brand-section-index">
                {t('landing.indexRupture')}
              </Typography>
              <Typography component="h2" id="rhb-rupture-title" className="brand-section-title">
                {t('landing.ruptureTitle')}
              </Typography>
              <Typography component="p" className="rhb-quote">
                {t('landing.ruptureQuote')}
              </Typography>
            </div>
            <div className="brand-statement-copy">
              <Typography component="p">
                {t('landing.ruptureBody')}
              </Typography>
              <ul className="rhb-era-list">
                <li>
                  <strong>{t('landing.eraBefore')}</strong>
                  <span>{t('landing.eraBeforeBody')}</span>
                </li>
                <li>
                  <strong>{t('landing.eraBirth')}</strong>
                  <span>{t('landing.eraBirthBody')}</span>
                </li>
                <li>
                  <strong>{t('landing.eraAfter')}</strong>
                  <span>{t('landing.eraAfterBody')}</span>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </section>
      <section className="rhb-section brand-ecosystem" aria-labelledby="rhb-question-title">
        <Container maxWidth="lg">
          <div className="rhb-question-wrap">
            <Typography component="p" className="brand-section-index">
              {t('landing.indexQuestion')}
            </Typography>
            <Typography component="h2" id="rhb-question-title" className="brand-section-title">
              {t('landing.questionTitle')}
            </Typography>
            <Typography component="p" className="brand-section-lead">
              {t('landing.questionLead')}
            </Typography>
          </div>
          <figure className="rhb-pull-figure">
            <div className="rhb-pull">
              <svg className="rhb-pull-field" viewBox="0 0 100 100" aria-hidden="true">
                <circle className="rhb-pull-ring" cx="50" cy="50" r="7.4" />
                {PULL_IDS.map((pullId, index) => {
                  const degrees = index * 45 - 90;
                  return (
                    <g key={pullId} transform={`rotate(${degrees} 50 50)`}>
                      <line className="rhb-pull-spoke" x1="60" y1="50" x2="73" y2="50" />
                      <path className="rhb-pull-arrow" d="M 72.2 48.45 L 77.4 50 L 72.2 51.55 Z" />
                    </g>
                  );
                })}
              </svg>
              <p className="rhb-pull-core">Bitcoin</p>
              <ul className="rhb-pull-labels">
                {PULL_IDS.map((pullId, index) => (
                  <li key={pullId} style={{ '--angle': `${index * 45 - 90}deg` }}>
                    <strong>{t(`pulls.${pullId}.name`)}</strong>
                    <span>{t(`pulls.${pullId}.line`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="rhb-pull-caption">
              {t('landing.pullCaption')}
            </figcaption>
          </figure>
        </Container>
      </section>

      <section className="rhb-section brand-principle" aria-labelledby="rhb-war-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            {t('landing.indexVisions')}
          </Typography>
          <Typography component="h2" id="rhb-war-title" className="brand-section-title">
            {t('landing.visionsTitle')}
          </Typography>
          <Typography component="p" className="brand-section-lead rhb-centered-lead">
            {t('landing.visionsLead')}
          </Typography>
          <div className="rhb-visions">
            {VISION_IDS.map((visionId, i) => (
              <article className="rhb-vision" key={visionId}>
                <span>{t('landing.visionLabel', { n: String(i + 1).padStart(2, '0') })}</span>
                <p>{t('landing.visionAs', { vision: t(`visions.${visionId}`).toLowerCase() })}</p>
              </article>
            ))}
          </div>
          <div className="rhb-inline-cta">
            <Button
              variant="text"
              href="#recorrido"
              onClick={(event) => scrollToHash(event, 'recorrido')}
              endIcon={<ArrowForwardIcon />}
              className="brand-button"
              sx={{ color: 'var(--brand-orange)', fontWeight: 700 }}
            >
              {t('landing.seePath')}
            </Button>
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-statement" id="recorrido" aria-labelledby="rhb-path-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            {t('landing.indexPath')}
          </Typography>
          <Typography component="h2" id="rhb-path-title" className="brand-section-title">
            {t('landing.pathTitle')}
          </Typography>
          <Typography component="p" className="brand-section-lead">
            {t('landing.pathLead')}
          </Typography>
          <div className="rhb-path">
            {PATH_IDS.map((stepId, index) => (
              <article className="rhb-path-step" key={stepId}>
                <div className="rhb-path-num">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <p className="rhb-path-period">{t(`path.${stepId}.period`)}</p>
                  <h3 className="rhb-path-question">{t(`path.${stepId}.question`)}</h3>
                  <p className="rhb-path-meta">{t(`path.${stepId}.meta`)}</p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="rhb-sources" aria-labelledby="rhb-sources-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index brand-section-index-light">
            {t('landing.indexMethod')}
          </Typography>
          <Typography component="h2" id="rhb-sources-title" className="brand-section-title brand-section-title-light">
            {t('landing.methodTitle')}
          </Typography>
          <Typography component="p" className="rhb-quote rhb-quote-light">
            {t('landing.methodQuote')}
          </Typography>
          <Typography component="p" className="brand-section-lead" style={{ color: '#c7c3bb', marginTop: 28 }}>
            {t('landing.methodLead')}
          </Typography>
          <div className="rhb-sources-grid">
            {SOURCE_IDS.map((sourceId) => (
              <div className="rhb-source-item" key={sourceId}>
                <strong>{t(`sources.${sourceId}.title`)}</strong>
                <span>{t(`sources.${sourceId}.copy`)}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-ecosystem" id="vivo" aria-labelledby="rhb-live-title">
        <Container maxWidth="lg">
          <div className="rhb-live-grid">
            <div>
              <Typography component="p" className="brand-section-index">
                {t('landing.indexLive')}
              </Typography>
              <Typography component="h2" id="rhb-live-title" className="brand-section-title">
                {t('landing.liveTitle')}
              </Typography>
              <Typography component="p" className="brand-section-lead">
                {t('landing.liveLead')}
              </Typography>
            </div>
            <ul className="rhb-live-points">
              <li>{t('landing.livePoint1')}</li>
              <li>{t('landing.livePoint2')}</li>
              <li>{t('landing.livePoint3')}</li>
              <li>{t('landing.livePoint4')}</li>
            </ul>
          </div>

          <div className="rhb-calendar" aria-label={t('landing.calendarAria')}>
            {MEETING_IDS.map((meeting) => (
              <article className="rhb-meeting" key={meeting.id}>
                <p className="rhb-meeting-label">{t('landing.meetingLabel', { id: meeting.id })}</p>
                <h3>{t(`meetings.${meeting.key}.topic`)}</h3>
                <div className="rhb-meeting-dates">
                  {['date1', 'date2'].map((dateKey, index) => (
                    <span key={dateKey}>
                      {t('landing.meetingDate', {
                        n: index + 1,
                        date: t(`meetings.${meeting.key}.${dateKey}`),
                      })}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="rhb-window-note">
            <strong>{t('landing.windowLabel')}</strong> {t('landing.windowBody')}
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-statement" aria-labelledby="rhb-audience-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            {t('landing.indexFit')}
          </Typography>
          <Typography component="h2" id="rhb-audience-title" className="brand-section-title">
            {t('landing.fitTitle')}
          </Typography>
          <div className="rhb-audience">
            <div className="rhb-audience-col yes">
              <h3>{t('landing.fitYes')}</h3>
              <ul>
                {FOR_WHOM_IDS.map((itemId) => (
                  <li key={itemId}>{t(`forWhom.${itemId}`)}</li>
                ))}
              </ul>
            </div>
            <div className="rhb-audience-col no">
              <h3>{t('landing.fitNo')}</h3>
              <ul>
                {NOT_FOR_IDS.map((itemId) => (
                  <li key={itemId}>{t(`notFor.${itemId}`)}</li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-principle" aria-labelledby="rhb-guide-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            {t('landing.indexGuide')}
          </Typography>
          <Typography component="h2" id="rhb-guide-title" className="brand-section-title">
            {t('landing.guideTitle')}
          </Typography>
          <div className="rhb-guide">
            <figure className="rhb-guide-photo">
              <img
                src="/images/course_rhb_guide.png"
                alt={t('landing.guideAlt')}
              />
            </figure>
            <div className="rhb-guide-copy">
              <Typography component="p" className="rhb-guide-name">
                {t('landing.guideName')}
              </Typography>
              <Typography component="p" className="rhb-guide-role">
                {t('landing.guideRole')}
              </Typography>
              <Typography component="p">
                {t('landing.guideBio1')}
              </Typography>
              <Typography component="p">
                {t('landing.guideBio2')}
              </Typography>
            </div>
          </div>
        </Container>
      </section>

      <section
        className="rhb-section brand-principle"
        id="inscripcion"
        aria-labelledby={priceLabel ? 'rhb-price-title' : 'rhb-enroll-index'}
      >
        <Container maxWidth="sm">
          <Typography component="p" id="rhb-enroll-index" className="brand-section-index">
            {t('landing.indexEnroll')}
          </Typography>
          {priceLabel ? (
            <Typography component="h2" id="rhb-price-title" className="brand-section-title">
              {priceLabel}
            </Typography>
          ) : null}
          <Typography component="p" className="brand-section-lead rhb-centered-lead">
            {offerState === 'closed'
              ? t('landing.enrollClosed')
              : t('landing.enrollOpen')}
          </Typography>
          {offerState !== 'closed' ? (
            <div className="rhb-inline-cta">
              <Button
                component={Link}
                to="/cursos/real-historia-bitcoin/checkout"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                className="brand-button brand-button-primary"
              >
                {t('landing.subscribe')}
              </Button>
            </div>
          ) : null}
        </Container>
      </section>

      <footer className="brand-footer">
        <Container maxWidth="lg">
          <div className="brand-footer-inner">
            <Typography component="p">{t('landing.footerBrand')}</Typography>
            <Typography component="p" className="brand-footer-mission">
              {t('landing.footerMission')}
            </Typography>
            <nav aria-label={t('landing.footerNavAria')}>
              <Link to="/">{t('landing.footerHome')}</Link>
              <a href="#inscripcion" onClick={(event) => scrollToHash(event, 'inscripcion')}>
                {t('landing.footerEnroll')}
              </a>
            </nav>
          </div>
        </Container>
      </footer>
    </Box>
  );
};

export default RealHistoriaBitcoinLanding;
