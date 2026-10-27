# Academia Blockchain: información de las páginas del frontend

Extracción del repositorio local realizada el 26 de octubre de 2026. Se conserva el texto informativo en español, incluidos mensajes promocionales y afirmaciones de las páginas; no constituye una auditoría de las funcionalidades implementadas. About conserva además su texto original en inglés.

Alcance: portada actual y su sección de identidad, los dos capítulos de Cómo funciona, páginas públicas de comunidad y curso, Home anterior (sus dos variantes) y About. Se excluyen formularios operativos, paneles privados, mensajes de errores y pantallas de mantenimiento. Los videos y las imágenes se referencian; su contenido audiovisual no se ha transcrito. Los datos obtenidos de la API no se inventan.

Estado de navegación: `frontend/src/App.jsx` usa `BrandHome.jsx` para `/`. No importa ni monta `Home.jsx` o `About.jsx`; estos últimos se incluyen como material histórico presente en el código. `/como-funciona` redirige al primer capítulo.

## 1. Home actual — /

Fuentes: `frontend/src/generalComponents/BrandHome.jsx`, `frontend/src/locales/es/home.json`.

### Un ecosistema para explorar ideas

### Comprender es libertad.

Explora contenidos, recorre caminos de aprendizaje, investiga temas y conversa con una comunidad que valora las buenas preguntas.

Aprende a tu ritmo. Investiga con otros. Conserva tu independencia.

Acciones: [Explorar caminos de conocimiento](/knowledge_path) · [Descubrir temas](/content/topics).

### 01 / EL PUNTO DE PARTIDA — Más información no significa más claridad.

Tenemos acceso a más libros, videos, artículos y respuestas que nunca. Aun así, el conocimiento suele llegar fragmentado y fuera de contexto.

Aprender exige relacionar fuentes, contrastar perspectivas y poner las ideas en conversación.

Academia Blockchain reúne herramientas y personas para que puedas investigar con curiosidad, construir criterio y decidir qué pensar por ti mismo.

En lugar de entregarle tu atención a un muro de recomendaciones, puedes volver a explorar con intención.

Descubre por qué aprender sin depender del algoritmo

Guía relacionada: `/como-funciona/aprender-sin-algoritmos`.

### 02 / NUESTRA IDENTIDAD — ¿Qué es Academia Blockchain?

El conocimiento es poder.

Academia Blockchain es un territorio intelectual donde el conocimiento no es un recurso secuestrado por instituciones, algoritmos o intereses económicos. No somos una academia de trading ni una criptomoneda, utilizamos la blockchain de una manera liberadora. Somos un espacio donde la comunidad enlaza saberes, los reorganiza y los libera, como lo hacía el espíritu original de internet.

Surgimos frente a una realidad incómoda: la arquitectura del conocimiento moderno está a la merced de la censura, la manipulación y la concentración del poder. El buscador y la IA que deberían abrir puertas en realidad deciden qué mostrar; la universidad, que debería iluminar, se ha convertido en un club elitista y engañoso; las revistas científicas, que deberían custodiar la verdad, a menudo se someten a intereses políticos o económicos. En ese ruido, lo esencial se pierde: la capacidad de comprender un mundo cada vez más complejo.

En Academia Blockchain, las ideas se conectan entre sí de forma colaborativa mediante caminos del conocimiento y temas. Los contenidos pueden relacionarse, descargarse, organizarse y preservarse gracias al uso de tecnologías como IPFS (próximamente) y blockchain. Además, puedes utilizar la IA para interactuar con las transcripciones de los temas que investigas.

Conservar un archivo cambia tu relación con el conocimiento.

Conoce por qué puedes descargarlo y ayudar a preservarlo

Guía relacionada: `/como-funciona/archivo-y-preservacion`.

### 03 / LO QUE PUEDES HACER — Aprende, investiga y participa.

La plataforma combina recursos, recorridos y espacios sociales. Elige una puerta de entrada y construye tu propia experiencia.

#### Biblioteca y colecciones

Encuentra libros, videos, audios, textos e imágenes. Guarda favoritos, crea colecciones y organiza tu propia biblioteca. Puedes enviar el hash de una transcripción a la blockchain de Bitcoin, inmortalizándolo. Y, lo más importante: eres libre de descargar el contenido.

Acción: [Explorar la biblioteca](/search).

#### Temas e investigación

Sigue líneas de tiempo, crea temas, nombra moderadores y relaciona contenido colaborativamente. Vota a favor del contenido que resulta más valioso. También puedes consultar transcripciones con inteligencia artificial.

Acción: [Investigar temas](/content/topics).

#### Caminos de conocimiento

Recorre contenidos en secuencia, registra tu progreso, responde quizzes y solicita certificados como NFTs. También, puedes compartir tu conocimiento creando tus propios caminos

Acción: [Ver caminos](/knowledge_path).

#### Eventos

Descubre y organiza encuentros educativos para llevar las ideas de la pantalla a la conversación en vivo. Y, cómo no, puedes pagar utilizando criptomonedas (dinero libre).

Acción: [Ver eventos](/events).

### NUESTRO PRINCIPIO

#### La tecnología debe amplificar el juicio humano, no reemplazarlo.

Las consultas con fuentes, los caminos, los quizzes y las herramientas comunitarias acompañan tu proceso. Tu criterio sigue siendo el centro.

### COMPRENDER EL MUNDO TE DARÁ PAZ MENTAL

Sigue tu curiosidad.

Acción: [Explorar la biblioteca](/search).

Claridad. Curiosidad. Independencia.

### Redes sociales

- [YouTube](https://www.youtube.com/@AcademiaBlockchain)

- [Facebook](https://www.facebook.com/AcademiaBlockchain/)

- [X](https://x.com/aca_blockchain)

- [Instagram](https://www.instagram.com/aca_blockchain/)

## 2. Cómo funciona Academia Blockchain

Fuentes: `frontend/src/generalComponents/HowItWorksGuide.jsx`, `frontend/src/locales/es/howItWorks.json`.

### 01. El archivo es tuyo

Ruta: `/como-funciona/archivo-y-preservacion`.

ACCESO, PROPIEDAD Y MEMORIA

#### Conservar el conocimiento es una forma de libertad.

Tener acceso a un contenido no significa poseerlo. Cuando dependes por completo de una plataforma, también dependes de sus decisiones, sus permisos y su permanencia. Guardar los archivos puede significar conocimiento importante para las siguientes generaciones.

Video: [YouTube](https://www.youtube.com/watch?v=dts7ZsNwFhw).

Imagen de cierre: `/images/guides/archivo-preservacion-takeaway.png`.

#### Acceder no es conservar

Llamamos “nuestras” a listas, bibliotecas y colecciones que en realidad viven detrás de servicios externos. Un enlace puede romperse, un video puede desaparecer y una cuenta puede dejar de estar disponible. Para quien investiga un tema, esa fragilidad no es un detalle: afecta la memoria que puede construir y compartir.

#### Una biblioteca que puedes llevar contigo

Academia Blockchain permite descargar los archivos disponibles y preservarlos fuera de la plataforma. El objetivo es que el conocimiento útil no quede encerrado en un intermediario.

#### Preservar de forma colaborativa

Si un contenido solo cuenta con un enlace externo (URL) y tú sí tienes el archivo, puedes sugerirlo y subirlo a Academia Blockchain. Así, la comunidad relaciona fuentes, guarda materiales y fortalece una investigación compartida.

> Una comunidad conserva mejor aquello que considera valioso cuando no depende de un solo lugar para acceder a ello. Descárgate los archivos.

### 02. Aprender sin el algoritmo

Ruta: `/como-funciona/aprender-sin-algoritmos`.

ATENCIÓN, CURIOSIDAD Y CRITERIO

#### Tu curiosidad no debería obedecer a un muro de recomendaciones.

Los algoritmos de las redes sociales optimizan el tiempo que permaneces mirando, no la profundidad de lo que aprendes. Academia Blockchain propone otra manera de descubrir conocimiento.

Video: [YouTube](https://www.youtube.com/watch?v=GWiIiydRaVc).

Imagen de cierre: `/images/guides/aprender-sin-algoritmos-takeaway.png`.

#### Tu atención tiene un propósito

Una recomendación automática decide qué aparece frente a ti y qué queda fuera. Su incentivo suele ser mantenerte dentro de la plataforma, alternando estímulos y publicidad, no ayudarte a comprender un asunto complejo.

#### La comodidad también puede limitar

Cuando delegamos constantemente el descubrimiento, dejamos de ejercitar la curiosidad. El contenido se vuelve más inmediato y superficial, mientras disminuye el espacio para detenerse, contrastar y pensar profundamente.

#### Explorar con intención

En Academia Blockchain puedes recorrer temas construidos colaborativamente y caminos de conocimiento organizados con un propósito. No se trata de seguir desplazándote, sino de elegir una pregunta y avanzar hacia una comprensión propia.

> La plataforma ofrece rutas para explorar; la dirección de tu aprendizaje sigue siendo tuya.

## 3. Comunidad — /unirme

Fuentes: `frontend/src/generalComponents/NewsletterSubscribe.jsx`, `frontend/src/locales/es/public.json`.

Únete a la comunidad

Déjanos tu email y te mantendremos al tanto del avance del proyecto, las novedades de Academia Blockchain y documentales clave. También podrás sumarte a investigaciones de código abierto, conectar con una comunidad de estudio y compartir, junto a nosotros, la construcción de esta plataforma revolucionaria.

Solo usaremos tu correo para enviarte información relevante sobre Academia Blockchain. Puedes darte de baja en cualquier momento.

Formulario: email. Acción: «Quiero suscribirme».

¡Gracias por suscribirte! Te avisaremos de las próximas novedades.

## 4. Club de lectura — /club-de-lectura

Fuentes: `frontend/src/generalComponents/ClubDeLectura.jsx`, `frontend/src/locales/es/public.json`.

El Club de Lectura ya comenzó

El ciclo «{{title}}» inició el 20 de Julio.

Todavía puedes unirte: entra al hub para sumarte a las misiones, el foro y la comunidad.

`{{title}}` se sustituye por el título del ciclo activo recibido de la API. La frase «20 de Julio» está escrita de forma fija en la traducción, sin año; no se ha verificado como fecha vigente.

El componente selecciona el ciclo activo más reciente. Permite entrar al club, unirse o ir al hub según la sesión y la membresía. El destino es `/club-de-lectura/:slug`. Si no hay un ciclo activo, muestra: «Por ahora no hay un ciclo activo publicado. Vuelve pronto.».

Texto alternativo de la imagen promocional: Club de Lectura — Seminario Cypherpunk. El secuestro de Bitcoin de Roger Ver y Steve Patterson.

## 5. Página informativa del curso — /cursos/real-historia-bitcoin

Fuentes: `frontend/src/courses/RealHistoriaBitcoinLanding.jsx`, `frontend/src/locales/es/courses.json`.

### La Real Historia de Bitcoin y la Guerra por las Criptomonedas

Se reproduce el contenido editorial local. El precio y la disponibilidad de inscripción dependen de la API y no se han consultado. Fechas y expresiones del calendario se conservan tal como están escritas, sin corregir ni validar su correspondencia con los días de la semana.

Academia Blockchain

Una investigación guiada sobre las ideas, personas y conflictos que transformaron Bitcoin.

Explorar el curso

Inscribirse

Contenido estructurado

Investigación histórica

Encuentros en vivo

#### 01 / La ruptura

La Historia de Bitcoin no es lo que te cuentan

Si preguntas a ChatGPT te va a repetir una mentira.

Debes conocer la historia oficial para luego profundizar y entender la historia real. Y, esto no comienza ni termina con Bitcoin.

Antes

Criptografía, privacidad, dinero digital, Cypherpunks, redes P2P.

El nacimiento

Una propuesta concreta frente a un problema concreto.

Después

Visionarios, conflictos y decisiones que moldearon lo que existe hoy.

#### 02 / La pregunta central

¿Cómo llegó Bitcoin a convertirse en lo que es hoy?

Bitcoin no cambió únicamente como tecnología. Su historia también está formada por conflictos de ideas y de seres humanos, intereses, desacuerdos y grupos de poder.

Ocho fuerzas tiran de Bitcoin en direcciones distintas. Ninguna, por sí sola, explica en lo que se convirtió.

#### 03 / Visiones en conflicto

Entender la Tecnología

Si no comprendes bien cómo funciona, y te parece importante, estás en el lugar correcto. He acompañado en el proceso de aprendizaje de la tecnología de Bitcoin a cientos de personas. Te lo voy a explicar de la manera más sencilla posible para que luego avancemos a un nivel más alto de comprensión, con acompañamiento 1 a 1 cuando lo necesites. Una vez que entiendas la tecnología, será más sencillo ponderar las distinats visiones que existen sobre ella.

Ver el recorrido

#### 04 / El recorrido

Lo que vas a investigar

La ruta de estudio en siete preguntas.

#### 05 / Método

Trabajarás con fuentes

No queremos decirte qué pensar sobre la historia de Bitcoin. Queremos darte suficiente contexto para que puedas examinarla inteligentemente.

El recorrido no es únicamente la interpretación de un profesor. Incluye reportajes, discusiones y artículos para que construyas tu propio criterio.

#### 06 / Experiencia en vivo

La historia se estudia a tu ritmo. La conversación ocurre en vivo.

Contenido bajo demanda más encuentros en vivo durante una ventana temporal. Puedes comenzar cuando te inscribes y avanzar a tu ritmo. Al final, opcionalmente, puedes tomar una prueba de conocimientos para obtener un certificado de finalización que se guardará en la blockchain y un NFT de recuerdo.

Profundizar acontecimientos y fuentes originales

Examinar interpretaciones en diálogo con el profesor

Preguntar y conversar con otros participantes

Repeticiones previstas para distintos ritmos de avance

Ventana:

cada encuentro se ofrece dos veces, en lunes sucesivos, del 9 de Noviembre al 15 de Diciembre de 2026.

#### 07 / Encaje

Para quién es — y para quién no

Puede ser para ti si…

Probablemente no es para ti si buscas…

#### 08 / Guía de investigación

Quién guía el recorrido

Alejandro Veintimilla

Guía de investigación → estudiante. No gurú → seguidor.

Fundador de Academia Blockchain, economista y desarrollador de aplicaciones web, experto en Bitcoin, blockchain y tokenomics. Participa en el ecosistema Bitcoin y blockchain desde 2014–2015, combinando una perspectiva económica con la comprensión técnica que le dan más de 14 años desarrollando aplicaciones web.

Desde 2015 ha enseñado y dado conferencias sobre Bitcoin, blockchain, dinero y poder en universidades, comunidades y eventos internacionales.

#### 09 / Inscripción

La inscripción no está disponible en este momento.

El camino, el acompañamiento con fuentes históricas y los tres encuentros en vivo. Quien pase el examen recibe un certificado en la blockchain y un NFT de recuerdo.

Subscribirse

ACADEMIA BLOCKCHAIN

Claridad. Curiosidad. Independencia.

Inicio

Inscripción

#### Fuerzas que influyen en Bitcoin

Ideas — Criptografía, privacidad y dinero digital.

Personas — Quienes discreparon sobre su rumbo.

Código — Reglas escritas y rechazadas.

Dinero — Si seguimos el dinero llegamos a ...!

Poder — Quién decidió qué es Bitcoin.

Comunidad — Quienes lo usaron o lo dejaron.

Incentivos — Qué empuja una ruptura.

Infraestructura — Lo que se construyó encima.

#### Visiones de Bitcoin

- Dinero electrónico P2P

- Reserva de valor

- Capa base de liquidación

#### Recorrido de investigación

Antes de Bitcoin — ¿Qué ideas hicieron posible Bitcoin? — Criptografía, dinero digital, Cypherpunks y redes P2P.

Satoshi — ¿Qué problema intentaba resolver? — El white paper, el contexto y la propuesta original. Entender cómo funciona la tecnología de Bitcoin.

Los primeros años — ¿Qué imaginaban quienes comenzaron a utilizarlo? — Primeras comunidades, usos emergentes y tensiones iniciales.

La guerra por el proyecto — ¿Qué planteó Bitcoin? — Conflictos técnicos, económicos e ideológicos sobre su dirección.

La división — ¿Cómo se vio, a detalle, el conflicto? — Eventos importantes, forks y la redefinición de narrativas.

El mercado — ¿Realmente entiendes las consecuencias de que el mercado esté manipulado? — La guerra nunca estuvo separada del mercado.

Más allá de Bitcoin — ¿La guerra por las criptomonedas continúa? — El ecosistema es mucho más amplio y el tablero es complejo. Pero la perspectiva que habrás cultivado te ayudará a entenderlo mejor.

#### Fuentes de estudio

Documentos originales — Textos fundacionales y archivos históricos.

Discusiones — Foros, listas y debates de época.

Entrevistas — Voces de quienes participaron.

Cronologías — Secuencias para conectar episodios.

#### Para quién es

- Personas que usan Bitcoin y quieren comprender su historia

- Quienes siguen criptomonedas y quieren ir más allá del precio

- Entusiastas de la tecnología interesados en comprender a profundidad

- Estudiantes de economía, dinero o sistemas monetarios

- Curiosos por Cypherpunks, privacidad y cultura de Internet

- Quienes vivieron partes de la historia y nunca reconstruyeron el panorama completo

#### Qué no ofrece

- Señales de trading

- Recomendaciones de inversión

- Predicciones de precio

- Fórmulas para hacerse rico con criptomonedas

#### Calendario publicado

¿Qué planteó Bitcoin? — Lunes 9 Noviembre 2026 — Lunes 23 Noviembre 2026

La guerra por Bitcoin — Lunes 23 Noviembre 2026 — Lunes 8 Diciembre 2026

La guerra más allá de Bitcoin — Lunes 8 Diciembre 2026 — Lunes 15 Diciembre 2026

Inscripción: `/cursos/real-historia-bitcoin/checkout`.

## 6. Home anterior — material histórico sin ruta activa

Fuentes: `frontend/src/generalComponents/Home.jsx`, `frontend/src/locales/es/misc.json (legacyHome)`.

Este componente contiene una variante para visitantes y otra para usuarios autenticados. Sus planes futuros y afirmaciones pueden diferir de la portada actual; se conservan por exhaustividad.

### Variante para visitantes

El Conocimiento es Poder

Aprende desde la autonomía. Explora temas creados por la comunidad y construye tu propia red de aprendizaje.

¿Qué es Academia Blockchain?

Academia Blockchain es más que una plataforma: es un territorio intelectual donde el conocimiento es un bien común, no un recurso secuestrado por instituciones, algoritmos o intereses económicos. No somos una academia de trading ni una criptomoneda. Somos un espacio donde la comunidad enlaza saberes, los reorganiza y los libera, como lo hacía el espíritu original de internet.

Surgimos frente a una realidad incómoda: la arquitectura del conocimiento moderno está a la merced de la censura, la manipulación y la concentración del poder. El buscador y la IA que deberían abrir puertas en realidad deciden qué mostrar; la universidad, que debería iluminar, se ha convertido en un club elitista; las revistas científicas, que deberían custodiar la verdad, a menudo se someten a intereses políticos o económicos. En ese ruido, lo esencial se pierde: la capacidad de aprender sin intermediarios, de explorar sin permiso, de saber sin filtros.

En Academia Blockchain, las ideas se conectan entre sí de forma colaborativa mediante caminos del conocimiento creados por la comunidad y temas. Los contenidos podrán relacionarse, descargarse, organizarse y preservarse gracias al uso de tecnologías como IPFS y blockchain, que iremos implementando gradualmente a medida que avance el desarrollo. Éstas garantizarán permanencia, resistencia a la censura y un ecosistema educativo abierto.

Para quién es

Estudiantes

Buscas libertad en tu aprendizaje, sin estructuras rígidas.

Investigadores

Buscas expandir tu conocimiento y valoras el aprendizaje autónomo.

Educadores

Deseas compartir conocimiento y aportar en una comunidad de investigación.

Comunidad

La conversación abierta y los archivos descentralizados nos protegen de la censura.

Descubre temas creados por la comunidad

Explora contenido organizado por temas de interés, donde cada tema es moderado y enriquecido por la comunidad.

Explora rutas de aprendizaje estructuradas

Los caminos del conocimiento te guían paso a paso a través de una secuencia de contenido diseñada para construir comprensión progresiva.

Acciones: «Comenzar» y «Entrar» → `/profiles/register`; «¿Ya tienes cuenta? Inicia sesión» → `/profiles/login`.

### Variante para usuarios autenticados

Este proyecto está en construcción y se nutre de la comunidad. Aquí encontrarás información sobre el estado del proyecto y cómo participar.

Un proyecto en construcción y colaborativo

Academia Blockchain avanza gracias a la participación de la comunidad. Las funcionalidades que ves hoy se irán ampliando con el tiempo; tu uso, feedback y aportes son parte de ese proceso.

Si eres programador o programadora, puedes contribuir directamente al código: el proyecto es de código abierto. En el [repositorio de GitHub](https://github.com/Alejoss/Sophia.AI) encontrarás el roadmap, issues y la documentación para sumarte al desarrollo.

Roadmap en Ideas

Pagos

Habilitaremos pagos con criptomonedas para cursos, eventos y caminos del conocimiento. Esto habilitará un acto de profunda resistencia: generar intercambios fuera de la economía fiat. Sin embargo, esta funcionalidad depende de ciertos aspectos regulatorios, y en mi país está prohibido usar criptos como medio de pago. Estamos considerando una empresa en El Salvador o en Paraguay, si eres un conocedor del tema por favor contáctanos.

Blockchain

Aunque no hemos implementado blockchain para pagos por razones regulatorias, la cadena de bloques es una tecnología que trasciende el uso monetario: El siguiente paso es utilizarla para guardar NFTs, contenido y certificados de educación. Esto será muy valioso en un mundo en el que las noticias falsas amenazan con re escribir el pasado. Un hash en un bloque de Bitcoin nos asegura que "tal documento" existió en ese momento del tiempo.

Archivos

¿Has notado que las plataformas web más importantes hacen todo lo posible por evitar que tengas acceso al archivo? En Academia Blockchain, siempre que sea posible, los contenidos educativos, documentos y recursos podrán descargarse y guardarse de forma descentralizada. Integraremos tecnologías como IPFS y otras soluciones como FileCoin. Colaborativamente podremos asegurarnos de que un archivo no se borre nunca.

Conexiones

La plataforma conecta temas, caminos del conocimiento y personas. ¿Has visto que cuando scrolleas en una red social, todo el contenido es igual en jerarquía? Es decir, todo importa lo mismo: No hay un camino. El scroll mantiene la superficialidad de una máquina tragamonedas. Por otro lado, el "buscador" hace lo posible por darte una respuesta autoritaria y ocultarte lo demás. En contraste, la investigación en Academia Blockchain es de código abierto.

Academia Blockchain no es un negocio

Los servidores cuestan y los programadores comemos. Es decir, Academia Blockchain debe cubrir sus gastos. Sin embargo, sabemos que aceptar ciertos inversionistas que buscan un retorno económico claro nos limitaría a crear un "modelo de negocio" lo más rentable posible. Este no es el mejor lente si queremos ver descentralización. Por ello, hay distintas maneras de [apoyar al proyecto.](https://github.com/Alejoss/Sophia.AI)

Acción: «Ir a mi perfil» → `/profiles/my_profile`. Ambas variantes enlazan a las mismas redes sociales que la portada actual.

## 7. About — material histórico sin ruta activa

Fuentes: `frontend/src/profiles/About.jsx`.

El componente está en inglés. A continuación se conserva su texto original completo; describe integraciones y capacidades que no se han verificado como operativas.

### Academia Blockchain: Decentralizing Education for the Future

#### Efficient Searching

Integrates with Kandra to enable efficient searching through users' libraries.

#### Cryptocurrency Payments

Utilizes Unstoppable Domains to facilitate cryptocurrency payments for teachers.

#### Blockchain Certificates

Archives education certificates on the blockchain for secure and verifiable storage.

#### Document Hashing

Allows users to hash documents and record the hash on the blockchain, ensuring data integrity.

#### IPFS Document Storage

Enables users to upload documents to the InterPlanetary File System (IPFS) and store the corresponding Content Identifier (CID) on the blockchain.

#### ACBC Tokens

Distributes ACBC tokens as rewards to users, incentivizing participation and engagement.

#### Gamification System

Earn badges and points by learning, contributing, and engaging with the community. Badges recognize meaningful achievements and contributions.

### Traducción de referencia al español

Academia Blockchain: descentralizando la educación para el futuro.

Búsqueda eficiente: integración con Kandra para buscar de manera eficiente en las bibliotecas de los usuarios.

Pagos con criptomonedas: utiliza Unstoppable Domains para facilitar pagos en criptomonedas a los profesores.

Certificados en blockchain: archiva certificados educativos en blockchain para almacenarlos de forma segura y verificable.

Hash de documentos: permite calcular el hash de documentos y registrarlo en blockchain para garantizar la integridad de los datos.

Almacenamiento de documentos en IPFS: permite subir documentos a InterPlanetary File System y almacenar su identificador de contenido (CID) en blockchain.

Tokens ACBC: distribuye tokens como recompensa para incentivar la participación y el compromiso.

Gamificación: permite ganar insignias y puntos al aprender, contribuir y participar en la comunidad. Las insignias reconocen logros y contribuciones significativos.

## 8. Diferencias entre los textos conservados

- La Home actual anuncia pagos con criptomonedas, hashes de transcripciones en Bitcoin y certificados como NFTs; la Home anterior los describe como planes futuros.
- La Home actual marca IPFS como «próximamente». La Home anterior propone IPFS y FileCoin; About describe IPFS como capacidad disponible.
- Kandra y Unstoppable Domains aparecen en About, pero no en el texto de la portada actual.
- Estas diferencias se registran como diferencias editoriales entre componentes; no se ha determinado el estado técnico real desde el backend.
