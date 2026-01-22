# Diagnóstico: Static Files del Admin

## Comandos de Diagnóstico (Ejecutar en el servidor)

### 1. Verificar que staticfiles existe y tiene contenido

```bash
# Verificar directorio
docker compose exec backend ls -la /app/staticfiles

# Verificar si existe el CSS del admin
docker compose exec backend test -f /app/staticfiles/admin/css/base.css && echo "✅ Existe" || echo "❌ NO existe"
```

### 2. Verificar configuración de Django

```bash
# Ver STATIC_ROOT y STATIC_URL
docker compose exec backend python -c "from django.conf import settings; print(f'STATIC_ROOT: {settings.STATIC_ROOT}'); print(f'STATIC_URL: {settings.STATIC_URL}')"
```

### 3. Probar acceso directo desde Django

```bash
# Probar que Django puede servir el archivo
docker compose exec backend curl -I http://localhost:8000/static/admin/css/base.css
```

### 4. Probar acceso a través de Nginx

```bash
# Desde el servidor
curl -I http://localhost/static/admin/css/base.css

# O desde tu máquina local (reemplaza con tu IP)
curl -I http://159.65.69.165/static/admin/css/base.css
```

### 5. Ver logs del backend

```bash
docker compose logs backend --tail=50 | grep -i "static\|404\|500"
```

## Solución Rápida

Si los archivos no existen, ejecuta:

```bash
# 1. Ejecutar collectstatic
docker compose exec backend python manage.py collectstatic --noinput

# 2. Verificar que se crearon
docker compose exec backend ls -la /app/staticfiles/admin/css/ | head -5

# 3. Reiniciar backend (por si acaso)
docker compose restart backend

# 4. Probar acceso
curl -I http://localhost/static/admin/css/base.css
```

## Diagnóstico Completo (Script)

Si prefieres un diagnóstico automático, ejecuta en el servidor:

```bash
cd /opt/acbc-app
bash scripts/diagnose-static-files.sh
```

## Problemas Comunes

### ❌ "No such file or directory: /app/staticfiles"
**Solución:** Ejecuta `collectstatic`

### ❌ HTTP 404 al acceder a /static/admin/css/base.css
**Causas posibles:**
1. No se ejecutó `collectstatic`
2. `STATIC_ROOT` está mal configurado
3. Nginx no está proxyando correctamente

### ❌ HTTP 500 al acceder a /static/
**Causa:** Error en Django al servir archivos
**Solución:** Revisar logs con `docker compose logs backend`
