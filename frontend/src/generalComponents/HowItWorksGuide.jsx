import { Navigate, Link, useParams } from 'react-router-dom';
import { ArrowBack, ArrowForward, PlayCircleOutline } from '@mui/icons-material';
import { Box, Container, Typography } from '@mui/material';
import '../styles/how-it-works-guide.css';

const CHAPTERS = [
  {
    slug: 'archivo-y-preservacion',
    number: '01',
    shortTitle: 'El archivo es tuyo',
    eyebrow: 'ACCESO, PROPIEDAD Y MEMORIA',
    title: 'Conservar el conocimiento es una forma de libertad.',
    introduction: 'Tener acceso a un contenido no significa poseerlo. Cuando dependes por completo de una plataforma, también dependes de sus decisiones, sus permisos y su permanencia. Guardar los archivos puede significar conocimiento importante para las siguientes generaciones.',
    videoUrl: 'https://www.youtube.com/embed/dts7ZsNwFhw',
    sections: [
      {
        title: 'Acceder no es conservar',
        body: 'Llamamos “nuestras” a listas, bibliotecas y colecciones que en realidad viven detrás de servicios externos. Un enlace puede romperse, un video puede desaparecer y una cuenta puede dejar de estar disponible. Para quien investiga un tema, esa fragilidad no es un detalle: afecta la memoria que puede construir y compartir.',
      },
      {
        title: 'Una biblioteca que puedes llevar contigo',
        body: 'Academia Blockchain permite descargar los archivos disponibles y preservarlos fuera de la plataforma. El objetivo es que el conocimiento útil no quede encerrado en un intermediario.',
      },
      {
        title: 'Preservar de forma colaborativa',
        body: 'Si un contenido solo cuenta con un enlace externo (URL) y tú sí tienes el archivo, puedes sugerirlo y subirlo a Academia Blockchain. Así, la comunidad relaciona fuentes, guarda materiales y fortalece una investigación compartida.',
      },
    ],
    takeaway: 'Una comunidad conserva mejor aquello que considera valioso cuando no depende de un solo lugar para acceder a ello. Descárgate los archivos.',
    takeawayImage: '/images/guides/archivo-preservacion-takeaway.png',
  },
  {
    slug: 'aprender-sin-algoritmos',
    number: '02',
    shortTitle: 'Aprender sin el algoritmo',
    eyebrow: 'ATENCIÓN, CURIOSIDAD Y CRITERIO',
    title: 'Tu curiosidad no debería obedecer a un muro de recomendaciones.',
    introduction: 'Los algoritmos de las redes sociales optimizan el tiempo que permaneces mirando, no la profundidad de lo que aprendes. Academia Blockchain propone otra manera de descubrir conocimiento.',
    videoUrl: 'https://www.youtube.com/embed/GWiIiydRaVc',
    sections: [
      {
        title: 'Tu atención tiene un propósito',
        body: 'Una recomendación automática decide qué aparece frente a ti y qué queda fuera. Su incentivo suele ser mantenerte dentro de la plataforma, alternando estímulos y publicidad, no ayudarte a comprender un asunto complejo.',
      },
      {
        title: 'La comodidad también puede limitar',
        body: 'Cuando delegamos constantemente el descubrimiento, dejamos de ejercitar la curiosidad. El contenido se vuelve más inmediato y superficial, mientras disminuye el espacio para detenerse, contrastar y pensar profundamente.',
      },
      {
        title: 'Explorar con intención',
        body: 'En Academia Blockchain puedes recorrer temas construidos colaborativamente y caminos de conocimiento organizados con un propósito. No se trata de seguir desplazándote, sino de elegir una pregunta y avanzar hacia una comprensión propia.',
      },
    ],
    takeaway: 'La plataforma ofrece rutas para explorar; la dirección de tu aprendizaje sigue siendo tuya.',
    takeawayImage: '/images/guides/aprender-sin-algoritmos-takeaway.png',
  },
];

const HowItWorksGuide = () => {
  const { slug } = useParams();
  const chapterIndex = CHAPTERS.findIndex((chapter) => chapter.slug === slug);

  if (chapterIndex === -1) {
    return <Navigate to={`/como-funciona/${CHAPTERS[0].slug}`} replace />;
  }

  const chapter = CHAPTERS[chapterIndex];
  const previous = CHAPTERS[chapterIndex - 1];
  const next = CHAPTERS[chapterIndex + 1];

  return (
    <Box component="main" className="guide-page">
      <section className="guide-top" aria-label="Guía Cómo funciona Academia Blockchain">
        <Container maxWidth="lg">
          <div className="guide-top-heading">
            <Typography component="p">GUÍA</Typography>
            <Typography component="h1">Cómo funciona Academia Blockchain</Typography>
          </div>
          <nav className="guide-chapters" aria-label="Capítulos de la guía">
            {CHAPTERS.map((item) => (
              <Link
                key={item.slug}
                to={`/como-funciona/${item.slug}`}
                className={item.slug === chapter.slug ? 'is-active' : ''}
                aria-current={item.slug === chapter.slug ? 'page' : undefined}
              >
                <span>{item.number}</span>
                {item.shortTitle}
              </Link>
            ))}
          </nav>
        </Container>
      </section>

      <article>
        <header className="guide-hero">
          <Container maxWidth="lg">
            <div className="guide-hero-copy">
              <Typography component="p" className="guide-eyebrow">{chapter.number} / {chapter.eyebrow}</Typography>
              <Typography component="h2">{chapter.title}</Typography>
              <Typography component="p" className="guide-introduction">{chapter.introduction}</Typography>
            </div>
            {chapter.videoUrl ? (
              <div className="guide-video-embed">
                <iframe
                  src={chapter.videoUrl}
                  title={`Video: ${chapter.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="guide-video-placeholder" aria-label="Espacio reservado para el video de YouTube">
                <PlayCircleOutline aria-hidden="true" />
                <Typography component="p">Video próximamente</Typography>
                <Typography component="span">El video de este capítulo aparecerá aquí.</Typography>
              </div>
            )}
          </Container>
        </header>

        <section className="guide-body">
          <Container maxWidth="md">
            {chapter.sections.map((section, index) => (
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
              <Typography component="p">{chapter.takeaway}</Typography>
            </blockquote>
          </Container>
        </section>

        <footer className="guide-pagination">
          <Container maxWidth="lg">
            {previous ? (
              <Link to={`/como-funciona/${previous.slug}`} className="guide-page-link guide-page-link-previous">
                <ArrowBack aria-hidden="true" /><span><small>CAPÍTULO ANTERIOR</small>{previous.shortTitle}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link to={`/como-funciona/${next.slug}`} className="guide-page-link guide-page-link-next">
                <span><small>SIGUIENTE CAPÍTULO</small>{next.shortTitle}</span><ArrowForward aria-hidden="true" />
              </Link>
            ) : (
              <Link to="/" className="guide-page-link guide-page-link-next">
                <span><small>VOLVER</small>Explorar Academia Blockchain</span><ArrowForward aria-hidden="true" />
              </Link>
            )}
          </Container>
        </footer>
      </article>
    </Box>
  );
};

export default HowItWorksGuide;
