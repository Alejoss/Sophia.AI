# Fix: WhiteNoise Missing Manifest Entry

## Error

```
ValueError: Missing staticfiles manifest entry for 'admin/css/base.css'
```

## Causa

WhiteNoise con `CompressedManifestStaticFilesStorage` requiere un archivo manifest (`staticfiles.json`) que se genera al ejecutar `collectstatic`. Este manifest mapea los nombres de archivos a sus versiones con hash.

## Solución

Ejecutar `collectstatic` de nuevo para generar el manifest:

```bash
# En el servidor
cd /opt/acbc-app

# Ejecutar collectstatic (esto generará el manifest)
docker compose exec backend python manage.py collectstatic --noinput

# Reiniciar backend
docker compose restart backend

# Verificar que funciona
docker compose exec backend python -c "
import urllib.request
try:
    response = urllib.request.urlopen('http://localhost:8000/static/admin/css/base.css', timeout=5)
    print(f'✅ Django puede servir static files (HTTP {response.getcode()})')
except Exception as e:
    print(f'❌ Error: {e}')
"
```

## Alternativa: Usar storage sin manifest

Si prefieres no usar el manifest (menos optimizado pero más simple), puedes cambiar a:

```python
# En settings.py, cambiar:
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
# En lugar de:
# STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

Pero es mejor usar el manifest y ejecutar `collectstatic`.
