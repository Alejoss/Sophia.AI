# Auditoría: Manejo de URLs y Media

## Resumen

El backend devuelve **URLs absolutas** para todos los archivos de media (S3 o local). El frontend usa `resolveMediaUrl()` que:
- Si la URL ya es absoluta (`http://` o `https://`) → la devuelve tal cual.
- Si es relativa → la concatena con `MEDIA_BASE_URL`.

---

## Backend (acbc_app)

### Función central: `content/utils.py` → `build_media_url(file_field_or_key, request)`
- S3: `https://{AWS_S3_CUSTOM_DOMAIN}/{key}`
- Local: `request.build_absolute_uri(key)`
- Si key empieza con `http://`/`https://` → devuelve tal cual.

### Serializers que usan `build_media_url`

| Módulo | Serializer | Campos |
|--------|------------|--------|
| **content** | FileDetailsSerializer | file, url |
| **content** | TopicBasicSerializer | topic_image (to_representation) |
| **content** | TopicContentSerializer | topic_image (to_representation) |
| **content** | TopicIdTitleSerializer | topic_image |
| **content** | PublicationBasicSerializer | profile_picture |
| **content** | PreviewContentSerializer | file_details.file, file_details.url |
| **profiles** | ProfileSerializer | profile_picture |
| **profiles** | CryptoCurrencySerializer | thumbnail |
| **knowledge_paths** | FileDetailsSerializer | file |
| **knowledge_paths** | KnowledgePathSerializer, CreateSerializer, etc. | image |
| **events** | EventSerializer | image (to_representation) |
| **certificates** | CertificateSerializer | certificate_file, certificate_file_url, download_url |
| **certificates** | CertificateTemplateSerializer | template_file |
| **quizzes** | QuestionSerializer | image |
| **gamification** | BadgeSerializer, UserBadgeSummarySerializer | icon |

---

## Frontend

### Utilidad: `src/utils/fileUtils.js` → `resolveMediaUrl(value)`
- Valor null/undefined → null
- Ya es `http://` o `https://` → devuelve tal cual (correcto para S3)
- Relativo → `MEDIA_BASE_URL + value`

### Uso de media en el frontend

| Componente | Origen | ¿Usa resolveMediaUrl? |
|------------|--------|------------------------|
| ContentDisplay | file_details.url, file_details.file | ✅ Sí |
| LibraryUser | file_details.url, file_details.file | ✅ Sí |
| ContentProfileEdit | file_details, content.url | ✅ Sí |
| TopicContentMediaType | file_details.url | ✅ Sí |
| Collection | file_details.url, file_details.file | ✅ Sí |
| ContentReferences | path.image, topic.topic_image, pub.profile_picture | ❌ No (API ya devuelve absolutas) |
| TopicHeader | topic.topic_image | ❌ No (API ya devuelve absolutas) |
| ProfileHeader | profile.profile_picture | ❌ No (API ya devuelve absolutas) |
| FavoriteCryptos | crypto.thumbnail | ❌ No (API ya devuelve absolutas) |
| EventDetail | event.image, crypto.thumbnail | ❌ No (API ya devuelve absolutas) |
| KnowledgePath* | path.image | ❌ No (API ya devuelve absolutas) |
| Quiz | question.image | ❌ No (API ya devuelve absolutas) |
| Certificates | download_url, certificate_file_url | No (URLs absolutas del API) |

---

## Correcciones aplicadas

1. **TopicBasicSerializer, TopicContentSerializer**: `to_representation` con `build_media_url` para `topic_image`.
2. **knowledge_paths FileDetailsSerializer**: `file` como `SerializerMethodField` con `build_media_url`.
3. **CertificateSerializer**: `to_representation` para `certificate_file`; `download_url` ahora devuelve la URL real (antes siempre `None`).
4. **Frontend Certificates.jsx**: fallback a `certificate_file_url` si `download_url` está vacío.

---

## Nota sobre LibraryContentList.jsx

Eliminado: el componente estaba incompleto (código muerto, no importado). La funcionalidad equivalente se cubre con LibraryUser y ContentDisplay.
