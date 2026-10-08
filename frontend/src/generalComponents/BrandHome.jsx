import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowForward as ArrowForwardIcon,
  AutoStories as AutoStoriesIcon,
  EventOutlined as EventIcon,
  HubOutlined as HubIcon,
  PsychologyAltOutlined as PsychologyIcon,
  RouteOutlined as RouteIcon,
} from '@mui/icons-material';
import { Box, Button, Container, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import '../styles/brand-home.css';

const SOCIAL_LINKS = [
  ['YouTube', 'https://www.youtube.com/@AcademiaBlockchain'],
  ['Facebook', 'https://www.facebook.com/AcademiaBlockchain/'],
  ['X', 'https://x.com/aca_blockchain'],
  ['Instagram', 'https://www.instagram.com/aca_blockchain/'],
];

const ECOSYSTEM = [
  { icon: AutoStoriesIcon, number: '01', key: 'library', to: '/search' },
  { icon: HubIcon, number: '02', key: 'topics', to: '/content/topics' },
  { icon: RouteIcon, number: '03', key: 'paths', to: '/knowledge_path' },
  { icon: EventIcon, number: '04', key: 'events', to: '/events' },
];

const BrandHome = () => {
  const { t } = useTranslation('home');
  const navigate = useNavigate();

  return (
    <Box className="brand-home">
      <section className="brand-hero" aria-labelledby="brand-hero-title">
        <div className="brand-hero-visual" aria-hidden="true">
          <div className="brand-orbit brand-orbit-one" /><div className="brand-orbit brand-orbit-two" /><div className="brand-orbit brand-orbit-three" />
          <div className="brand-node brand-node-one" /><div className="brand-node brand-node-two" /><div className="brand-node brand-node-three" />
        </div>
        <Container maxWidth="lg" className="brand-hero-container">
          <Box className="brand-hero-copy">
            <Typography component="p" className="brand-kicker">{t('kicker')}</Typography>
            <Typography component="h1" id="brand-hero-title" className="brand-display">{t('displayLine1')}<br />{t('displayLine2')}</Typography>
            <Typography component="p" className="brand-hero-lead">
              {t('lead')}
            </Typography>
            <Box className="brand-hero-actions">
              <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/knowledge_path')} className="brand-button brand-button-primary">{t('heroPrimary')}</Button>
              <Button variant="text" onClick={() => navigate('/content/topics')} className="brand-button brand-button-secondary">{t('heroSecondary')}</Button>
            </Box>
            <Typography component="p" className="brand-hero-note">
              {t('heroNote')}
            </Typography>
          </Box>
        </Container>
      </section>

      <section className="brand-statement" aria-labelledby="world-title">
        <Container maxWidth="lg"><div className="brand-section-grid">
          <div><Typography component="p" className="brand-section-index">{t('startIndex')}</Typography><Typography component="h2" id="world-title" className="brand-section-title">{t('startTitle')}</Typography></div>
          <div className="brand-statement-copy">
            <Typography component="p">{t('startP1')}</Typography>
            <Typography component="p" className="brand-emphasis-copy">{t('startP2')}</Typography>
            <Typography component="p">{t('startP3')}</Typography>
            <Typography component="p" className="brand-guide-prompt">{t('startPrompt')} <Link to="/como-funciona/aprender-sin-algoritmos">{t('startLink')} <ArrowForwardIcon aria-hidden="true" /></Link></Typography>
          </div>
        </div></Container>
      </section>

      <section className="brand-about" aria-labelledby="about-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index brand-section-index-light">{t('aboutIndex')}</Typography>
          <div className="brand-about-grid">
            <div className="brand-about-heading">
              <Typography component="h2" id="about-title" className="brand-section-title brand-section-title-light">{t('aboutTitle')}</Typography>
              <Typography component="p" className="brand-about-quote">{t('aboutQuote')}</Typography>
            </div>
            <div className="brand-about-copy">
              <Typography component="p">{t('aboutP1')}</Typography>
              <Typography component="p">{t('aboutP2')}</Typography>
              <Typography component="p">{t('aboutP3')}</Typography>
              <Typography component="p" className="brand-guide-prompt brand-guide-prompt-light">{t('aboutPrompt')} <Link to="/como-funciona/archivo-y-preservacion">{t('aboutLink')} <ArrowForwardIcon aria-hidden="true" /></Link></Typography>
            </div>
          </div>
        </Container>
      </section>

      <section className="brand-ecosystem" aria-labelledby="ecosystem-title">
        <Container maxWidth="lg">
          <div className="brand-section-grid brand-section-grid-top">
            <div><Typography component="p" className="brand-section-index">{t('doIndex')}</Typography><Typography component="h2" id="ecosystem-title" className="brand-section-title">{t('doTitle')}</Typography></div>
            <Typography component="p" className="brand-section-lead">{t('doLead')}</Typography>
          </div>
          <div className="brand-ecosystem-grid">
            {ECOSYSTEM.map(({ icon: Icon, number, key, to }) => (
              <article className="brand-ecosystem-card" key={key}>
                <div className="brand-card-topline"><Icon aria-hidden="true" /><span>{number}</span></div>
                <Typography component="h3">{t(`ecosystem.${key}.title`)}</Typography><Typography component="p">{t(`ecosystem.${key}.copy`)}</Typography>
                <Link to={to} className="brand-card-link">
                  {t(`ecosystem.${key}.action`)} <ArrowForwardIcon aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="brand-principle" aria-labelledby="principle-title"><Container maxWidth="md">
        <PsychologyIcon className="brand-principle-icon" aria-hidden="true" />
        <Typography component="p" className="brand-section-index">{t('principleIndex')}</Typography>
        <Typography component="h2" id="principle-title">{t('principleTitle')}</Typography>
        <Typography component="p" className="brand-principle-copy">{t('principleCopy')}</Typography>
      </Container></section>

      <section className="brand-final-cta" aria-labelledby="final-cta-title"><Container maxWidth="lg"><div className="brand-final-cta-inner">
        <div><Typography component="p" className="brand-section-index brand-section-index-light">{t('finalIndex')}</Typography><Typography component="h2" id="final-cta-title">{t('finalTitle')}</Typography></div>
        <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/search')} className="brand-button brand-button-light">{t('finalAction')}</Button>
      </div></Container></section>

      <footer className="brand-footer"><Container maxWidth="lg"><div className="brand-footer-inner">
        <Typography component="p">ACADEMIA BLOCKCHAIN</Typography><Typography component="p" className="brand-footer-mission">{t('footerMission')}</Typography>
        <nav aria-label={t('socialNav')}>{SOCIAL_LINKS.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}</nav>
      </div></Container></footer>
    </Box>
  );
};

export default BrandHome;
