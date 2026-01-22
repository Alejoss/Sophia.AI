# Diagnóstico Preciso: Static Files

## El Problema Real

Necesitamos determinar **exactamente dónde está fallando**:
1. ¿Django puede servir los archivos directamente? (puerto 8000)
2. ¿Los archivos están en el lugar correcto?
3. ¿Es un problema de Nginx o de Django?

## Diagnóstico Esencial (Ejecutar en el servidor)

```bash
cd /opt/acbc-app

echo "=========================================="
echo "DIAGNÓSTICO PRECISO"
echo "=========================================="
echo ""

echo "1. ¿Existe el archivo en el contenedor?"
docker compose exec backend test -f /app/staticfiles/admin/css/base.css && echo "   ✅ SÍ existe" || echo "   ❌ NO existe"
echo ""

echo "2. ¿Django puede servir el archivo directamente? (sin Nginx)"
STATUS=$(docker compose exec backend curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/static/admin/css/base.css 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then
    echo "   ✅ SÍ - Django puede servir (HTTP $STATUS)"
    echo "   → El problema es Nginx"
elif [ "$STATUS" = "404" ]; then
    echo "   ❌ NO - Django devuelve 404 (HTTP $STATUS)"
    echo "   → El problema es Django, no Nginx"
else
    echo "   ⚠️  Error al conectar (HTTP $STATUS)"
    echo "   → Verificar que el backend está corriendo"
fi
echo ""

echo "3. ¿Nginx puede servir el archivo?"
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/static/admin/css/base.css 2>/dev/null || echo "000")
if [ "$NGINX_STATUS" = "200" ]; then
    echo "   ✅ SÍ - Nginx puede servir (HTTP $NGINX_STATUS)"
elif [ "$NGINX_STATUS" = "404" ]; then
    echo "   ❌ NO - Nginx devuelve 404 (HTTP $NGINX_STATUS)"
    if [ "$STATUS" = "200" ]; then
        echo "   → Nginx no está proxyando correctamente a Django"
    fi
else
    echo "   ⚠️  Error (HTTP $NGINX_STATUS)"
fi
echo ""

echo "4. Configuración de Django:"
docker compose exec backend python -c "
from django.conf import settings
import os
print(f'   DEBUG: {settings.DEBUG}')
print(f'   STATIC_URL: {settings.STATIC_ROOT}')
print(f'   STATIC_ROOT: {settings.STATIC_ROOT}')
print(f'   STATIC_ROOT existe: {os.path.exists(settings.STATIC_ROOT)}')
path = os.path.join(settings.STATIC_ROOT, 'admin/css/base.css')
print(f'   Archivo en STATIC_ROOT: {os.path.exists(path)}')
"
echo ""

echo "5. Verificar configuración de Nginx:"
sudo cat /etc/nginx/sites-available/acbc-app | grep -A 3 "location /static" || echo "   ⚠️  No se encontró location /static"
echo ""

echo "=========================================="
echo "RESUMEN"
echo "=========================================="
if [ "$STATUS" = "200" ] && [ "$NGINX_STATUS" = "404" ]; then
    echo "→ PROBLEMA: Nginx no está proxyando correctamente"
    echo "  Solución: Verificar configuración de Nginx"
elif [ "$STATUS" = "404" ]; then
    echo "→ PROBLEMA: Django no puede servir los archivos"
    echo "  Posibles causas:"
    echo "    - DEBUG=False y static() helper no funciona en producción"
    echo "    - Los archivos no están en STATIC_ROOT"
    echo "    - Problema con urls.py"
    echo "  Solución: Usar WhiteNoise o servir desde Nginx directamente"
else
    echo "→ Verificar logs y configuración"
fi
```

## Si Django NO puede servir (HTTP 404 en puerto 8000)

**Causa probable:** Django con `DEBUG=False` no sirve static files automáticamente. El helper `static()` en `urls.py` puede no funcionar en producción.

**Soluciones:**

### Opción A: Usar WhiteNoise (Recomendado)

WhiteNoise permite que Django sirva static files en producción sin necesidad de Nginx.

```python
# En settings.py, agregar a MIDDLEWARE:
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Agregar aquí
    # ... resto
]

# Agregar al final de settings.py:
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### Opción B: Nginx sirve static files directamente (Mejor rendimiento)

Montar staticfiles en el host y hacer que Nginx los sirva directamente desde el sistema de archivos.

## Si Django SÍ puede servir (HTTP 200 en puerto 8000) pero Nginx devuelve 404

**Causa:** Nginx no está proxyando correctamente.

**Solución:** Verificar y corregir configuración de Nginx (orden de location blocks, etc.)
