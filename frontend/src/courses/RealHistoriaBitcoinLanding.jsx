import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Box, Button, Container, Typography } from '@mui/material';
import '../styles/brand-home.css';
import '../styles/course-real-historia-bitcoin.css';

const FORCES = [
  'Ideas',
  'Personas',
  'Código',
  'Dinero',
  'Bitcoin',
  'Poder',
  'Comunidad',
  'Incentivos',
  'Infraestructura',
];

const VISIONS = [
  'Dinero electrónico P2P',
  'Red global de pagos',
  'Reserva de valor',
  'Activo financiero',
  'Capa base de liquidación',
  'Infraestructura para sistemas posteriores',
];

const RESEARCH_PATH = [
  {
    period: 'Antes de Bitcoin',
    question: '¿Qué ideas hicieron posible Bitcoin?',
    meta: 'Criptografía, privacidad, dinero digital, Cypherpunks y redes P2P.',
  },
  {
    period: 'Satoshi',
    question: '¿Qué problema intentaba resolver?',
    meta: 'El white paper, el contexto y la propuesta original.',
  },
  {
    period: 'Los primeros años',
    question: '¿Qué imaginaban quienes comenzaron a utilizarlo?',
    meta: 'Primeras comunidades, usos emergentes y tensiones iniciales.',
  },
  {
    period: 'La guerra del escalado',
    question: '¿Qué debía ser Bitcoin?',
    meta: 'Conflictos técnicos, económicos e ideológicos sobre su dirección.',
  },
  {
    period: 'La división',
    question: '¿Qué ocurrió cuando las visiones dejaron de ser compatibles?',
    meta: 'Rupturas, forks y la redefinición de narrativas.',
  },
  {
    period: 'Después de la guerra',
    question: '¿Cómo llegamos al Bitcoin actual?',
    meta: 'El ecosistema más amplio y las consecuencias de esas decisiones.',
  },
];

const SOURCES = [
  { title: 'Documentos originales', copy: 'Textos fundacionales y archivos históricos.' },
  { title: 'White Paper', copy: 'La propuesta de Satoshi en su contexto.' },
  { title: 'Discusiones', copy: 'Foros, listas y debates de época.' },
  { title: 'Código', copy: 'Decisiones técnicas hechas visibles.' },
  { title: 'Entrevistas', copy: 'Voces de quienes participaron.' },
  { title: 'Cronologías', copy: 'Secuencias para conectar episodios.' },
  { title: 'Fuentes primarias', copy: 'Materiales de primera mano.' },
  { title: 'Fuentes secundarias', copy: 'Interpretaciones para contrastar.' },
];

const FOR_WHOM = [
  'Personas que usan Bitcoin y quieren comprender su historia',
  'Quienes siguen criptomonedas y quieren ir más allá del precio',
  'Desarrolladores y tecnólogos interesados en el contexto histórico',
  'Estudiantes de economía, dinero o sistemas monetarios',
  'Curiosos por Cypherpunks, privacidad y cultura de Internet',
  'Quienes vivieron partes de la historia y nunca reconstruyeron el panorama completo',
];

const NOT_FOR = [
  'Señales de trading',
  'Recomendaciones de inversión',
  'Predicciones de precio',
  'Fórmulas para hacerse rico con criptomonedas',
  'Una explicación de cinco minutos que elimine toda complejidad',
];

const INCLUDES_CONFIRMED = [
  'Recorrido estructurado bajo demanda',
  'Materiales y documentos históricos',
  'Cronología',
  'Bibliografía y fuentes',
  'Encuentros en vivo durante la ventana activa',
];

const INCLUDES_TBD = [
  'Grabaciones de encuentros',
  'Espacio de comunidad',
  'Duración del acceso al contenido',
  'Credencial o certificado',
];

const MEETINGS = [
  { id: '01', topic: 'Tema por definir' },
  { id: '02', topic: 'Tema por definir' },
  { id: '03', topic: 'Tema por definir' },
];

const FAQS = [
  {
    q: '¿Necesito conocimientos previos sobre Bitcoin?',
    a: 'Respuesta por definir. La intención es que no se requiera conocimiento técnico avanzado; bastará curiosidad y disposición a leer fuentes.',
    tbd: true,
  },
  {
    q: '¿Es un curso técnico?',
    a: 'Respuesta por definir. Habrá código y decisiones técnicas en contexto, pero el eje es histórico, intelectual y humano.',
    tbd: true,
  },
  {
    q: '¿Es un curso de inversión o trading?',
    a: 'No. El curso tiene un enfoque histórico, intelectual y educativo. No ofrece señales, predicciones ni asesoría financiera.',
  },
  {
    q: '¿Puedo comenzar después de la fecha de lanzamiento?',
    a: 'Sí, mientras las inscripciones permanezcan abiertas. El contenido puede recorrerse a tu ritmo.',
  },
  {
    q: '¿Qué ocurre si no puedo asistir a un encuentro en vivo?',
    a: 'La intención es ofrecer más de una oportunidad para determinados encuentros. Política definitiva por confirmar.',
    tbd: true,
  },
  {
    q: '¿Se graban los encuentros?',
    a: 'Por definir.',
    tbd: true,
  },
  {
    q: '¿Hasta cuándo puedo participar en encuentros en vivo?',
    a: 'Ventana aproximada hasta finales de noviembre de 2026. Fecha definitiva por definir.',
    tbd: true,
  },
  {
    q: '¿Cuánto tiempo tengo acceso al contenido?',
    a: 'Por definir.',
    tbd: true,
  },
  {
    q: '¿Dónde ocurre el curso?',
    a: 'En Academia Blockchain. Detalle técnico de la plataforma por confirmar.',
    tbd: true,
  },
  {
    q: '¿Hay certificado o credencial?',
    a: 'Por definir.',
    tbd: true,
  },
  {
    q: '¿En qué idioma se imparte?',
    a: 'Presumiblemente en español. Idioma(s) definitivos por confirmar.',
    tbd: true,
  },
];

const scrollToHash = (event, id) => {
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
};

const RealHistoriaBitcoinLanding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'La guerra por las criptomonedas — Academia Blockchain';
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
              La guerra por las criptomonedas
            </Typography>
            <Typography component="p" className="rhb-hero-subtitle">
              La real historia de Bitcoin
            </Typography>
            <Typography component="p" className="brand-hero-lead">
              Una investigación guiada sobre las ideas, personas y conflictos que transformaron Bitcoin.
            </Typography>
            <Box className="brand-hero-actions rhb-hero-actions">
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                href="#recorrido"
                onClick={(event) => scrollToHash(event, 'recorrido')}
                className="brand-button brand-button-primary"
              >
                Explorar el curso
              </Button>
              <Button
                variant="text"
                href="#recorrido"
                onClick={(event) => scrollToHash(event, 'recorrido')}
                className="brand-button brand-button-secondary"
              >
                Ver el recorrido
              </Button>
            </Box>
            <div className="rhb-hero-signals" aria-label="Qué incluye la experiencia">
              <span>Contenido estructurado</span>
              <span>Investigación histórica</span>
              <span>Encuentros en vivo</span>
            </div>
          </Box>
        </Container>
      </section>

      <section className="rhb-section brand-statement" aria-labelledby="rhb-rupture-title">
        <Container maxWidth="lg">
          <div className="brand-section-grid">
            <div>
              <Typography component="p" className="brand-section-index">
                01 / La ruptura
              </Typography>
              <Typography component="h2" id="rhb-rupture-title" className="brand-section-title">
                Creías conocer la historia de Bitcoin
              </Typography>
              <Typography component="p" className="rhb-quote">
                La historia de Bitcoin no comienza —ni termina— con Satoshi.
              </Typography>
            </div>
            <div className="brand-statement-copy">
              <Typography component="p">
                Bitcoin no apareció de la nada. Antes existieron décadas de ideas. Después comenzó otra
                historia: una disputa sobre qué debía ser Bitcoin.
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
              Bitcoin no evolucionó únicamente como tecnología. Su historia también está formada por
              seres humanos, intereses, desacuerdos, interpretaciones y decisiones.
            </Typography>
          </div>
          <div className="rhb-forces" aria-label="Fuerzas que rodean a Bitcoin">
            {FORCES.map((force) => (
              <div
                key={force}
                className={force === 'Bitcoin' ? 'rhb-force rhb-force-core' : 'rhb-force'}
              >
                {force}
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-principle" aria-labelledby="rhb-war-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            03 / Visiones en conflicto
          </Typography>
          <Typography component="h2" id="rhb-war-title" className="brand-section-title">
            Una guerra sobre qué debía ser Bitcoin
          </Typography>
          <Typography component="p" className="brand-section-lead" style={{ maxWidth: '40rem' }}>
            Existieron —y existen— interpretaciones distintas. El curso no impone cuál es la correcta:
            reconstruye cómo aparecieron y qué ocurrió cuando entraron en conflicto.
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
            Una ruta de investigación histórica. Cada etapa conecta periodo, pregunta y conflicto —
            no una lista genérica de módulos.
          </Typography>
          <span className="rhb-placeholder">Currículo definitivo por insertar</span>
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
            Trabajar con fuentes
          </Typography>
          <Typography component="p" className="rhb-quote rhb-quote-light">
            No queremos decirte qué pensar sobre la historia de Bitcoin. Queremos darte suficiente
            contexto para que puedas examinarla.
          </Typography>
          <Typography component="p" className="brand-section-lead" style={{ color: '#c7c3bb', marginTop: 28 }}>
            El recorrido no es únicamente la interpretación de un profesor. Incluye documentos,
            discusiones, código y archivos para que construyas tu propio criterio.
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
                comenzar cuando te inscribes y avanzar a tu ritmo.
              </Typography>
            </div>
            <ul className="rhb-live-points">
              <li>Profundizar acontecimientos y fuentes</li>
              <li>Examinar interpretaciones en diálogo</li>
              <li>Conectar ideas entre etapas del recorrido</li>
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
                  <span>Fecha 1 — por definir</span>
                  <span>Fecha 2 — por definir</span>
                </div>
              </article>
            ))}
          </div>

          <div className="rhb-window-note">
            <strong>Ventana aproximada:</strong> apertura hacia finales de octubre de 2026; encuentros
            en vivo hasta alrededor de finales de noviembre de 2026. Fechas exactas por definir.
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
        <Container maxWidth="md">
          <Typography component="p" className="brand-section-index">
            08 / Guía de investigación
          </Typography>
          <Typography component="h2" id="rhb-guide-title" className="brand-section-title">
            Quién guía el recorrido
          </Typography>
          <div className="rhb-panel">
            <Typography component="p">
              Relación esperada: guía de investigación → estudiante. No gurú → seguidor.
            </Typography>
            <Typography component="p">
              Biografía definitiva por insertar: quién guía la investigación, relación con Academia
              Blockchain, experiencia relevante, por qué reconstruir esta historia y con qué
              metodología.
            </Typography>
            <span className="rhb-placeholder">Biografía del profesor — por definir</span>
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-ecosystem" aria-labelledby="rhb-includes-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index">
            09 / Qué incluye
          </Typography>
          <Typography component="h2" id="rhb-includes-title" className="brand-section-title">
            Lo que forma parte de la experiencia
          </Typography>
          <div className="rhb-panel">
            <ul className="rhb-includes">
              {INCLUDES_CONFIRMED.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {INCLUDES_TBD.map((item) => (
                <li className="is-tbd" key={item}>
                  {item} — por confirmar
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-statement" id="inscripcion" aria-labelledby="rhb-price-title">
        <Container maxWidth="md">
          <Typography component="p" className="brand-section-index">
            10 / Inscripción
          </Typography>
          <Typography component="h2" id="rhb-price-title" className="brand-section-title">
            Precio y condiciones
          </Typography>
          <div className="rhb-panel">
            <dl className="rhb-price-rows">
              <div className="rhb-price-row">
                <dt>Precio</dt>
                <dd>
                  <span className="rhb-price-amount">Por definir</span>
                </dd>
              </div>
              <div className="rhb-price-row">
                <dt>Qué incluye</dt>
                <dd>Recorrido bajo demanda, fuentes y encuentros en vivo.</dd>
              </div>
              <div className="rhb-price-row">
                <dt>Duración / acceso</dt>
                <dd>
                  Por definir
                  <div>
                    <span className="rhb-placeholder">Acceso y condiciones — por definir</span>
                  </div>
                </dd>
              </div>
              <div className="rhb-price-row">
                <dt>Encuentros</dt>
                <dd>Ventana aproximada: finales de octubre – finales de noviembre de 2026.</dd>
              </div>
              <div className="rhb-price-row">
                <dt>Condiciones</dt>
                <dd>
                  Sin precios tachados artificiales ni descuentos falsos. Si hay precio de
                  lanzamiento, se explicará la condición real.
                </dd>
              </div>
            </dl>
            <div className="rhb-inline-cta">
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/unirme')}
                className="brand-button brand-button-primary"
              >
                Avisarme cuando abran las inscripciones
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <section className="rhb-section brand-principle" aria-labelledby="rhb-faq-title">
        <Container maxWidth="md">
          <Typography component="p" className="brand-section-index">
            11 / Preguntas
          </Typography>
          <Typography component="h2" id="rhb-faq-title" className="brand-section-title">
            Preguntas frecuentes
          </Typography>
          <div className="rhb-faq">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>
                  {item.a}
                  {item.tbd ? (
                    <>
                      {' '}
                      <span className="rhb-placeholder">Por definir</span>
                    </>
                  ) : null}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section className="rhb-final" aria-labelledby="rhb-final-title">
        <Container maxWidth="lg">
          <div className="rhb-final-inner">
            <Typography component="p" className="brand-section-index brand-section-index-light">
              Comprender es libertad
            </Typography>
            <h2 id="rhb-final-title">Bitcoin tiene una historia.</h2>
            <p>Pero comprenderla requiere conectar piezas que normalmente se cuentan por separado.</p>
            <div className="rhb-final-actions">
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                href="#recorrido"
                onClick={(event) => scrollToHash(event, 'recorrido')}
                className="brand-button brand-button-light"
              >
                Explorar el curso
              </Button>
              <Button
                variant="text"
                href="#inscripcion"
                onClick={(event) => scrollToHash(event, 'inscripcion')}
                className="brand-button brand-button-secondary"
              >
                Comenzar la investigación
              </Button>
            </div>
            <p className="rhb-tagline">Comprender es libertad.</p>
          </div>
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
