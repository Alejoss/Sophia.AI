# Pruebas del Sistema de Badges

Este documento describe las pruebas creadas para el sistema de gamificación de badges.

## Estructura de Pruebas

Las pruebas están organizadas en las siguientes clases de prueba:

### 1. Pruebas de Modelos
- **BadgeModelTests**: Pruebas para el modelo `Badge`
  - Creación de badges
  - Validación de código único
  - Badges inactivos
  - Representación de cadena

- **UserBadgeModelTests**: Pruebas para el modelo `UserBadge`
  - Creación de UserBadge
  - Restricción única usuario-badge
  - Representación de cadena

### 2. Pruebas de Reglas
- **BadgeRulesTests**: Pruebas para el motor de reglas (`rules.py`)
  - `award_badge()`: Otorgar badges
  - `has_badge()`: Verificar si usuario tiene badge
  - `check_first_comment()`: Badge por primer comentario
  - `check_knowledge_seeker()`: Badge por completar 20 nodos
  - `check_first_knowledge_path_completed()`: Badge por completar primer KnowledgePath
  - `check_first_highly_rated_comment()`: Badge por comentario con 5+ votos
  - `check_first_highly_rated_content()`: Badge por contenido con 10+ votos
  - `check_first_knowledge_path_created()`: Badge por crear KnowledgePath con 2+ nodos
  - `check_quiz_master()`: Badge por 5 quizzes perfectos
  - `check_community_voice()`: Badge por 20+ votos acumulados en comentarios
  - `check_content_creator()`: Badge por 3 contenidos con 5+ votos cada uno

### 3. Pruebas de Signals/Triggers
- **BadgeSignalsTests**: Pruebas para los triggers automáticos (`signals.py`)
  - Trigger al crear comentario → Badge "First Voice"
  - Trigger al completar nodos → Badge "Knowledge Seeker"
  - Trigger al actualizar votos de comentario → Badge "Valued Contributor"
  - Trigger al actualizar votos de contenido → Badge "Content Curator"
  - Trigger al completar quiz perfecto → Badge "Quiz Master"
  - Trigger al crear nodos en KnowledgePath → Badge "Path Creator"
  - Verificación de que signals NO se ejecutan cuando no deberían (updates, scores imperfectos, etc.)

### 4. Pruebas de API
- **BadgeAPITests**: Pruebas para los endpoints de la API
  - `GET /api/gamification/badges/`: Listar badges
  - `GET /api/gamification/badges/{id}/`: Obtener badge específico
  - `GET /api/gamification/user-badges/my_badges/`: Obtener badges del usuario
  - `POST /api/gamification/badges/{id}/grant/`: Otorgar badge (admin only)
  - `GET /api/gamification/user-points/my_points/`: Obtener puntos del usuario
  - Autenticación requerida
  - Permisos de administrador

### 5. Pruebas de Serializers
- **BadgeSerializerTests**: Pruebas para los serializers
  - `BadgeSerializer`: Serialización de badges
  - `UserBadgeSummarySerializer`: Serialización de UserBadge con datos resumidos

## Ejecutar las Pruebas

### Ejecutar todas las pruebas de badges:
```bash
python manage.py test gamification.tests
```

### Ejecutar una clase de pruebas específica:
```bash
# Solo pruebas de modelos
python manage.py test gamification.tests.BadgeModelTests
python manage.py test gamification.tests.UserBadgeModelTests

# Solo pruebas de reglas
python manage.py test gamification.tests.BadgeRulesTests

# Solo pruebas de signals
python manage.py test gamification.tests.BadgeSignalsTests

# Solo pruebas de API
python manage.py test gamification.tests.BadgeAPITests

# Solo pruebas de serializers
python manage.py test gamification.tests.BadgeSerializerTests
```

### Ejecutar una prueba específica:
```bash
python manage.py test gamification.tests.BadgeRulesTests.test_check_first_comment
```

### Con verbosidad:
```bash
python manage.py test gamification.tests --verbosity=2
```

### Con cobertura de código (requiere coverage.py):
```bash
coverage run --source='gamification' manage.py test gamification.tests
coverage report
coverage html
```

## Casos de Prueba Cubiertos

### ✅ Funcionalidad Básica
- Creación y validación de badges
- Otorgamiento de badges a usuarios
- Actualización de puntos en perfil
- Prevención de badges duplicados

### ✅ Reglas de Badges
- **First Voice**: Primer comentario
- **Knowledge Seeker**: 20 nodos completados
- **First Explorer**: Primer KnowledgePath completado
- **Valued Contributor**: Comentario con 5+ votos
- **Content Curator**: Contenido con 10+ votos
- **Path Creator**: KnowledgePath con 2+ nodos creado
- **Quiz Master**: 5 quizzes con puntuación perfecta
- **Community Voice**: 20+ votos acumulados en comentarios
- **Creator**: 3 contenidos con 5+ votos cada uno

### ✅ Triggers Automáticos
- Signals se ejecutan correctamente en eventos apropiados
- Signals NO se ejecutan en eventos incorrectos (updates, condiciones no cumplidas)
- Verificación de condiciones antes de otorgar badges

### ✅ Casos Edge
- Badges no otorgados cuando condiciones no se cumplen
- Badges no otorgados si usuario ya los tiene
- Badges inactivos no se otorgan
- Códigos de badge inválidos
- Usuarios sin perfil
- Contenidos sin autor

### ✅ API y Serialización
- Endpoints públicos y privados
- Autenticación requerida
- Permisos de administrador
- Serialización correcta de datos

## Notas Importantes

1. **TransactionTestCase**: Las pruebas de signals usan `TransactionTestCase` en lugar de `TestCase` para asegurar que los signals se ejecuten correctamente.

2. **Datos de Prueba**: Cada prueba crea sus propios datos de prueba en `setUp()` para garantizar aislamiento.

3. **Badges Requeridos**: Las pruebas crean los badges necesarios antes de ejecutar las reglas, ya que las reglas buscan badges por código.

4. **Profile**: Todas las pruebas crean un `Profile` para el usuario, ya que los badges actualizan `total_points` en el perfil.

## Mejoras Futuras

- [ ] Pruebas de rendimiento para reglas complejas
- [ ] Pruebas de concurrencia (múltiples usuarios obteniendo badges simultáneamente)
- [ ] Pruebas de integración end-to-end completas
- [ ] Pruebas de notificaciones cuando se otorgan badges
- [ ] Pruebas de migración de datos de badges
