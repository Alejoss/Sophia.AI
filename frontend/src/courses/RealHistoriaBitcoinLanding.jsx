import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const RealHistoriaBitcoinLanding = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'La guerra por las criptomonedas — Academia Blockchain';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="rhb-page">
      <header className="rhb-hero" aria-labelledby="rhb-hero-title">
        <div className="rhb-hero-grid" aria-hidden="true" />
        <div className="rhb-shell rhb-topbar">
          <RouterLink to="/" className="rhb-brand-link">
            <img src="/images/logo.png" alt="" />
            <span>Academia Blockchain</span>
          </RouterLink>
          <a className="rhb-topbar-cta" href="#inscripcion">
            Inscripción
          </a>
        </div>

        <div className="rhb-shell rhb-hero-content">
          <p className="rhb-kicker">Academia Blockchain</p>
          <h1 className="rhb-hero-title" id="rhb-hero-title">
            La guerra por las criptomonedas
          </h1>
          <p className="rhb-hero-subtitle">La real historia de Bitcoin</p>
          <p className="rhb-hero-lead">
            Una investigación guiada sobre las ideas, personas y conflictos que transformaron Bitcoin.
          </p>
          <div className="rhb-hero-actions">
            <button type="button" className="rhb-btn rhb-btn-primary" onClick={() => scrollToId('recorrido')}>
              Explorar el curso
            </button>
            <button type="button" className="rhb-btn rhb-btn-ghost" onClick={() => scrollToId('recorrido')}>
              Ver el recorrido
            </button>
          </div>
          <div className="rhb-hero-signals" aria-label="Qué incluye la experiencia">
            <span>Contenido estructurado</span>
            <span>Investigación histórica</span>
            <span>Encuentros en vivo</span>
          </div>
        </div>
      </header>

      <main>
        <section className="rhb-section rhb-section-mid" aria-labelledby="rhb-rupture-title">
          <div className="rhb-shell rhb-rupture-grid">
            <div>
              <p className="rhb-index">01 / La ruptura</p>
              <h2 className="rhb-h2" id="rhb-rupture-title">
                Creías conocer la historia de Bitcoin
              </h2>
              <p className="rhb-quote">
                La historia de Bitcoin no comienza —ni termina— con Satoshi.
              </p>
            </div>
            <div>
              <p className="rhb-lead">
                Bitcoin no apareció de la nada. Antes existieron décadas de ideas. Después comenzó otra
                historia: una disputa sobre qué debía ser Bitcoin.
              </p>
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
        </section>

        <section className="rhb-section rhb-section-dark" aria-labelledby="rhb-question-title">
          <div className="rhb-shell">
            <div className="rhb-question-block">
              <p className="rhb-index">02 / La pregunta central</p>
              <h2 className="rhb-h2" id="rhb-question-title">
                ¿Cómo llegó Bitcoin a convertirse en lo que es hoy?
              </h2>
              <p className="rhb-lead" style={{ marginInline: 'auto' }}>
                Bitcoin no evolucionó únicamente como tecnología. Su historia también está formada por
                seres humanos, intereses, desacuerdos, interpretaciones y decisiones.
              </p>
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
          </div>
        </section>

        <section className="rhb-section rhb-section-charcoal" aria-labelledby="rhb-war-title">
          <div className="rhb-shell">
            <p className="rhb-index">03 / Visiones en conflicto</p>
            <h2 className="rhb-h2" id="rhb-war-title">
              Una guerra sobre qué debía ser Bitcoin
            </h2>
            <p className="rhb-lead">
              Existieron —y existen— interpretaciones distintas. El curso no impone cuál es la
              correcta: reconstruye cómo aparecieron y qué ocurrió cuando entraron en conflicto.
            </p>
            <div className="rhb-visions">
              {VISIONS.map((vision, i) => (
                <article className="rhb-vision" key={vision}>
                  <span>Visión {String(i + 1).padStart(2, '0')}</span>
                  <p>Bitcoin como {vision.toLowerCase()}</p>
                </article>
              ))}
            </div>
            <div className="rhb-inline-cta">
              <button type="button" className="rhb-btn rhb-btn-ghost" onClick={() => scrollToId('recorrido')}>
                Ver el recorrido
              </button>
            </div>
          </div>
        </section>

        <section
          className="rhb-section rhb-section-mid"
          id="recorrido"
          aria-labelledby="rhb-path-title"
        >
          <div className="rhb-shell">
            <p className="rhb-index">04 / El recorrido</p>
            <h2 className="rhb-h2" id="rhb-path-title">
              Lo que vas a investigar
            </h2>
            <p className="rhb-lead">
              Una ruta de investigación histórica. Cada etapa conecta periodo, pregunta y conflicto —
              no una lista genérica de módulos.
            </p>
            <span className="rhb-placeholder-pill">Currículo definitivo por insertar</span>
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
          </div>
        </section>

        <section className="rhb-section rhb-section-dark" aria-labelledby="rhb-sources-title">
          <div className="rhb-shell">
            <p className="rhb-index">05 / Método</p>
            <h2 className="rhb-h2" id="rhb-sources-title">
              Trabajar con fuentes
            </h2>
            <p className="rhb-quote">
              No queremos decirte qué pensar sobre la historia de Bitcoin. Queremos darte suficiente
              contexto para que puedas examinarla.
            </p>
            <p className="rhb-lead">
              El recorrido no es únicamente la interpretación de un profesor. Incluye documentos,
              discusiones, código y archivos para que construyas tu propio criterio.
            </p>
            <div className="rhb-sources-grid">
              {SOURCES.map((item) => (
                <div className="rhb-source-item" key={item.title}>
                  <strong>{item.title}</strong>
                  {item.copy}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="rhb-section rhb-section-mid"
          id="vivo"
          aria-labelledby="rhb-live-title"
        >
          <div className="rhb-shell">
            <div className="rhb-live-intro">
              <div>
                <p className="rhb-index">06 / Experiencia en vivo</p>
                <h2 className="rhb-h2" id="rhb-live-title">
                  La historia se estudia a tu ritmo. La conversación ocurre en vivo.
                </h2>
                <p className="rhb-lead">
                  Contenido bajo demanda más encuentros en vivo durante una ventana temporal. Puedes
                  comenzar cuando te inscribes y avanzar a tu ritmo. La conversación, en cambio,
                  ocurre en tiempo real.
                </p>
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
              en vivo hasta alrededor de finales de noviembre de 2026. Fechas exactas por definir. La
              urgencia es real solo mientras dura la ventana de conversación en vivo — no hay falsa
              escasez.
            </div>
          </div>
        </section>

        <section className="rhb-section rhb-section-dark" aria-labelledby="rhb-audience-title">
          <div className="rhb-shell">
            <p className="rhb-index">07 / Encaje</p>
            <h2 className="rhb-h2" id="rhb-audience-title">
              Para quién es — y para quién no
            </h2>
            <div className="rhb-audience-grid">
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
            <p className="rhb-body">
              El curso trata Bitcoin como un fenómeno histórico, tecnológico, monetario y humano.
            </p>
          </div>
        </section>

        <section className="rhb-section rhb-section-charcoal" aria-labelledby="rhb-guide-title">
          <div className="rhb-shell-narrow">
            <p className="rhb-index">08 / Guía de investigación</p>
            <h2 className="rhb-h2" id="rhb-guide-title">
              Quién guía el recorrido
            </h2>
            <div className="rhb-guide-panel">
              <p className="rhb-lead" style={{ marginTop: 0 }}>
                Relación esperada: guía de investigación → estudiante. No gurú → seguidor.
              </p>
              <p className="rhb-body">
                Biografía definitiva por insertar: quién guía la investigación, relación con Academia
                Blockchain, experiencia relevante, por qué reconstruir esta historia y con qué
                metodología.
              </p>
              <span className="rhb-placeholder-pill">Biografía del profesor — por definir</span>
            </div>
          </div>
        </section>

        <section className="rhb-section rhb-section-mid" aria-labelledby="rhb-includes-title">
          <div className="rhb-shell">
            <p className="rhb-index">09 / Qué incluye</p>
            <h2 className="rhb-h2" id="rhb-includes-title">
              Lo que forma parte de la experiencia
            </h2>
            <div className="rhb-includes-panel">
              <ul className="rhb-includes-list">
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
          </div>
        </section>

        <section
          className="rhb-section rhb-section-dark"
          id="inscripcion"
          aria-labelledby="rhb-price-title"
        >
          <div className="rhb-shell-narrow">
            <p className="rhb-index">10 / Inscripción</p>
            <h2 className="rhb-h2" id="rhb-price-title">
              Precio y condiciones
            </h2>
            <div className="rhb-price-panel">
              <dl className="rhb-price-rows">
                <div className="rhb-price-row">
                  <dt>Precio</dt>
                  <dd>
                    <span className="rhb-price-amount">Por definir</span>
                  </dd>
                </div>
                <div className="rhb-price-row">
                  <dt>Qué incluye</dt>
                  <dd>Recorrido bajo demanda, fuentes y encuentros en vivo (detalle completo arriba).</dd>
                </div>
                <div className="rhb-price-row">
                  <dt>Duración / acceso</dt>
                  <dd>
                    Por definir
                    <span className="rhb-placeholder-pill">Acceso y condiciones — por definir</span>
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
                <RouterLink to="/unirme" className="rhb-btn rhb-btn-primary">
                  Avisarme cuando abran las inscripciones
                </RouterLink>
              </div>
            </div>
          </div>
        </section>

        <section className="rhb-section rhb-section-mid" aria-labelledby="rhb-faq-title">
          <div className="rhb-shell-narrow">
            <p className="rhb-index">11 / Preguntas</p>
            <h2 className="rhb-h2" id="rhb-faq-title">
              Preguntas frecuentes
            </h2>
            <div className="rhb-faq">
              {FAQS.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>
                    {item.a}
                    {item.tbd ? (
                      <>
                        {' '}
                        <span className="rhb-placeholder-pill">Por definir</span>
                      </>
                    ) : null}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="rhb-final" aria-labelledby="rhb-final-title">
          <div className="rhb-shell-narrow">
            <h2 id="rhb-final-title">Bitcoin tiene una historia.</h2>
            <p>
              Pero comprenderla requiere conectar piezas que normalmente se cuentan por separado.
            </p>
            <div className="rhb-final-actions">
              <button type="button" className="rhb-btn rhb-btn-primary" onClick={() => scrollToId('recorrido')}>
                Explorar La guerra por las criptomonedas
              </button>
              <button type="button" className="rhb-btn rhb-btn-ghost" onClick={() => scrollToId('inscripcion')}>
                Comenzar la investigación
              </button>
            </div>
            <p className="rhb-tagline">Comprender es libertad.</p>
          </div>
        </section>
      </main>

      <footer className="rhb-shell rhb-footer">
        <span>Academia Blockchain</span>
        <RouterLink to="/">Volver al inicio</RouterLink>
      </footer>
    </div>
  );
};

export default RealHistoriaBitcoinLanding;
