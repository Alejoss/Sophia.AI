# Sistema de Gamificación - Academia Blockchain

## Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Sistema de Badges](#sistema-de-badges)
4. [Sistema de Puntos](#sistema-de-puntos)
5. [Categorías de Badges](#categorías-de-badges)
6. [Lista Completa de Badges](#lista-completa-de-badges)
7. [Cómo se Otorgan los Badges](#cómo-se-otorgan-los-badges)
8. [Badge Destacado](#badge-destacado)
9. [API REST](#api-rest)
10. [Componentes Frontend](#componentes-frontend)
11. [Comandos de Gestión](#comandos-de-gestión)
12. [Implementación Técnica](#implementación-técnica)

---

## Visión General

El sistema de gamificación de Academia Blockchain está diseñado para motivar y reconocer la participación de los usuarios mediante un sistema de badges (insignias) y puntos. El sistema sigue el ciclo **"Learn-Contribute-Recognize-Return"** (Aprender-Contribuir-Reconocer-Retornar), incentivando a los usuarios a:

- **Aprender**: Completar KnowledgePaths y quizzes
- **Contribuir**: Crear contenido, comentarios y KnowledgePaths
- **Reconocer**: Recibir votos positivos de la comunidad
- **Retornar**: Continuar participando y contribuyendo

### Características Principales

- ✅ Sistema automático de otorgamiento de badges mediante signals de Django
- ✅ Sistema de puntos asociado a cada badge
- ✅ Badge destacado personalizable por usuario
- ✅ Visualización de badges en comentarios y perfiles
- ✅ API REST completa para integración frontend
- ✅ Logging completo de eventos de gamificación

---

## Arquitectura del Sistema

### Backend (Django)

```
acbc_app/gamification/
├── models.py          # Modelos Badge y UserBadge
├── rules.py           # Motor de reglas para otorgar badges
├── signals.py         # Signals de Django para eventos automáticos
├── serializers.py     # Serializers para API REST
├── views.py           # ViewSets para endpoints API
├── urls.py            # Rutas de la API
├── admin.py           # Configuración del admin de Django
└── management/
    └── commands/
        ├── create_initial_badges.py      # Crear badges iniciales
        ├── grant_founder_badges.py       # Otorgar badges de fundador
        ├── remove_founder_badges.py      # Eliminar badges founder_member
        └── populate_test_badges.py       # Poblar badges de prueba
```

### Frontend (React)

```
frontend/src/gamification/
├── BadgeDisplay.jsx           # Componente para mostrar un badge
├── BadgeList.jsx              # Componente para lista de badges
├── FeaturedBadgeSelector.jsx   # Selector de badge destacado
├── BadgeNotification.jsx       # Notificaciones de badges (placeholder)
├── useBadges.js               # Hook personalizado para badges
├── badgeConstants.js          # Constantes (colores, tamaños, umbrales)
└── badgeIconMap.js            # Mapeo de iconos por código de badge
```

---

## Sistema de Badges

### Modelo de Datos

#### Badge
Representa un badge disponible en el sistema.

**Campos:**
- `code` (CharField): Código único identificador (ej: `first_comment`)
- `name` (CharField): Nombre para mostrar (ej: "Ingreso al Diálogo")
- `description` (TextField): Descripción del badge
- `icon` (ImageField, opcional): Imagen personalizada del badge
- `category` (CharField): Categoría del badge (LEARNING, CONTRIBUTION, RECOGNITION, FOUNDER)
- `points_value` (IntegerField): Puntos otorgados al ganar el badge
- `is_active` (BooleanField): Si el badge está activo
- `created_at` (DateTimeField): Fecha de creación

#### UserBadge
Representa un badge otorgado a un usuario.

**Campos:**
- `user` (ForeignKey): Usuario que ganó el badge
- `badge` (ForeignKey): Badge otorgado
- `earned_at` (DateTimeField): Fecha en que se ganó
- `points_earned` (IntegerField): Puntos otorgados (almacenados para historial)
- `context_data` (JSONField): Datos adicionales del contexto (ej: qué KnowledgePath completó)

**Restricciones:**
- Un usuario solo puede tener un badge una vez (unique_together: user, badge)

---

## Sistema de Puntos

### Funcionamiento

- Cada badge tiene un valor de puntos (`points_value`)
- Cuando un usuario gana un badge, los puntos se suman a su `Profile.total_points`
- Los puntos se almacenan en `Profile.total_points` para acceso rápido
- Los puntos también se guardan en `UserBadge.points_earned` para historial

### Valores de Puntos por Badge

| Badge | Puntos |
|-------|--------|
| Iniciación al Conocimiento | 50 |
| Ingreso al Diálogo | 10 |
| Aporte Relevante | 30 |
| Contenido Valioso | 40 |
| Arquitecto de Conocimiento | 60 |
| Dominio Conceptual | 25 |
| Comprensión Progresiva | 35 |
| Voz Confiable | 45 |
| Autor Validado | 50 |
| Curador de Conexiones | 45 |
| Arquitecto de Temas | 65 |

---

## Categorías de Badges

El sistema utiliza 4 categorías principales:

### 1. LEARNING (Aprendizaje)
Badges otorgados por actividades de aprendizaje:
- Completar KnowledgePaths
- Completar nodos
- Completar quizzes con puntaje perfecto

**Color:** `#4CAF50` (Verde)

### 2. CONTRIBUTION (Contribución)
Badges otorgados por crear contenido:
- Crear comentarios
- Crear KnowledgePaths
- Crear contenido

**Color:** `#2196F3` (Azul)

### 3. RECOGNITION (Reconocimiento)
Badges otorgados por recibir reconocimiento de la comunidad:
- Comentarios con muchos votos
- Contenido con muchos votos
- Votos acumulados

**Color:** `#FF9800` (Naranja)

### 4. FOUNDER (Fundador)
Categoría reservada para futuros badges especiales. Actualmente no hay badges activos en esta categoría.

**Color:** `#9C27B0` (Morado)

---

## Lista Completa de Badges

### LEARNING Badges

#### Iniciación al Conocimiento
- **Código:** `first_knowledge_path_completed`
- **Puntos:** 50
- **Descripción:** Marca el inicio formal del viaje de aprendizaje del usuario
- **Requisito:** Completar un KnowledgePath por primera vez
- **Trigger:** Cuando se marca un nodo como completado y el KnowledgePath queda completo
- **Intención Semántica:** Marca el inicio formal del viaje de aprendizaje del usuario

#### Dominio Conceptual
- **Código:** `quiz_master`
- **Puntos:** 25
- **Descripción:** Representa comprensión precisa y completa de conceptos
- **Requisito:** Completar 5 quizzes con score = 100
- **Trigger:** Cuando se crea un `UserQuizAttempt` con score = 100
- **Intención Semántica:** Representa comprensión precisa y completa de conceptos

#### Comprensión Progresiva
- **Código:** `knowledge_seeker`
- **Puntos:** 35
- **Descripción:** Recompensa la consistencia y el aprendizaje sostenido en el tiempo
- **Requisito:** Completar 20 nodos acumulados
- **Trigger:** Cuando se marca un nodo como completado (`UserNodeCompletion.is_completed = True`)
- **Intención Semántica:** Recompensa la consistencia y el aprendizaje sostenido en el tiempo

### CONTRIBUTION Badges

#### Ingreso al Diálogo
- **Código:** `first_comment`
- **Puntos:** 10
- **Descripción:** Marca la entrada del usuario al intercambio intelectual
- **Requisito:** Crear el primer comentario
- **Trigger:** Cuando se crea un `Comment` nuevo
- **Intención Semántica:** Marca la entrada del usuario al intercambio intelectual

#### Arquitecto de Conocimiento
- **Código:** `first_knowledge_path_created`
- **Puntos:** 60
- **Descripción:** Reconoce la capacidad de estructurar y organizar conocimiento para otros
- **Requisito:** Crear un KnowledgePath con 2+ nodos por primera vez
- **Trigger:** Cuando se agrega un `Node` a un KnowledgePath y este tiene 2+ nodos
- **Intención Semántica:** Reconoce la capacidad de estructurar y organizar conocimiento para otros

#### Autor Validado
- **Código:** `content_creator`
- **Puntos:** 50
- **Descripción:** Señala creación consistente con validación de la comunidad
- **Requisito:** Crear 3 contenidos que alcancen 5+ votos cada uno
- **Trigger:** Cuando se actualiza `VoteCount` para un `Content`
- **Intención Semántica:** Señala creación consistente con validación de la comunidad

#### Curador de Conexiones
- **Código:** `topic_curator`
- **Puntos:** 45
- **Descripción:** Reconoce la creación de un tema que organiza y atrae contenido relevante con validación inicial de la comunidad
- **Requisito:** Crear un tema con 5+ contenidos donde al menos 2 tienen votos positivos específicos del tema
- **Trigger:** Cuando se actualiza `VoteCount` para contenido dentro de un tema (`VoteCount.topic` no es None)
- **Intención Semántica:** Reconoce la creación de un tema que organiza y atrae contenido relevante con validación inicial de la comunidad

### RECOGNITION Badges

#### Aporte Relevante
- **Código:** `first_highly_rated_comment`
- **Puntos:** 30
- **Descripción:** Recompensa claridad, rigor y utilidad en el discurso
- **Requisito:** Un comentario alcanza 5+ votos por primera vez
- **Trigger:** Cuando `VoteCount` de un `Comment` alcanza 5+
- **Intención Semántica:** Recompensa claridad, rigor y utilidad en el discurso

#### Contenido Valioso
- **Código:** `first_highly_rated_content`
- **Puntos:** 40
- **Descripción:** Reconoce contenido que se vuelve significativo para la comunidad
- **Requisito:** Un contenido alcanza 10+ votos por primera vez
- **Trigger:** Cuando `VoteCount` de un `Content` alcanza 10+
- **Intención Semántica:** Reconoce contenido que se vuelve significativo para la comunidad

#### Voz Confiable
- **Código:** `community_voice`
- **Puntos:** 45
- **Descripción:** Representa confianza sostenida ganada a través de contribuciones de alta calidad repetidas
- **Requisito:** Acumular 20+ votos en total en todos los comentarios
- **Trigger:** Cuando se actualiza `VoteCount` para un `Comment`
- **Intención Semántica:** Representa confianza sostenida ganada a través de contribuciones de alta calidad repetidas

#### Arquitecto de Temas
- **Código:** `topic_architect`
- **Puntos:** 65
- **Descripción:** Reconoce la creación de un tema que alcanza amplio reconocimiento comunitario, demostrando capacidad para estructurar conocimiento de manera significativa
- **Requisito:** Crear un tema que cumpla todos los siguientes:
  - 10+ contenidos con votos positivos específicos del tema
  - 50+ votos totales acumulados
  - Al menos 5 usuarios únicos han votado contenido del tema
- **Trigger:** Cuando se actualiza `VoteCount` para contenido dentro de un tema (`VoteCount.topic` no es None)
- **Intención Semántica:** Reconoce la creación de un tema que alcanza amplio reconocimiento comunitario, demostrando capacidad para estructurar conocimiento de manera significativa

---

## Cómo se Otorgan los Badges

### Proceso Automático

El sistema utiliza **Django Signals** para otorgar badges automáticamente cuando ocurren eventos relevantes:

1. **Evento ocurre** (ej: se crea un comentario)
2. **Signal se dispara** (`post_save` en el modelo)
3. **Función de verificación** (`check_*` en `rules.py`) evalúa si el usuario es elegible
4. **Otorgamiento** (`award_badge`) crea el `UserBadge` y actualiza puntos
5. **Logging** se registra el evento

### Signals Implementados

| Signal | Modelo | Badges Verificados |
|--------|--------|-------------------|
| `post_save` | `profiles.UserNodeCompletion` | Comprensión Progresiva, Iniciación al Conocimiento |
| `post_save` | `comments.Comment` | Ingreso al Diálogo |
| `post_save` | `votes.VoteCount` | Aporte Relevante, Contenido Valioso, Voz Confiable, Autor Validado, Curador de Conexiones, Arquitecto de Temas |
| `post_save` | `knowledge_paths.Node` | Arquitecto de Conocimiento |
| `post_save` | `quizzes.UserQuizAttempt` | Dominio Conceptual |

### Principios de Otorgamiento

1. **Una sola vez**: Los badges se otorgan solo la primera vez que se cumple la condición
2. **Atómico**: Las operaciones de otorgamiento son transaccionales (`@transaction.atomic`)
3. **Idempotente**: Verificar múltiples veces no causa duplicados
4. **Logging**: Todos los eventos se registran para auditoría

### Verificación de Elegibilidad

Cada función `check_*` en `rules.py`:

1. Verifica si el usuario ya tiene el badge (`has_badge`)
2. Si no lo tiene, verifica si cumple los requisitos
3. Si cumple, llama a `award_badge`
4. Maneja errores y los registra

---

## Badge Destacado

### Funcionalidad

Los usuarios pueden seleccionar un badge destacado que se muestra junto a su nombre de usuario en:
- Comentarios
- Página de perfil
- (Nota: Removido del header por diseño)

### Implementación

- **Backend:** Campo `Profile.featured_badge` (ForeignKey a `UserBadge`)
- **Frontend:** Componente `FeaturedBadgeSelector` en la página de perfil
- **API:** Actualización mediante `PUT /api/profiles/my_profile/` con `featured_badge_id`

### Restricciones

- Solo se puede seleccionar un badge que el usuario haya ganado
- Se puede limpiar el badge destacado (enviar `featured_badge_id: null`)

---

## API REST

### Base URL
```
/api/gamification/
```

### Endpoints

#### Badges

##### Listar todos los badges activos
```
GET /api/gamification/badges/
```
**Permisos:** Público

**Respuesta:**
```json
{
  "count": 11,
  "results": [
    {
      "id": 1,
      "code": "first_comment",
      "name": "Ingreso al Diálogo",
      "description": "Marca la entrada del usuario al intercambio intelectual",
      "category": "CONTRIBUTION",
      "points_value": 10,
      "icon": null,
      "is_active": true
    }
  ]
}
```

##### Obtener un badge específico
```
GET /api/gamification/badges/{id}/
```
**Permisos:** Público

##### Otorgar badge manualmente (Admin)
```
POST /api/gamification/badges/{id}/grant/
Body: {"user_id": 123}
```
**Permisos:** Solo administradores

#### User Badges

##### Obtener mis badges
```
GET /api/gamification/user-badges/my_badges/
```
**Permisos:** Autenticado

**Respuesta:**
```json
{
  "badges": [
    {
      "id": 1,
      "badge_code": "first_comment",
      "badge_name": "Ingreso al Diálogo",
      "badge_description": "Marca la entrada del usuario al intercambio intelectual",
      "badge_category": "CONTRIBUTION",
      "earned_at": "2024-01-15T10:30:00Z",
      "points_earned": 10
    }
  ],
  "total_points": 150,
  "badge_count": 5
}
```

##### Obtener badges de un usuario específico
```
GET /api/gamification/user-badges/?user_id=123
```
**Permisos:** Autenticado

#### Points

##### Obtener mis puntos
```
GET /api/gamification/points/my_points/
```
**Permisos:** Autenticado

**Respuesta:**
```json
{
  "total_points": 150,
  "user_id": 123,
  "username": "usuario_ejemplo"
}
```

---

## Componentes Frontend

### BadgeDisplay

Componente reutilizable para mostrar un badge individual.

**Props:**
- `badge` (Object): Objeto badge con información
- `showName` (Boolean): Si mostrar el nombre del badge (default: true)
- `size` (String): Tamaño explícito ('extraTiny', 'tiny', 'small', 'medium', 'large')
- `context` (String): Contexto para tamaño automático ('comment', 'header', 'profile', 'badgeList', 'notification')

**Características:**
- Muestra imagen del badge o imagen por defecto (`badge_sky_blue.png`)
- Tooltip con nombre y descripción (configurable por contexto)
- Tamaños adaptativos según contexto
- Manejo de errores de carga de imagen

**Tamaños por Contexto:**
- `comment`: extraTiny (18px)
- `header`: tiny (32px) - Removido del header
- `profile`: tiny (32px)
- `badgeList`: small (48px)
- `notification`: small (48px)
- `default`: medium (64px)

### BadgeList

Componente para mostrar una lista de badges.

**Props:**
- `badges` (Array): Array de badges
- `title` (String): Título opcional
- `emptyMessage` (String): Mensaje cuando no hay badges
- `loading` (Boolean): Estado de carga
- `error` (String): Mensaje de error

### FeaturedBadgeSelector

Componente para seleccionar el badge destacado.

**Props:**
- `badges` (Array): Array de badges del usuario
- `currentFeaturedBadgeId` (Number): ID del badge destacado actual
- `onUpdate` (Function): Callback cuando se actualiza

**Características:**
- Muestra todos los badges ganados
- Opción "Ninguno" para limpiar
- Guarda automáticamente al seleccionar
- Muestra estado de guardado

### useBadges Hook

Hook personalizado para obtener badges de un usuario.

**Uso:**
```javascript
const { badges, totalPoints, badgeCount, loading, error, refetch } = useBadges(userId);
```

**Parámetros:**
- `userId` (Number, opcional): ID del usuario. Si es `null`, obtiene los badges del usuario autenticado.

**Retorna:**
- `badges`: Array de badges
- `totalPoints`: Puntos totales
- `badgeCount`: Cantidad de badges
- `loading`: Estado de carga
- `error`: Mensaje de error
- `refetch`: Función para recargar datos

---

## Comandos de Gestión

### create_initial_badges

Crea o actualiza los badges iniciales del sistema.

```bash
python manage.py create_initial_badges
```

**Uso:** Ejecutar después de migraciones o para actualizar badges existentes.

### remove_founder_badges

Elimina todos los badges `founder_member` de los usuarios y ajusta sus puntos.

```bash
# Modo dry-run (solo muestra lo que haría sin hacer cambios)
python manage.py remove_founder_badges --dry-run

# Ejecutar la eliminación
python manage.py remove_founder_badges
```

**Funcionalidad:**
- Encuentra todos los `UserBadge` con badge `founder_member`
- Resta 100 puntos del `total_points` de cada usuario afectado
- Elimina los registros `UserBadge`
- Limpia `featured_badge` si estaba configurado como `founder_member`
- Marca el badge `founder_member` como inactivo

**Parámetros:**
- `--dry-run`: Muestra lo que haría sin realizar cambios

**Nota:** Este comando debe ejecutarse una vez después de la actualización a Phase 1 para limpiar badges existentes.

### populate_test_badges

Pobla badges de prueba para desarrollo/testing.

```bash
# Otorgar badges a un usuario específico
python manage.py populate_test_badges --user admin

# Otorgar badges a todos los usuarios
python manage.py populate_test_badges --all-users

# Limpiar badges existentes antes de poblar
python manage.py populate_test_badges --clear
```

**Uso:** Para pruebas del frontend y desarrollo.

---

## Implementación Técnica

### Base de Datos

#### Migraciones

El sistema requiere migraciones para:
- Crear modelos `Badge` y `UserBadge`
- Agregar campos `total_points` y `featured_badge` a `Profile`

**Ejecutar migraciones:**
```bash
docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate
```

### Signals

Los signals se registran automáticamente cuando la app `gamification` está en `INSTALLED_APPS` y se llama `apps.py.ready()`.

**Archivo:** `gamification/apps.py`
```python
def ready(self):
    import gamification.signals
```

### Logging

Todos los eventos de gamificación se registran usando `utils.logging_utils`:

- **Badge otorgado:** `badge_awarded`
- **Errores:** Logged con contexto completo
- **Debug:** Información detallada para desarrollo

### Optimizaciones

1. **Queries optimizadas:** Uso de `select_related` y `prefetch_related`
2. **Agregaciones:** Uso de `aggregate()` en lugar de iteraciones
3. **Early exit:** Verificaciones tempranas para evitar procesamiento innecesario
4. **Transacciones atómicas:** Operaciones críticas en transacciones

### Seguridad

- **Permisos:** Endpoints protegidos con `IsAuthenticated` o `IsAdminUser`
- **Validación:** Verificación de propiedad de badges antes de otorgar
- **Sanitización:** Datos validados antes de guardar

### Extensibilidad

Para agregar nuevos badges:

1. Agregar badge en `create_initial_badges.py`
2. Crear función `check_*` en `rules.py`
3. Conectar signal en `signals.py` si es necesario
4. Ejecutar `create_initial_badges` para crear el badge

---

## Notas Adicionales

### Imágenes de Badges

- **Por defecto:** Todos los badges usan `/images/badge_sky_blue.png` si no tienen icono personalizado
- **Futuro:** Se pueden agregar iconos específicos por badge en el campo `icon` del modelo `Badge`

### Visualización en Comentarios

Los badges destacados se muestran automáticamente en los comentarios mediante el serializer `CommentSerializer.get_featured_badge()`.

### Performance

- Los badges se cargan eficientemente con queries optimizadas
- El sistema está diseñado para escalar con índices en campos clave
- Los puntos se calculan una vez y se almacenan para acceso rápido

---

## Changelog

### Versión 1.2.1 (Revisión documentación / código)
- ✅ Documentación comparada con el código: alineada
- ✅ Backend: `UserBadgeViewSet.get_queryset()` ahora acepta `user_id` por query param (`?user_id=123`) además de kwargs
- ✅ Doc: añadido `remove_founder_badges.py` al árbol de comandos, `badgeIconMap.js` al frontend, contexto `notification`, count de badges 11 en ejemplo API

### Versión 1.2 (Fase 1.5 - Badges de Temas)
- ✅ Badge "Curador de Conexiones" agregado (CONTRIBUTION, 45 puntos)
- ✅ Badge "Arquitecto de Temas" agregado (RECOGNITION, 65 puntos)
- ✅ Signals implementados para verificación automática de badges de temas
- ✅ Documentación actualizada con nuevos badges

### Versión 1.1 (Fase 1 - Actualización)
- ✅ Badges renombrados a español con nombres más significativos
- ✅ Descripciones actualizadas para reflejar intención semántica
- ✅ Badge `founder_member` removido del sistema
- ✅ Comando `remove_founder_badges` creado para migración
- ✅ Documentación actualizada

**Badges actualizados:**
- `first_knowledge_path_completed`: "First Explorer" → "Iniciación al Conocimiento"
- `quiz_master`: "Quiz Master" → "Dominio Conceptual"
- `knowledge_seeker`: "Knowledge Seeker" → "Comprensión Progresiva"
- `first_comment`: "First Voice" → "Ingreso al Diálogo"
- `first_knowledge_path_created`: "Path Creator" → "Arquitecto de Conocimiento"
- `content_creator`: "Creator" → "Autor Validado"
- `first_highly_rated_comment`: "Valued Contributor" → "Aporte Relevante"
- `first_highly_rated_content`: "Content Curator" → "Contenido Valioso"
- `community_voice`: "Community Voice" → "Voz Confiable"

### Versión 1.0 (Fase 1)
- ✅ Sistema básico de badges implementado
- ✅ 9 badges iniciales creados (10 originalmente, founder_member removido)
- ✅ Sistema de puntos integrado
- ✅ Badge destacado funcional
- ✅ API REST completa
- ✅ Componentes frontend reutilizables
- ✅ Signals automáticos para otorgamiento
- ✅ Visualización en comentarios y perfiles

**Total de badges actuales:** 11 badges (9 originales + 2 de temas)

---

## Contacto y Soporte

Para preguntas o problemas relacionados con el sistema de gamificación, contactar al equipo de desarrollo.
