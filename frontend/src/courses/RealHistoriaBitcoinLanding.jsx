import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Box, Button, Container, Typography } from '@mui/material';
import { getCourse } from '../api/paymentsApi.js';
import '../styles/brand-home.css';
import '../styles/course-real-historia-bitcoin.css';

const PULLS = [
  { name: 'Ideas', line: 'Criptografía, privacidad y dinero digital.' },
  { name: 'Personas', line: 'Quienes discreparon sobre su rumbo.' },
  { name: 'Código', line: 'Reglas escritas y rechazadas.' },
  { name: 'Dinero', line: 'Si seguimos el dinero llegamos a ...!' },
  { name: 'Poder', line: 'Quién decidió qué es Bitcoin.' },
  { name: 'Comunidad', line: 'Quienes lo usaron o lo dejaron.' },
  { name: 'Incentivos', line: 'Qué empuja una ruptura.' },
  { name: 'Infraestructura', line: 'Lo que se construyó encima.' },
];

const VISIONS = [
  'Dinero electrónico P2P',
  'Reserva de valor',
  'Capa base de liquidación'
];

const RESEARCH_PATH = [
  {
    period: 'Antes de Bitcoin',
    question: '¿Qué ideas hicieron posible Bitcoin?',
    meta: 'Criptografía, dinero digital, Cypherpunks y redes P2P.',
  },
  {
    period: 'Satoshi',
    question: '¿Qué problema intentaba resolver?',
    meta: 'El white paper, el contexto y la propuesta original. Entender cómo funciona la tecnología de Bitcoin.',
  },
  {
    period: 'Los primeros años',
    question: '¿Qué imaginaban quienes comenzaron a utilizarlo?',
    meta: 'Primeras comunidades, usos emergentes y tensiones iniciales.',
  },
  {
    period: 'La guerra por el proyecto',
    question: '¿Qué debía ser Bitcoin?',
    meta: 'Conflictos técnicos, económicos e ideológicos sobre su dirección.',
  },
  {
    period: 'La división',
    question: '¿Cómo se vio, a detalle, el conflicto?',
    meta: 'Eventos importantes, forks y la redefinición de narrativas.',
  },
  {
    period: 'El mercado',
    question: '¿Realmente entiendes las consecuencias de que el mercado esté manipulado?',
    meta: 'La guerra nunca estuvo separada del mercado.',
  },
  {
    period: 'Más allá de Bitcoin',
    question: '¿La guerra por las criptomonedas continúa?',
    meta: 'El ecosistema es mucho más amplio y el tablero es complejo. Pero la perspectiva que habrás cultivado te ayudará a entenderlo mejor.',
  },
];

const SOURCES = [
  { title: 'Documentos originales', copy: 'Textos fundacionales y archivos históricos.' },
  { title: 'Discusiones', copy: 'Foros, listas y debates de época.' },
  { title: 'Entrevistas', copy: 'Voces de quienes participaron.' },
  { title: 'Cronologías', copy: 'Secuencias para conectar episodios.' },
];

const FOR_WHOM = [
  'Personas que usan Bitcoin y quieren comprender su historia',
  'Quienes siguen criptomonedas y quieren ir más allá del precio',
  'Entusiastas de la tecnología interesados en comprender a profundidad',
  'Estudiantes de economía, dinero o sistemas monetarios',
  'Curiosos por Cypherpunks, privacidad y cultura de Internet',
  'Quienes vivieron partes de la historia y nunca reconstruyeron el panorama completo',
];

const NOT_FOR = [
  'Señales de trading',
  'Recomendaciones de inversión',
  'Predicciones de precio',
  'Fórmulas para hacerse rico con criptomonedas'
];

const MEETINGS = [
  {
    id: '01',
    topic: '¿Qué debía ser Bitcoin?',
    dates: ['Lunes 9 Noviembre 2026', 'Lunes 23 Noviembre 2026'],
  },
  {
    id: '02',
    topic: 'La guerra por Bitcoin',
    dates: ['Lunes 23 Noviembre 2026', 'Lunes 8 Diciembre 2026'],
  },
  {
    id: '03',
    topic: 'La guerra más allá de Bitcoin',
    dates: ['Lunes 8 Diciembre 2026', 'Lunes 15 Diciembre 2026'],
  },
];

const scrollToHash = (event, id) => {
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
};

const COURSE_CODE = 'real-historia-bitcoin';
const COURSE_TITLE = 'La Real Historia de Bitcoin y la Guerra por las Criptomonedas';

const formatCoursePrice = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} USD`;
};

const RealHistoriaBitcoinLanding = () => {
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
    document.title = `${COURSE_TITLE} — Academia Blockchain`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

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
              Academia Blockchain
            </Typography>
            <Typography component="h1" id="rhb-hero-title" className="brand-display">
              {COURSE_TITLE}
            </Typography>
            <Typography component="p" className="brand-hero-lead">
              Una investigación guiada sobre las ideas, personas y conflictos que transformaron Bitcoin.
            </Typography>
            <Box className="brand-hero-actions rhb-hero-actions">
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                href="#curso"
                onClick={(event) => scrollToHash(event, 'curso')}
                className="brand-button brand-button-primary"
              >
                Explorar el curso
              </Button>
              {offerState !== 'closed' ? (
                <Button
                  component={Link}
                  to="/courses/real-historia-bitcoin/checkout"
                  variant="text"
                  className="brand-button brand-button-secondary"
                >
                  Inscribirse
                </Button>
              ) : null}
            </Box>
            <div className="rhb-hero-signals" aria-label="Qué incluye la experiencia">
              <span>Contenido estructurado</span>
              <span>Investigación histórica</span>
              <span>Encuentros en vivo</span>
            </div>
          </Box>
        </Container>
      </section>

      <section className="rhb-section brand-statement" id="curso" aria-labelledby="rhb-rupture-title">
        <Container maxWidth="lg">
          <div className="brand-section-grid">
            <div>
              <Typography component="p" className="brand-section-index">
                01 / La ruptura
              </Typography>
              <Typography component="h2" id="rhb-rupture-title" className="brand-section-title">
                La Historia de Bitcoin no es lo que te cuentan
              </Typography>
              <Typography component="p" className="rhb-quote">
                Si le preguntas al ChatGPT, te va a repetir una mentira.
              </Typography>
            </div>
            <div className="brand-statement-copy">
              <Typography component="p">
                Debes conocer la historia oficial para luego profundizar y entender la historia real. Y, esto no comienza ni termina con Bitcoin.
              </Typography>
              <ul className="rhb-era-list">
                <li>
                  <strong>Antes</strong>
                  <span>Criptografía, privacidad, dinero digital, Cypherpunks, redes P2P.</span>
                </li>
                <li>
                  <strong>El nacimiento</strong>
                  <span>Una propuesta concreta frente a un problema concreto.</span>
                </li>
                <li>
                  <strong>Después</strong>
                  <span>Visionarios, conflictos y decisiones que moldearon lo que existe hoy.</span>
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
              02 / La pregunta central
            </Typography>
            <Typography component="h2" id="rhb-question-title" className="brand-section-title">
              ¿Cómo llegó Bitcoin a convertirse en lo que es hoy?
            </Typography>
            <Typography component="p" className="brand-section-lead">
              Bitcoin no cambió únicamente como tecnología. Su historia también está formada por conflictos de ideas y de
              seres humanos, intereses, desacuerdos y grupos de poder.
            </Typography>
          </div>
          <figure className="rhb-pull-figure">
            <div className="rhb-pull">
              <svg className="rhb-pull-field" viewBox="0 0 100 100" aria-hidden="true">
                <circle className="rhb-pull-ring" cx="50" cy="50" r="7.4" />
                {PULLS.map((pull, index) => {
                  const degrees = index * 45 - 90;
                  return (
                    <g key={pull.name} transform={`rotate(${degrees} 50 50)`}>
                      <line className="rhb-pull-spoke" x1="60" y1="50" x2="73" y2="50" />
                      <path className="rhb-pull-arrow" d="M 72.2 48.45 L 77.4 50 L 72.2 51.55 Z" />
                    </g>
                  );
                })}
              </svg>
              <p className="rhb-pull-core">Bitcoin</p>
              <ul className="rhb-pull-labels">
                {PULLS.map((pull, index) => (
                  <li key={pull.name} style={{ '--angle': `${index * 45 - 90}deg` }}>
                    <strong>{pull.name}</strong>
                    <span>{pull.line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="rhb-pull-caption">
              Ocho fuerzas tiran de Bitcoin en direcciones distintas. Ninguna, por sí sola, explica en lo que se convirtió.
            </figcaption>
          </figure>
        </Container>
      </section>

      <section className="rhb-section brand-principle" aria-labelledby="rhb-war-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            03 / Visiones en conflicto
          </Typography>
          <Typography component="h2" id="rhb-war-title" className="brand-section-title">
            Entender la Tecnología
          </Typography>
          <Typography component="p" className="brand-section-lead rhb-centered-lead">
            Si no comprendes bien cómo funciona, y te parece importante, estás en el lugar correcto. He acompañado en el proceso de aprendizaje de la tecnología de Bitcoin a cientos de personas.
            Te lo voy a explicar de la manera más sencilla posible para que luego avanzemos a un nivel más alto de comprensión, siempre con acompañamiento 1 a 1 cuando lo necesites.
            Una vez que entiendas la tecnología, será más sencillo ponderar las distinats visiones que existen sobre ella.
          </Typography>
          <div className="rhb-visions">
            {VISIONS.map((vision, i) => (
              <article className="rhb-vision" key={vision}>
                <span>Visión {String(i + 1).padStart(2, '0')}</span>
                <p>Bitcoin como {vision.toLowerCase()}</p>
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
              Ver el recorrido
            </Button>
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-statement" id="recorrido" aria-labelledby="rhb-path-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            04 / El recorrido
          </Typography>
          <Typography component="h2" id="rhb-path-title" className="brand-section-title">
            Lo que vas a investigar
          </Typography>
          <Typography component="p" className="brand-section-lead">
            La ruta de estudio en siete preguntas.
          </Typography>
          <div className="rhb-path">
            {RESEARCH_PATH.map((step, index) => (
              <article className="rhb-path-step" key={step.period}>
                <div className="rhb-path-num">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <p className="rhb-path-period">{step.period}</p>
                  <h3 className="rhb-path-question">{step.question}</h3>
                  <p className="rhb-path-meta">{step.meta}</p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="rhb-sources" aria-labelledby="rhb-sources-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index brand-section-index-light">
            05 / Método
          </Typography>
          <Typography component="h2" id="rhb-sources-title" className="brand-section-title brand-section-title-light">
            Trabajarás con fuentes
          </Typography>
          <Typography component="p" className="rhb-quote rhb-quote-light">
            No queremos decirte qué pensar sobre la historia de Bitcoin. Queremos darte suficiente
            contexto para que puedas examinarla inteligentemente.
          </Typography>
          <Typography component="p" className="brand-section-lead" style={{ color: '#c7c3bb', marginTop: 28 }}>
            El recorrido no es únicamente la interpretación de un profesor. Incluye reportajes,
            discusiones y artículos para que construyas tu propio criterio.
          </Typography>
          <div className="rhb-sources-grid">
            {SOURCES.map((item) => (
              <div className="rhb-source-item" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.copy}</span>
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
                06 / Experiencia en vivo
              </Typography>
              <Typography component="h2" id="rhb-live-title" className="brand-section-title">
                La historia se estudia a tu ritmo. La conversación ocurre en vivo.
              </Typography>
              <Typography component="p" className="brand-section-lead">
                Contenido bajo demanda más encuentros en vivo durante una ventana temporal. Puedes
                comenzar cuando te inscribes y avanzar a tu ritmo. Al final, opcionalmente, puedes tomar una prueba de conocimientos 
                para obtener un certificado de finalización que se guardará en la blockchain y un NFT de recuerdo.
              </Typography>
            </div>
            <ul className="rhb-live-points">
              <li>Profundizar acontecimientos y fuentes originales</li>
              <li>Examinar interpretaciones en diálogo con el profesor</li>
              <li>Preguntar y conversar con otros participantes</li>
              <li>Repeticiones previstas para distintos ritmos de avance</li>
            </ul>
          </div>

          <div className="rhb-calendar" aria-label="Calendario de encuentros">
            {MEETINGS.map((meeting) => (
              <article className="rhb-meeting" key={meeting.id}>
                <p className="rhb-meeting-label">Encuentro {meeting.id}</p>
                <h3>{meeting.topic}</h3>
                <div className="rhb-meeting-dates">
                  {meeting.dates.map((date, index) => (
                    <span key={date}>
                      Fecha {index + 1} — {date}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="rhb-window-note">
            <strong>Ventana:</strong> cada encuentro se ofrece dos veces, en lunes sucesivos, del 9 de
            Noviembre al 15 de Diciembre de 2026.
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-statement" aria-labelledby="rhb-audience-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            07 / Encaje
          </Typography>
          <Typography component="h2" id="rhb-audience-title" className="brand-section-title">
            Para quién es — y para quién no
          </Typography>
          <div className="rhb-audience">
            <div className="rhb-audience-col yes">
              <h3>Puede ser para ti si…</h3>
              <ul>
                {FOR_WHOM.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rhb-audience-col no">
              <h3>Probablemente no es para ti si buscas…</h3>
              <ul>
                {NOT_FOR.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-principle" aria-labelledby="rhb-guide-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            08 / Guía de investigación
          </Typography>
          <Typography component="h2" id="rhb-guide-title" className="brand-section-title">
            Quién guía el recorrido
          </Typography>
          <div className="rhb-guide">
            <figure className="rhb-guide-photo">
              <img
                src="/images/course_rhb_guide.png"
                alt="Alejandro Veintimilla hablando en una conferencia."
              />
            </figure>
            <div className="rhb-guide-copy">
              <Typography component="p" className="rhb-guide-name">
                Alejandro Veintimilla
              </Typography>
              <Typography component="p" className="rhb-guide-role">
                Guía de investigación → estudiante. No gurú → seguidor.
              </Typography>
              <Typography component="p">
                Fundador de Academia Blockchain, economista y desarrollador de software especializado
                en blockchain. Participa en el ecosistema Bitcoin y blockchain desde 2014–2015,
                combinando una perspectiva económica con la comprensión técnica que le dan más de 14
                años desarrollando software.
              </Typography>
              <Typography component="p">
                Desde 2015 ha enseñado y dado conferencias sobre Bitcoin, blockchain, dinero y poder
                en universidades, comunidades y eventos internacionales.
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
            09 / Inscripción
          </Typography>
          {priceLabel ? (
            <Typography component="h2" id="rhb-price-title" className="brand-section-title">
              {priceLabel}
            </Typography>
          ) : null}
          <Typography component="p" className="brand-section-lead rhb-centered-lead">
            {offerState === 'closed'
              ? 'La inscripción no está disponible en este momento.'
              : 'El camino, el acompañamiento con fuentes históricas y los tres encuentros en vivo. Quien pase el examen recibe un certificado en la blockchain y un NFT de recuerdo.'}
          </Typography>
          {offerState !== 'closed' ? (
            <div className="rhb-inline-cta">
              <Button
                component={Link}
                to="/courses/real-historia-bitcoin/checkout"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                className="brand-button brand-button-primary"
              >
                Subscribirse
              </Button>
            </div>
          ) : null}
        </Container>
      </section>

      <footer className="brand-footer">
        <Container maxWidth="lg">
          <div className="brand-footer-inner">
            <Typography component="p">ACADEMIA BLOCKCHAIN</Typography>
            <Typography component="p" className="brand-footer-mission">
              Claridad. Curiosidad. Independencia.
            </Typography>
            <nav aria-label="Navegación del curso">
              <Link to="/">Inicio</Link>
              <a href="#inscripcion" onClick={(event) => scrollToHash(event, 'inscripcion')}>
                Inscripción
              </a>
            </nav>
          </div>
        </Container>
      </footer>
    </Box>
  );
};

export default RealHistoriaBitcoinLanding;
