# Fix: Nginx 404 en Static Files

## Problema

Nginx devuelve 404 para `/static/admin/css/base.css` aunque los archivos existen en el contenedor.

## Diagnóstico

### 1. Verificar que Django puede servir el archivo directamente

```bash
# Probar acceso directo a Django (sin Nginx)
docker compose exec backend curl -I http://localhost:8000/static/admin/css/base.css
```

Si esto devuelve 200, el problema es Nginx. Si devuelve 404, el problema es Django.

### 2. Verificar configuración de Nginx

```bash
# Ver la configuración actual
cat /etc/nginx/sites-available/acbc-app

# Verificar que está habilitada
ls -la /etc/nginx/sites-enabled/

# Probar configuración
sudo nginx -t
```

## Solución

El problema es que `location /` captura todas las peticiones antes de que lleguen a `location /static`. Necesitamos hacer que `/static` y `/media` tengan prioridad.

### Opción 1: Reordenar location blocks (RECOMENDADO)

Las location blocks más específicas deben ir ANTES de las generales:

```nginx
server {
    listen 80;
    server_name _;

    # Static files - DEBE ir ANTES de location /
    location /static {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files - DEBE ir ANTES de location /
    location /media {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Health checks
    location /health {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # Backend API - DEBE ir ANTES de location /
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-CSRFToken" always;
        add_header Access-Control-Allow-Credentials true always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Admin de Django - DEBE ir ANTES de location /
    location /admin {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend (React App) - DEBE ir AL FINAL
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Pasos para Aplicar

1. **Actualizar el archivo en el repo local:**
   - Editar `nginx/nginx-server.conf` con el orden correcto
   - Commit y push

2. **En el servidor:**
   ```bash
   cd /opt/acbc-app
   git pull origin main
   
   # Copiar nueva configuración
   sudo cp nginx/nginx-server.conf /etc/nginx/sites-available/acbc-app
   
   # Probar configuración
   sudo nginx -t
   
   # Si OK, recargar Nginx
   sudo systemctl reload nginx
   
   # Probar
   curl -I http://localhost/static/admin/css/base.css
   ```

## Verificación

```bash
# Debe devolver 200
curl -I http://localhost/static/admin/css/base.css

# Debe devolver 200
curl -I http://localhost/admin/
```
