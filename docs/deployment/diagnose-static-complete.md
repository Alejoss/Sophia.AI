# Diagnóstico Completo: Static Files

## Problema
Nginx devuelve 404 para `/static/admin/css/base.css` aunque los archivos existen en el contenedor.

## Diagnóstico Paso a Paso

### 1. Verificar que los archivos existen y están en el lugar correcto

```bash
# Verificar que el archivo existe
docker compose exec backend test -f /app/staticfiles/admin/css/base.css && echo "✅ Archivo existe" || echo "❌ Archivo NO existe"

# Verificar STATIC_ROOT configurado
docker compose exec backend python -c "from django.conf import settings; import os; print(f'STATIC_ROOT: {settings.STATIC_ROOT}'); print(f'Existe: {os.path.exists(settings.STATIC_ROOT)}')"

# Verificar que el archivo está en STATIC_ROOT
docker compose exec backend python -c "from django.conf import settings; import os; path = os.path.join(settings.STATIC_ROOT, 'admin/css/base.css'); print(f'Ruta completa: {path}'); print(f'Existe: {os.path.exists(path)}')"
```

### 2. Verificar configuración de Django

```bash
# Ver todas las configuraciones relevantes
docker compose exec backend python -c "
from django.conf import settings
print(f'DEBUG: {settings.DEBUG}')
print(f'STATIC_URL: {settings.STATIC_URL}')
print(f'STATIC_ROOT: {settings.STATIC_ROOT}')
print(f'ENVIRONMENT: {getattr(settings, \"ENVIRONMENT\", \"NOT SET\")}')
"
```

### 3. Verificar que Django puede servir el archivo directamente (SIN Nginx)

```bash
# Probar acceso directo a Django en el puerto 8000
docker compose exec backend curl -v http://localhost:8000/static/admin/css/base.css

# O desde el host (si el puerto está expuesto)
curl -v http://localhost:8000/static/admin/css/base.css
```

**Si esto devuelve 404:** El problema es Django, no Nginx.
**Si esto devuelve 200:** El problema es Nginx.

### 4. Verificar URLs de Django

```bash
# Verificar que las URLs de static están registradas
docker compose exec backend python manage.py show_urls | grep static || echo "No se encontraron URLs de static"
```

### 5. Verificar logs de Django

```bash
# Ver logs cuando se intenta acceder a /static/
docker compose logs backend --tail=100 | grep -i "static\|404\|GET.*static"
```

### 6. Verificar configuración de Nginx en el servidor

```bash
# Ver la configuración actual de Nginx (no la del repo, la del servidor)
cat /etc/nginx/sites-available/acbc-app | grep -A 5 "location /static"

# Verificar que Nginx está usando la configuración correcta
sudo nginx -T | grep -A 5 "location /static"
```

### 7. Verificar permisos

```bash
# Verificar permisos del directorio staticfiles
docker compose exec backend ls -la /app/staticfiles

# Verificar permisos del archivo específico
docker compose exec backend ls -la /app/staticfiles/admin/css/base.css
```

### 8. Probar acceso a través de Nginx con más detalle

```bash
# Ver headers completos
curl -v http://localhost/static/admin/css/base.css 2>&1 | head -30

# Ver qué está devolviendo Nginx
curl -I http://localhost/static/admin/css/base.css
```

## Posibles Problemas y Soluciones

### Problema 1: Django no puede servir los archivos (DEBUG=False)

**Síntoma:** `curl http://localhost:8000/static/admin/css/base.css` devuelve 404

**Causa:** En producción con `DEBUG=False`, Django no sirve static files automáticamente. Necesitamos usar `whitenoise` o servir a través de Nginx directamente.

**Solución A:** Usar WhiteNoise (recomendado para producción)
```bash
# Instalar whitenoise
pip install whitenoise

# Agregar a settings.py:
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Agregar aquí
    # ... resto del middleware
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

**Solución B:** Nginx sirve static files directamente (mejor rendimiento)
- Montar staticfiles en el host
- Nginx sirve desde el sistema de archivos

### Problema 2: Nginx no está proxyando correctamente

**Síntoma:** Django puede servir (200 en puerto 8000) pero Nginx devuelve 404

**Causa:** Configuración incorrecta de Nginx o orden de location blocks

**Solución:** Verificar y corregir configuración de Nginx

### Problema 3: Los archivos no están en el lugar correcto

**Síntoma:** El archivo existe pero Django no lo encuentra

**Causa:** `STATIC_ROOT` no apunta al lugar correcto o los archivos están en otro lugar

**Solución:** Verificar `STATIC_ROOT` y ejecutar `collectstatic` de nuevo

### Problema 4: Problema de permisos

**Síntoma:** Archivo existe pero no se puede leer

**Causa:** Permisos incorrectos

**Solución:** Ajustar permisos
```bash
docker compose exec backend chmod -R 755 /app/staticfiles
```

## Comando de Diagnóstico Todo-en-Uno

```bash
cd /opt/acbc-app && \
echo "=== 1. Verificando archivo ===" && \
docker compose exec backend test -f /app/staticfiles/admin/css/base.css && echo "✅ Existe" || echo "❌ NO existe" && \
echo "" && \
echo "=== 2. Verificando configuración Django ===" && \
docker compose exec backend python -c "from django.conf import settings; print(f'STATIC_ROOT: {settings.STATIC_ROOT}'); print(f'STATIC_URL: {settings.STATIC_URL}'); print(f'DEBUG: {settings.DEBUG}')" && \
echo "" && \
echo "=== 3. Probando Django directamente ===" && \
docker compose exec backend curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8000/static/admin/css/base.css && \
echo "" && \
echo "=== 4. Probando Nginx ===" && \
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost/static/admin/css/base.css && \
echo "" && \
echo "=== 5. Verificando configuración Nginx ===" && \
sudo cat /etc/nginx/sites-available/acbc-app | grep -A 3 "location /static"
```

## Próximos Pasos

1. Ejecuta el diagnóstico completo arriba
2. Comparte los resultados
3. Basado en los resultados, identificaremos el problema real
