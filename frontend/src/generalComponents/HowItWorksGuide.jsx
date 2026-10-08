import { Navigate, Link, useParams } from 'react-router-dom';
import { ArrowBack, ArrowForward, PlayCircleOutline } from '@mui/icons-material';
import { Box, Container, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import '../styles/how-it-works-guide.css';

const CHAPTERS = [
  {
    slug: 'archivo-y-preservacion',
    number: '01',
    videoUrl: 'https://www.youtube.com/embed/dts7ZsNwFhw',
    takeawayImage: '/images/guides/archivo-preservacion-takeaway.png',
  },
  {
    slug: 'aprender-sin-algoritmos',
    number: '02',
    videoUrl: 'https://www.youtube.com/embed/GWiIiydRaVc',
    takeawayImage: '/images/guides/aprender-sin-algoritmos-takeaway.png',
  },
];

const HowItWorksGuide = () => {
  const { t } = useTranslation('howItWorks');
  const { slug } = useParams();
  const chapterIndex = CHAPTERS.findIndex((chapter) => chapter.slug === slug);

  if (chapterIndex === -1) {
    return <Navigate to={`/como-funciona/${CHAPTERS[0].slug}`} replace />;
  }

  const chapter = CHAPTERS[chapterIndex];
  const copy = t(`chapters.${chapter.slug}`, { returnObjects: true });
  const previous = CHAPTERS[chapterIndex - 1];
  const next = CHAPTERS[chapterIndex + 1];
  const previousCopy = previous ? t(`chapters.${previous.slug}`, { returnObjects: true }) : null;
  const nextCopy = next ? t(`chapters.${next.slug}`, { returnObjects: true }) : null;

  return (
    <Box component="main" className="guide-page">
      <section className="guide-top" aria-label={t('pageLabel')}>
        <Container maxWidth="lg">
          <div className="guide-top-heading">
            <Typography component="p">{t('kicker')}</Typography>
            <Typography component="h1">{t('title')}</Typography>
          </div>
          <nav className="guide-chapters" aria-label={t('navLabel')}>
            {CHAPTERS.map((item) => (
              <Link
                key={item.slug}
                to={`/como-funciona/${item.slug}`}
                className={item.slug === chapter.slug ? 'is-active' : ''}
                aria-current={item.slug === chapter.slug ? 'page' : undefined}
              >
                <span>{item.number}</span>
                {t(`chapters.${item.slug}.shortTitle`)}
              </Link>
            ))}
          </nav>
        </Container>
      </section>

      <article>
        <header className="guide-hero">
          <Container maxWidth="lg">
            <div className="guide-hero-copy">
              <Typography component="p" className="guide-eyebrow">{chapter.number} / {copy.eyebrow}</Typography>
              <Typography component="h2">{copy.title}</Typography>
              <Typography component="p" className="guide-introduction">{copy.introduction}</Typography>
            </div>
            {chapter.videoUrl ? (
              <div className="guide-video-embed">
                <iframe
                  src={chapter.videoUrl}
                  title={t('videoTitle', { title: copy.title })}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="guide-video-placeholder" aria-label={t('videoPlaceholder')}>
                <PlayCircleOutline aria-hidden="true" />
                <Typography component="p">{t('videoSoon')}</Typography>
                <Typography component="span">{t('videoSoonHint')}</Typography>
              </div>
            )}
          </Container>
        </header>

        <section className="guide-body">
          <Container maxWidth="md">
            {copy.sections.map((section, index) => (
              <div className="guide-section" key={section.title}>
                <Typography component="p" className="guide-section-number">{String(index + 1).padStart(2, '0')}</Typography>
                <div>
                  <Typography component="h3">{section.title}</Typography>
                  <Typography component="p">{section.body}</Typography>
                </div>
              </div>
            ))}
            <blockquote
              className={`guide-takeaway${chapter.takeawayImage ? ' guide-takeaway-image' : ''}`}
              style={chapter.takeawayImage ? { backgroundImage: `linear-gradient(90deg, rgba(255,255,255,.28), rgba(255,245,232,.16)), url(${chapter.takeawayImage})` } : undefined}
            >
              <Typography component="p">{copy.takeaway}</Typography>
            </blockquote>
          </Container>
        </section>

        <footer className="guide-pagination">
          <Container maxWidth="lg">
            {previous ? (
              <Link to={`/como-funciona/${previous.slug}`} className="guide-page-link guide-page-link-previous">
                <ArrowBack aria-hidden="true" /><span><small>{t('previous')}</small>{previousCopy.shortTitle}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link to={`/como-funciona/${next.slug}`} className="guide-page-link guide-page-link-next">
                <span><small>{t('next')}</small>{nextCopy.shortTitle}</span><ArrowForward aria-hidden="true" />
              </Link>
            ) : (
              <Link to="/" className="guide-page-link guide-page-link-next">
                <span><small>{t('back')}</small>{t('backTitle')}</span><ArrowForward aria-hidden="true" />
              </Link>
            )}
          </Container>
        </footer>
      </article>
    </Box>
  );
};

export default HowItWorksGuide;
