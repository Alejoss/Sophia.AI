# Configurar Firewall en Digital Ocean

## Problema

El frontend funciona pero el backend en el puerto 8000 no responde o tarda demasiado. Esto generalmente se debe a que el puerto está bloqueado por el firewall.

## Solución: Configurar Firewall en Digital Ocean

Digital Ocean tiene **dos tipos de firewalls**:

1. **Firewall de Red (Network Firewall)** - A nivel de cuenta (recomendado)
2. **Firewall del Droplet (UFW)** - A nivel de servidor

---

## Opción 1: Firewall de Red de Digital Ocean (RECOMENDADO)

Este es el firewall que Digital Ocean gestiona desde su panel.

### Paso 1: Crear Firewall en Digital Ocean

1. Ve a tu panel de Digital Ocean: https://cloud.digitalocean.com/
2. En el menú lateral, ve a **Networking** → **Firewalls**
3. Click en **Create Firewall**
4. Configura así:

**Nombre:** `academia-blockchain-firewall`

**Inbound Rules (Reglas de Entrada):**
```
Tipo: SSH
Puerto: 22
Fuente: IPv4, IPv6, o IP específica

Tipo: HTTP
Puerto: 80
Fuente: IPv4, IPv6

Tipo: HTTPS
Puerto: 443
Fuente: IPv4, IPv6

Tipo: Custom
Puerto: 8000
Fuente: IPv4, IPv6
```

**Outbound Rules (Reglas de Salida):**
- Dejar por defecto (permitir todo)

5. Click en **Create Firewall**

### Paso 2: Asociar Firewall al Droplet

1. En la lista de firewalls, click en el que acabas de crear
2. Ve a la pestaña **Droplets**
3. Click en **Assign Droplets**
4. Selecciona tu droplet (`academia-blockchain-mvp`)
5. Click en **Assign to Droplets**

**¡Listo!** El firewall ahora permite tráfico en los puertos 22, 80, 443 y 8000.

---

## Opción 2: Verificar/Crear Firewall del Servidor (UFW)

Aunque Digital Ocean tiene su firewall, también debes verificar UFW en el servidor.

### Conectar al servidor y verificar UFW

```bash
ssh root@159.65.69.165

# Ver estado del firewall
ufw status

# Si está activo, verificar reglas
ufw status numbered
```

### Si UFW está bloqueando el puerto 8000

```bash
# Permitir puerto 8000
ufw allow 8000/tcp

# Verificar
ufw status
```

### Si UFW no está configurado

```bash
# Configurar firewall básico
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 8000/tcp # Backend API

# Activar firewall
ufw enable

# Verificar
ufw status
```

---

## Verificación Completa

### 1. Verificar que el backend esté corriendo

```bash
# En el servidor
docker compose ps backend

# Debe mostrar: Up (running)

# Ver logs
docker compose logs backend | tail -20
```

### 2. Verificar que el backend escuche en el puerto 8000

```bash
# En el servidor
netstat -tlnp | grep 8000
# O
ss -tlnp | grep 8000

# Debe mostrar algo como:
# tcp  0  0  0.0.0.0:8000  0.0.0.0:*  LISTEN
```

### 3. Probar desde el servidor (localhost)

```bash
# En el servidor
curl http://localhost:8000/health/

# Debe responder: {"status": "healthy", "service": "academia_blockchain"}
```

### 4. Probar desde tu computadora

```bash
# Desde tu máquina local
curl http://159.65.69.165:8000/health/

# Si funciona, deberías ver la respuesta JSON
# Si no funciona, el firewall está bloqueando
```

---

## Troubleshooting

### El backend no responde desde fuera

**Paso 1:** Verificar firewall de Digital Ocean
- Ve a Networking → Firewalls
- Verifica que el puerto 8000 esté permitido
- Verifica que el firewall esté asignado al droplet

**Paso 2:** Verificar UFW en el servidor
```bash
ufw status
ufw allow 8000/tcp
```

**Paso 3:** Verificar que Docker esté exponiendo el puerto
```bash
docker compose ps
# Verificar que el puerto esté mapeado: 0.0.0.0:8000->8000/tcp
```

**Paso 4:** Verificar que el backend esté escuchando
```bash
netstat -tlnp | grep 8000
```

### El backend responde en localhost pero no desde fuera

Esto confirma que es un problema de firewall:
1. Configura el firewall de Digital Ocean (Opción 1)
2. Verifica UFW (Opción 2)

### Error: "Connection timed out"

- El firewall está bloqueando el puerto
- Sigue los pasos de configuración del firewall

### Error: "Connection refused"

- El backend no está corriendo o no está escuchando en el puerto
- Verifica: `docker compose ps backend`
- Verifica logs: `docker compose logs backend`

---

## Configuración Recomendada Final

### Firewall de Digital Ocean:
- ✅ Puerto 22 (SSH)
- ✅ Puerto 80 (HTTP)
- ✅ Puerto 443 (HTTPS)
- ✅ Puerto 8000 (Backend API)

### UFW en el servidor:
- ✅ Puerto 22 (SSH)
- ✅ Puerto 80 (HTTP)
- ✅ Puerto 443 (HTTPS)
- ✅ Puerto 8000 (Backend API)

---

## Nota Importante

**Para producción con dominio:**
Una vez que configures Nginx como reverse proxy, puedes:
- Cerrar el puerto 8000 del firewall (solo accesible desde localhost)
- El backend será accesible a través de Nginx en `/api`

Pero para ahora, necesitas el puerto 8000 abierto para que funcione.
