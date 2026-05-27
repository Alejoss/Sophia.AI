# Configurar Nginx como Reverse Proxy

Esta guía explica cómo configurar Nginx como reverse proxy para la aplicación, permitiendo que el backend sea accesible a través del puerto 80 sin exponer directamente el puerto 8000.

## Ventajas

- ✅ Backend solo accesible desde localhost (más seguro)
- ✅ No necesitas abrir el puerto 8000 en el firewall
- ✅ Todo el tráfico pasa por un solo puerto (80)
- ✅ Preparado para agregar SSL/HTTPS fácilmente

## Prerequisitos

- Servidor con Docker y Docker Compose funcionando
- Acceso root o sudo al servidor
- Aplicación corriendo en Docker

## Pasos

### 1. Hacer Pull del Repositorio

```bash
cd /opt/acbc-app

# Si hay cambios locales (solo permisos), descartarlos
git restore acbc_app/entrypoint.sh scripts/setup-nginx.sh

# Hacer pull
git pull origin main

# Restaurar permisos de ejecución si es necesario
chmod +x scripts/setup-nginx.sh
chmod +x acbc_app/entrypoint.sh
```

**Nota:** NO necesitas parar los contenedores. Los contenedores seguirán corriendo normalmente porque Nginx se configura en el sistema operativo, no dentro de Docker.

**Importante:** Si Git muestra conflictos por cambios locales (generalmente solo permisos de ejecución), usa `git restore` para descartarlos antes de hacer pull.

### 2. Ejecutar el Script de Configuración

```bash
# Dar permisos de ejecución
chmod +x scripts/setup-nginx.sh

# Ejecutar como root
sudo ./scripts/setup-nginx.sh
```

El script:
- Instala Nginx si no está instalado
- Copia la configuración desde `nginx/nginx-server.conf`
- Habilita el sitio
- Prueba la configuración
- Recarga Nginx

### 3. Actualizar Variables de Entorno

Después de configurar Nginx, actualiza `VITE_API_URL`:

```bash
# Editar .env en la raíz
nano /opt/acbc-app/.env
```

Cambiar a:
```env
VITE_API_URL=http://159.65.69.165/api
```

**Nota:** Usa la IP de tu servidor o tu dominio si lo tienes.

### 4. Publicar/Desplegar Frontend

**Importante:** `VITE_API_URL` se inyecta en tiempo de build. En deploy normal, actualiza la GitHub Repository variable `VITE_API_URL`, espera a que GitHub Actions publique la nueva imagen frontend en GHCR y despliega:

```bash
cd /opt/acbc-app
git pull origin main
./scripts/deploy.sh
```

Si necesitas construir en el servidor de forma manual/local:

```bash
./scripts/deploy.sh --build-local
```

### 5. Verificar

```bash
# Health check del backend a través de Nginx
curl http://159.65.69.165/api/health/

# Debe responder: {"status": "healthy", "service": "academia_blockchain"}

# Verificar que el frontend funcione
curl http://159.65.69.165/health
```

## Estructura de URLs

Después de configurar Nginx:

- **Frontend:** `http://159.65.69.165/`
- **Backend API:** `http://159.65.69.165/api/`
- **Admin Django:** `http://159.65.69.165/admin/`
- **Health Check:** `http://159.65.69.165/api/health/`

## Configuración del Firewall

Ahora puedes **cerrar el puerto 8000** del firewall porque Nginx maneja todo el tráfico:

### En Digital Ocean:
- Eliminar la regla del puerto 8000 del firewall
- Solo necesitas: 22 (SSH), 80 (HTTP), 443 (HTTPS)

### En el servidor (UFW):
```bash
# Eliminar regla del puerto 8000
ufw delete allow 8000/tcp

# Verificar
ufw status
```

## Personalizar Configuración

Si necesitas modificar la configuración de Nginx:

1. Edita `nginx/nginx-server.conf` localmente
2. Haz commit y push
3. En el servidor:
   ```bash
   git pull origin main
   sudo cp nginx/nginx-server.conf /etc/nginx/sites-available/acbc-app
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## Agregar Dominio (Opcional)

Cuando tengas un dominio:

1. Edita `/etc/nginx/sites-available/acbc-app`
2. Cambia `server_name _;` por `server_name tudominio.com www.tudominio.com;`
3. Recarga: `sudo systemctl reload nginx`

O mejor aún, usa el script `setup-ssl.sh` que maneja esto automáticamente.

## Troubleshooting

### Nginx no inicia

```bash
# Verificar configuración
sudo nginx -t

# Ver logs
sudo tail -f /var/log/nginx/error.log
```

### Backend no responde a través de Nginx

```bash
# Verificar que el backend esté corriendo
docker compose ps backend

# Verificar que responda localmente
curl http://localhost:8000/health/

# Ver logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Error 502 Bad Gateway

- El backend no está corriendo o no responde
- Verifica: `docker compose ps backend`
- Verifica logs: `docker compose logs backend`

### Frontend no puede conectar con backend

- Verifica que `VITE_API_URL` esté actualizado en GitHub Repository variables (deploy normal) o en `.env` (solo `--build-local`)
- Despliega la nueva imagen GHCR: `./scripts/deploy.sh`
- Verifica que la URL sea accesible: `curl http://159.65.69.165/api/health/`

## Próximos Pasos

1. ✅ Configurar Nginx (completado)
2. 🔄 Actualizar `VITE_API_URL` en GitHub Repository variables
3. 🔄 Publicar imagen GHCR y desplegar con `./scripts/deploy.sh`
4. 🔄 Cerrar puerto 8000 del firewall
5. ⏭️ (Opcional) Configurar dominio y SSL

## Archivos Relacionados

- `nginx/nginx-server.conf` - Configuración de Nginx
- `scripts/setup-nginx.sh` - Script de instalación
- `docs/deployment/expose-to-internet.md` - Guía completa de exposición
