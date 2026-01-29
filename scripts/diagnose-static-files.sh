#!/bin/bash
# Script de diagnóstico para static files del admin de Django

echo "=========================================="
echo "DIAGNÓSTICO: Static Files del Admin"
echo "=========================================="
echo ""

# 1. Verificar que el contenedor backend está corriendo
echo "1. Verificando contenedor backend..."
if docker compose ps backend | grep -q "Up"; then
    echo "   ✅ Backend está corriendo"
else
    echo "   ❌ Backend NO está corriendo"
    echo "   Ejecuta: docker compose up -d backend"
    exit 1
fi
echo ""

# 2. Verificar configuración de Django
echo "2. Verificando configuración de Django..."
echo "   STATIC_ROOT:"
docker compose exec backend python -c "from django.conf import settings; print(f'   {settings.STATIC_ROOT}')"
echo "   STATIC_URL:"
docker compose exec backend python -c "from django.conf import settings; print(f'   {settings.STATIC_URL}')"
echo ""

# 3. Verificar si el directorio staticfiles existe
echo "3. Verificando directorio staticfiles..."
if docker compose exec backend test -d /app/staticfiles; then
    echo "   ✅ Directorio /app/staticfiles existe"
    echo "   Contenido:"
    docker compose exec backend ls -la /app/staticfiles | head -10
    echo ""
    echo "   Archivos en staticfiles/admin:"
    if docker compose exec backend test -d /app/staticfiles/admin; then
        echo "   ✅ Directorio admin existe"
        docker compose exec backend ls /app/staticfiles/admin | head -5
    else
        echo "   ❌ Directorio admin NO existe - collectstatic no se ha ejecutado"
    fi
else
    echo "   ❌ Directorio /app/staticfiles NO existe"
fi
echo ""

# 4. Verificar archivo específico del admin
echo "4. Verificando archivo CSS del admin..."
if docker compose exec backend test -f /app/staticfiles/admin/css/base.css; then
    echo "   ✅ /app/staticfiles/admin/css/base.css existe"
    echo "   Tamaño:"
    docker compose exec backend ls -lh /app/staticfiles/admin/css/base.css
else
    echo "   ❌ /app/staticfiles/admin/css/base.css NO existe"
    echo "   ⚠️  Necesitas ejecutar: docker compose exec backend python manage.py collectstatic --noinput"
fi
echo ""

# 5. Probar acceso directo desde el contenedor
echo "5. Probando acceso directo a static file desde Django..."
STATUS=$(docker compose exec backend curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/static/admin/css/base.css)
if [ "$STATUS" = "200" ]; then
    echo "   ✅ Django puede servir el archivo (HTTP $STATUS)"
else
    echo "   ❌ Django NO puede servir el archivo (HTTP $STATUS)"
fi
echo ""

# 6. Probar acceso a través de Nginx (desde el host)
echo "6. Probando acceso a través de Nginx..."
if command -v curl &> /dev/null; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/static/admin/css/base.css)
    if [ "$STATUS" = "200" ]; then
        echo "   ✅ Nginx puede servir el archivo (HTTP $STATUS)"
    else
        echo "   ❌ Nginx NO puede servir el archivo (HTTP $STATUS)"
        echo "   Verifica configuración de Nginx"
    fi
else
    echo "   ⚠️  curl no disponible, saltando prueba"
fi
echo ""

# 7. Verificar logs recientes de Django
echo "7. Últimas líneas de logs del backend (buscando errores de static):"
docker compose logs backend --tail=20 | grep -i "static\|404\|500" || echo "   No se encontraron errores relacionados"
echo ""

# 8. Resumen y recomendaciones
echo "=========================================="
echo "RESUMEN Y RECOMENDACIONES"
echo "=========================================="
echo ""

# Verificar si collectstatic se necesita
if ! docker compose exec backend test -f /app/staticfiles/admin/css/base.css; then
    echo "⚠️  ACCIÓN REQUERIDA:"
    echo "   Ejecuta: docker compose exec backend python manage.py collectstatic --noinput"
    echo ""
fi

echo "Comandos útiles:"
echo "  - Ver logs: docker compose logs backend --tail=50"
echo "  - Reiniciar backend: docker compose restart backend"
echo "  - Ejecutar collectstatic: docker compose exec backend python manage.py collectstatic --noinput"
echo "  - Probar archivo: curl http://localhost/static/admin/css/base.css"
echo ""
