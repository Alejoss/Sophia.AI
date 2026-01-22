# Diagnóstico Simple: Static Files (sin curl)

## Comando de Diagnóstico (sin curl)

```bash
cd /opt/acbc-app

echo "=========================================="
echo "DIAGNÓSTICO"
echo "=========================================="
echo ""

echo "1. ¿Existe el archivo?"
docker compose exec backend test -f /app/staticfiles/admin/css/base.css && echo "   ✅ SÍ existe" || echo "   ❌ NO existe"
echo ""

echo "2. Configuración Django:"
docker compose exec backend python -c "
from django.conf import settings
import os
print(f'   DEBUG: {settings.DEBUG}')
print(f'   STATIC_ROOT: {settings.STATIC_ROOT}')
print(f'   STATIC_URL: {settings.STATIC_URL}')
print(f'   STATIC_ROOT existe: {os.path.exists(settings.STATIC_ROOT)}')
path = os.path.join(settings.STATIC_ROOT, 'admin/css/base.css')
print(f'   Archivo existe: {os.path.exists(path)}')
"
echo ""

echo "3. ¿Django puede servir el archivo? (usando Python requests)"
docker compose exec backend python -c "
import urllib.request
import sys
try:
    response = urllib.request.urlopen('http://localhost:8000/static/admin/css/base.css', timeout=5)
    status = response.getcode()
    print(f'   HTTP {status}')
    if status == 200:
        print('   ✅ Django SÍ puede servir')
        print('   → El problema es Nginx')
    else:
        print(f'   ❌ Django devuelve {status}')
        print('   → El problema es Django')
except urllib.error.HTTPError as e:
    print(f'   ❌ Django devuelve HTTP {e.code}')
    print('   → El problema es Django, no Nginx')
except Exception as e:
    print(f'   ⚠️  Error: {e}')
    print('   → Verificar que backend está corriendo')
" 2>&1
echo ""

echo "4. ¿Nginx puede servir el archivo?"
NGINX_STATUS=$(python3 -c "
import urllib.request
try:
    response = urllib.request.urlopen('http://localhost/static/admin/css/base.css', timeout=5)
    print(response.getcode())
except urllib.error.HTTPError as e:
    print(e.code)
except Exception as e:
    print('000')
" 2>/dev/null || echo "000")

if [ "$NGINX_STATUS" = "200" ]; then
    echo "   ✅ Nginx SÍ puede servir (HTTP $NGINX_STATUS)"
elif [ "$NGINX_STATUS" = "404" ]; then
    echo "   ❌ Nginx devuelve 404"
    echo "   → Nginx no está proxyando correctamente"
else
    echo "   ⚠️  Error al conectar (HTTP $NGINX_STATUS)"
fi
echo ""

echo "5. Verificar configuración Nginx:"
sudo cat /etc/nginx/sites-available/acbc-app | grep -A 3 "location /static" || echo "   ⚠️  No se encontró"
echo ""

echo "=========================================="
echo "RESUMEN"
echo "=========================================="
```

## Alternativa: Usar wget si está disponible

```bash
# Verificar si wget está disponible
docker compose exec backend which wget

# Si está disponible, usar:
docker compose exec backend wget -O- -q --spider http://localhost:8000/static/admin/css/base.css && echo "200" || echo "404"
```

## Alternativa: Ver logs de Django

```bash
# Ver logs cuando se accede a /static/
docker compose logs backend --tail=50 | grep -i "static\|GET.*static\|404"
```
