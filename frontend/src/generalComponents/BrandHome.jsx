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
import '../styles/brand-home.css';

const SOCIAL_LINKS = [
  ['YouTube', 'https://www.youtube.com/@AcademiaBlockchain'],
  ['Facebook', 'https://www.facebook.com/AcademiaBlockchain/'],
  ['X', 'https://x.com/aca_blockchain'],
  ['Instagram', 'https://www.instagram.com/aca_blockchain/'],
];

const ECOSYSTEM = [
  { icon: AutoStoriesIcon, number: '01', title: 'Biblioteca y colecciones', copy: 'Encuentra libros, videos, audios, textos e imágenes. Guarda favoritos, crea colecciones y organiza tu propia biblioteca. Puedes enviar el hash de una transcripción a la blockchain de Bitcoin, inmortalizándolo. Y, lo más importante: eres libre de descargar el contenido.', to: '/search', action: 'Explorar la biblioteca' },
  { icon: HubIcon, number: '02', title: 'Temas e investigación', copy: 'Sigue líneas de tiempo, crea temas, nombra moderadores y relaciona contenido colaborativamente. Vota a favor del contenido que resulta más valioso. También puedes consultar transcripciones con inteligencia artificial.', to: '/content/topics', action: 'Investigar temas' },
  { icon: RouteIcon, number: '03', title: 'Caminos de conocimiento', copy: 'Recorre contenidos en secuencia, registra tu progreso, responde quizzes y solicita certificados como NFTs. También, puedes compartir tu conocimiento creando tus propios caminos', to: '/knowledge_path', action: 'Ver caminos' },
  { icon: EventIcon, number: '04', title: 'Eventos', copy: 'Descubre y organiza encuentros educativos para llevar las ideas de la pantalla a la conversación en vivo. Y, cómo no, puedes pagar utilizando criptomonedas (dinero libre).', to: '/events', action: 'Ver eventos' },
];

const BrandHome = () => {
  const navigate = useNavigate();
  const heroPrimaryAction = { label: 'Explorar caminos de conocimiento', to: '/knowledge_path' };
  const primaryAction = { label: 'Explorar la biblioteca', to: '/search' };
  const secondaryAction = { label: 'Descubrir temas', to: '/content/topics' };

  return (
    <Box className="brand-home">
      <section className="brand-hero" aria-labelledby="brand-hero-title">
        <div className="brand-hero-visual" aria-hidden="true">
          <div className="brand-orbit brand-orbit-one" /><div className="brand-orbit brand-orbit-two" /><div className="brand-orbit brand-orbit-three" />
          <div className="brand-node brand-node-one" /><div className="brand-node brand-node-two" /><div className="brand-node brand-node-three" />
        </div>
        <Container maxWidth="lg" className="brand-hero-container">
          <Box className="brand-hero-copy">
            <Typography component="p" className="brand-kicker">Un ecosistema para explorar ideas</Typography>
            <Typography component="h1" id="brand-hero-title" className="brand-display">Comprender<br />es libertad.</Typography>
            <Typography component="p" className="brand-hero-lead">
              Explora contenidos, recorre caminos de aprendizaje, investiga temas y conversa con
              una comunidad que valora las buenas preguntas.
            </Typography>
            <Box className="brand-hero-actions">
              <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => navigate(heroPrimaryAction.to)} className="brand-button brand-button-primary">{heroPrimaryAction.label}</Button>
              <Button variant="text" onClick={() => navigate(secondaryAction.to)} className="brand-button brand-button-secondary">{secondaryAction.label}</Button>
            </Box>
            <Typography component="p" className="brand-hero-note">
              Aprende a tu ritmo. Investiga con otros. Conserva tu independencia.
            </Typography>
          </Box>
        </Container>
      </section>

      <section className="brand-statement" aria-labelledby="world-title">
        <Container maxWidth="lg"><div className="brand-section-grid">
          <div><Typography component="p" className="brand-section-index">01 / EL PUNTO DE PARTIDA</Typography><Typography component="h2" id="world-title" className="brand-section-title">Más información no significa más claridad.</Typography></div>
          <div className="brand-statement-copy">
            <Typography component="p">Tenemos acceso a más libros, videos, artículos y respuestas que nunca. Aun así, el conocimiento suele llegar fragmentado y fuera de contexto.</Typography>
            <Typography component="p" className="brand-emphasis-copy">Aprender exige relacionar fuentes, contrastar perspectivas y poner las ideas en conversación.</Typography>
            <Typography component="p">Academia Blockchain reúne herramientas y personas para que puedas investigar con curiosidad, construir criterio y decidir qué pensar por ti mismo.</Typography>
          </div>
        </div></Container>
      </section>

      <section className="brand-about" aria-labelledby="about-title">
        <Container maxWidth="lg">
          <Typography component="p" className="brand-section-index brand-section-index-light">02 / NUESTRA IDENTIDAD</Typography>
          <div className="brand-about-grid">
            <div className="brand-about-heading">
              <Typography component="h2" id="about-title" className="brand-section-title brand-section-title-light">¿Qué es Academia Blockchain?</Typography>
              <Typography component="p" className="brand-about-quote">El conocimiento es poder.</Typography>
            </div>
            <div className="brand-about-copy">
              <Typography component="p">Academia Blockchain es un territorio intelectual donde el conocimiento no es un recurso secuestrado por instituciones, algoritmos o intereses económicos. No somos una academia de trading ni una criptomoneda, utilizamos la blockchain de una manera liberadora. Somos un espacio donde la comunidad enlaza saberes, los reorganiza y los libera, como lo hacía el espíritu original de internet.</Typography>
              <Typography component="p">Surgimos frente a una realidad incómoda: la arquitectura del conocimiento moderno está a la merced de la censura, la manipulación y la concentración del poder. El buscador y la IA que deberían abrir puertas en realidad deciden qué mostrar; la universidad, que debería iluminar, se ha convertido en un club elitista y engañoso; las revistas científicas, que deberían custodiar la verdad, a menudo se someten a intereses políticos o económicos. En ese ruido, lo esencial se pierde: la capacidad de comprender un mundo cada vez más complejo.</Typography>
              <Typography component="p">En Academia Blockchain, las ideas se conectan entre sí de forma colaborativa mediante caminos del conocimiento y temas. Los contenidos pueden relacionarse, descargarse, organizarse y preservarse gracias al uso de tecnologías como IPFS (próximamente) y blockchain. Además, puedes utilizar la IA para interactuar con las transcripciones de los temas que investigas.</Typography>
            </div>
          </div>
        </Container>
      </section>

      <section className="brand-ecosystem" aria-labelledby="ecosystem-title">
        <Container maxWidth="lg">
          <div className="brand-section-grid brand-section-grid-top">
            <div><Typography component="p" className="brand-section-index">03 / LO QUE PUEDES HACER</Typography><Typography component="h2" id="ecosystem-title" className="brand-section-title">Aprende, investiga y participa.</Typography></div>
            <Typography component="p" className="brand-section-lead">La plataforma combina recursos, recorridos y espacios sociales. Elige una puerta de entrada y construye tu propia experiencia.</Typography>
          </div>
          <div className="brand-ecosystem-grid">
            {ECOSYSTEM.map(({ icon: Icon, number, title, copy, to, action }) => (
              <article className="brand-ecosystem-card" key={title}>
                <div className="brand-card-topline"><Icon aria-hidden="true" /><span>{number}</span></div>
                <Typography component="h3">{title}</Typography><Typography component="p">{copy}</Typography>
                <Link to={to} className="brand-card-link">
                  {action} <ArrowForwardIcon aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="brand-principle" aria-labelledby="principle-title"><Container maxWidth="md">
        <PsychologyIcon className="brand-principle-icon" aria-hidden="true" />
        <Typography component="p" className="brand-section-index">NUESTRO PRINCIPIO</Typography>
        <Typography component="h2" id="principle-title">La tecnología debe amplificar el juicio humano, no reemplazarlo.</Typography>
        <Typography component="p" className="brand-principle-copy">Las consultas con fuentes, los caminos, los quizzes y las herramientas comunitarias acompañan tu proceso. Tu criterio sigue siendo el centro.</Typography>
      </Container></section>

      <section className="brand-final-cta" aria-labelledby="final-cta-title"><Container maxWidth="lg"><div className="brand-final-cta-inner">
        <div><Typography component="p" className="brand-section-index brand-section-index-light">COMPRENDER EL MUNDO TE DARÁ PAZ MENTAL</Typography><Typography component="h2" id="final-cta-title">Sigue tu curiosidad.</Typography></div>
        <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => navigate(primaryAction.to)} className="brand-button brand-button-light">{primaryAction.label}</Button>
      </div></Container></section>

      <footer className="brand-footer"><Container maxWidth="lg"><div className="brand-footer-inner">
        <Typography component="p">ACADEMIA BLOCKCHAIN</Typography><Typography component="p" className="brand-footer-mission">Claridad. Curiosidad. Independencia.</Typography>
        <nav aria-label="Redes sociales">{SOCIAL_LINKS.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}</nav>
      </div></Container></footer>
    </Box>
  );
};

export default BrandHome;
