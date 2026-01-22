# Configurar Git en el Servidor

## Problema

Cada vez que ejecutas `chmod +x` en archivos del repositorio, Git detecta esto como un cambio local y bloquea `git pull`.

## Solución: Ignorar Cambios de Permisos

Configura Git para ignorar cambios en los permisos de archivos (modo de archivo). Esto es perfecto para servidores donde solo necesitas hacer `git pull`.

### Configuración Global (Recomendado)

```bash
# En el servidor
git config --global core.fileMode false
```

Esto hace que Git ignore cambios en permisos de archivos en todos los repositorios del servidor.

### Configuración Solo para Este Repositorio

Si prefieres solo para este proyecto:

```bash
cd /opt/acbc-app
git config core.fileMode false
```

## Verificar Configuración

```bash
# Ver configuración global
git config --global core.fileMode

# Ver configuración del repositorio
cd /opt/acbc-app
git config core.fileMode
```

Debería mostrar `false`.

## Después de Configurar

Ahora puedes hacer `chmod +x` sin que Git detecte cambios:

```bash
cd /opt/acbc-app

# Hacer pull sin problemas
git pull origin main

# Dar permisos de ejecución (Git no detectará cambios)
chmod +x scripts/setup-nginx.sh
chmod +x acbc_app/entrypoint.sh

# Verificar que Git no detecte cambios
git status
# No debería mostrar cambios en permisos
```

## Revertir (Si es Necesario)

Si en el futuro necesitas que Git detecte cambios de permisos:

```bash
# Revertir configuración global
git config --global --unset core.fileMode

# O revertir solo para este repositorio
cd /opt/acbc-app
git config --unset core.fileMode
```

## Nota Importante

Esta configuración solo afecta al servidor. En tu máquina local, Git seguirá detectando cambios de permisos normalmente, lo cual está bien porque quieres controlar esos cambios.

## Script de Configuración Rápida

Puedes ejecutar esto una vez en el servidor:

```bash
# Configurar Git para ignorar cambios de permisos
git config --global core.fileMode false

# Verificar
git config --global core.fileMode
echo "✅ Git configurado para ignorar cambios de permisos"
```

## Ventajas

- ✅ No necesitas hacer `git restore` antes de cada pull
- ✅ Puedes ejecutar `chmod +x` sin problemas
- ✅ `git pull` funciona directamente
- ✅ Solo afecta al servidor, no a tu máquina local

## Desventajas

- ⚠️ Si cambias permisos de archivos importantes, Git no los detectará
- ⚠️ Pero esto es exactamente lo que queremos en el servidor (solo hacer pull, no commitear cambios)

## Resumen

**Una vez configurado, el flujo es simple:**

```bash
cd /opt/acbc-app
git pull origin main
chmod +x scripts/*.sh  # Si es necesario, sin problemas
```

¡Sin más conflictos de permisos!
