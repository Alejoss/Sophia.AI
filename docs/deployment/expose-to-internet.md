# Exponer la Aplicación a Internet - Digital Ocean

## Estado Actual

Tu aplicación ya está corriendo en:
- **IP del servidor**: `159.65.69.165`
- **Frontend**: Puerto 80 (http://159.65.69.165)
- **Backend**: Puerto 8000 (http://159.65.69.165:8000)

## Opciones para Exponer

### Opción 1: Acceso Directo por IP (Ya Funciona)

**Ventajas:**
- ✅ Ya está funcionando
- ✅ No requiere configuración adicional

**Desventajas:**
- ❌ No es profesional (IP en lugar de dominio)
- ❌ No tiene SSL/HTTPS
- ❌ Backend expuesto directamente en puerto 8000

**Acceso:**
- Frontend: `http://159.65.69.165`
- Backend API: `http://159.65.69.165:8000/api`

---

### Opción 2: Configurar Dominio + Nginx Reverse Proxy (RECOMENDADO)

Esta es la opción profesional. Requiere:

1. **Un dominio** (ej: `academiablockchain.com`)
2. **Nginx como reverse proxy** en el servidor
3. **SSL con Let's Encrypt** (HTTPS)

#### Paso 1: Configurar el Dominio

1. Compra un dominio (Namecheap, GoDaddy, Google Domains, etc.)
2. En el panel de DNS del dominio, crea registros A:
   ```
   Tipo: A
   Nombre: @ (o vacío)
   Valor: 159.65.69.165
   TTL: 3600
   
   Tipo: A
   Nombre: www
   Valor: 159.65.69.165
   TTL: 3600
   ```
3. Espera 5-30 minutos para que se propague el DNS

#### Paso 2: Instalar Nginx en el Servidor

```bash
# Conectar al servidor
ssh root@159.65.69.165

# Instalar Nginx
apt update
apt install nginx -y

# Verificar que Nginx esté corriendo
systemctl status nginx
```

#### Paso 3: Configurar Nginx como Reverse Proxy

```bash
# Crear configuración para tu dominio
nano /etc/nginx/sites-available/academiablockchain
```

**Pegar esta configuración** (reemplaza `tudominio.com` con tu dominio):

```nginx
# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    
    # Para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirigir todo lo demás a HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    # SSL (se configurará después con Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend (React App)
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers (si es necesario)
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # Admin de Django
    location /admin {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health checks
    location /health {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

```bash
# Habilitar el sitio
ln -s /etc/nginx/sites-available/academiablockchain /etc/nginx/sites-enabled/

# Eliminar configuración por defecto (opcional)
rm /etc/nginx/sites-enabled/default

# Verificar configuración
nginx -t

# Si todo está bien, recargar Nginx
systemctl reload nginx
```

#### Paso 4: Instalar Certbot (Let's Encrypt)

```bash
# Instalar Certbot
apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
certbot --nginx -d tudominio.com -d www.tudominio.com

# Seguir las instrucciones:
# - Email: tu email
# - Aceptar términos
# - Redirigir HTTP a HTTPS: Yes

# Verificar renovación automática
certbot renew --dry-run
```

#### Paso 5: Actualizar Variables de Entorno

```bash
# Actualizar .env del frontend (en la raíz)
nano /opt/acbc-app/.env
```

Cambiar:
```env
VITE_API_URL=https://tudominio.com/api
```

```bash
# Actualizar .env del backend
nano /opt/acbc-app/acbc_app/.env
```

Cambiar:
```env
ALLOWED_HOSTS=tudominio.com,www.tudominio.com,159.65.69.165
```

```bash
# Reconstruir frontend con nueva URL
cd /opt/acbc-app
docker compose build frontend
docker compose up -d frontend

# Reiniciar backend para cargar nuevos ALLOWED_HOSTS
docker compose restart backend
```

---

### Opción 3: Solo Dominio sin SSL (No Recomendado)

Similar a la Opción 2, pero sin SSL. **No recomendado** para producción porque:
- ❌ Sin encriptación
- ❌ Los navegadores mostrarán advertencias
- ❌ No es seguro para autenticación

---

## Verificación

### Opción 1 (IP Directa)
```bash
# Frontend
curl http://159.65.69.165/health

# Backend
curl http://159.65.69.165:8000/health/
```

### Opción 2 (Dominio + SSL)
```bash
# Frontend
curl https://tudominio.com/health

# Backend
curl https://tudominio.com/api/health/
```

---

## Configuración del Firewall

Asegúrate de que el firewall permita los puertos necesarios:

```bash
# Verificar estado
ufw status

# Si no está configurado:
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

**Nota:** Con Nginx como reverse proxy, puedes cerrar el puerto 8000 del backend:
```bash
# Cerrar puerto 8000 (solo accesible desde localhost)
ufw deny 8000/tcp
```

---

## Troubleshooting

### El dominio no resuelve
```bash
# Verificar DNS
dig tudominio.com
nslookup tudominio.com

# Esperar hasta 48 horas para propagación completa
```

### Nginx no inicia
```bash
# Verificar configuración
nginx -t

# Ver logs
tail -f /var/log/nginx/error.log
```

### SSL no funciona
```bash
# Verificar certificado
certbot certificates

# Renovar manualmente
certbot renew
```

### Backend no responde a través de Nginx
```bash
# Verificar que el backend esté corriendo
docker compose ps backend

# Verificar que responda localmente
curl http://localhost:8000/health/

# Ver logs de Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## Recomendación Final

**Para MVP/Beta:**
- Usa la **Opción 1** (IP directa) si solo necesitas probar rápido
- Actualiza `VITE_API_URL` a `http://159.65.69.165:8000/api`

**Para Producción:**
- Usa la **Opción 2** (Dominio + Nginx + SSL)
- Es más profesional, seguro y escalable

---

## Próximos Pasos

1. Decidir si usar dominio o solo IP
2. Si usas dominio: configurar DNS
3. Instalar y configurar Nginx
4. Configurar SSL con Let's Encrypt
5. Actualizar variables de entorno
6. Reconstruir frontend con nueva URL
