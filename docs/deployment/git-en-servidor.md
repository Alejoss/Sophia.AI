# Git en el Servidor - Buenas Prácticas

## Regla de Oro

**El servidor NO debe hacer commits al repositorio.** Solo debe hacer `git pull` para obtener cambios.

## Problema Común: Permisos de Ejecución

Cuando ejecutas `chmod +x` en archivos del repositorio, Git detecta esto como un cambio local. Esto puede bloquear `git pull`.

## Solución Recomendada: Configurar Git para Ignorar Permisos

**La mejor solución es configurar Git una vez para ignorar cambios de permisos:**

```bash
# En el servidor (ejecutar una sola vez)
git config --global core.fileMode false

# Verificar
git config --global core.fileMode
# Debe mostrar: false
```

Después de esto, puedes hacer `git pull` y `chmod +x` sin problemas. Git no detectará cambios en permisos.

**Ver guía completa:** `docs/deployment/configurar-git-servidor.md`

## Solución Alternativa: Descartar Cambios Manualmente

Si prefieres no configurar Git (o si ya tienes cambios locales):

```bash
# Ver qué cambió
git status

# Si solo son permisos (modo 100644 → 100755), descartarlos
git restore scripts/setup-nginx.sh
git restore acbc_app/entrypoint.sh

# O descartar todos los cambios locales
git restore .

# Ahora hacer pull
git pull origin main

# Restaurar permisos de ejecución después del pull
chmod +x scripts/setup-nginx.sh
chmod +x acbc_app/entrypoint.sh
```

### Si hay cambios reales que quieres mantener:

**NO los commitees desde el servidor.** En su lugar:

1. Copia los cambios a tu máquina local
2. Haz commit desde tu máquina
3. Haz push
4. En el servidor: `git pull`

## Comandos Útiles

### Ver cambios locales
```bash
git status
git diff
```

### Descartar todos los cambios locales
```bash
git restore .
```

### Descartar cambios de un archivo específico
```bash
git restore nombre-del-archivo
```

### Ver qué archivos están modificados
```bash
git status --short
```

### Forzar pull (descarta cambios locales)
```bash
# ⚠️ CUIDADO: Esto descarta todos los cambios locales
git fetch origin
git reset --hard origin/main
```

### Sobrescribir archivos locales al hacer pull
```bash
# Si Git dice "Your local changes would be overwritten"
# Opción 1: Descartar cambios y hacer pull
git restore scripts/setup-nginx.sh
git pull origin main

# Opción 2: Forzar pull (descarta TODOS los cambios locales)
git fetch origin
git reset --hard origin/main

# Opción 3: Guardar cambios temporalmente (si quieres conservarlos)
git stash
git pull origin main
# git stash pop  # Solo si necesitas los cambios guardados
```

## Flujo Recomendado (Después de Configurar Git)

```bash
# 1. Hacer pull directamente (sin conflictos de permisos)
cd /opt/acbc-app
git pull origin main

# 2. Dar permisos de ejecución si es necesario (Git no detectará cambios)
chmod +x scripts/*.sh
chmod +x acbc_app/entrypoint.sh
```

**Si NO has configurado Git para ignorar permisos:**

```bash
# 1. Verificar estado
cd /opt/acbc-app
git status

# 2. Si hay cambios locales (solo permisos), descartarlos
git restore .

# 3. Hacer pull
git pull origin main

# 4. Restaurar permisos de ejecución si es necesario
chmod +x scripts/*.sh
chmod +x acbc_app/entrypoint.sh
```

## Archivos que NO deben estar en Git

Estos archivos deben estar en `.gitignore` y nunca committearse:

- `.env` (cualquier `.env`)
- `*.log`
- Archivos de configuración local del servidor

Si Git muestra estos archivos como "untracked", está bien. No los agregues.

## Troubleshooting

### Error: "Your local changes would be overwritten"

```bash
# Descartar cambios locales
git restore .

# O si quieres guardarlos temporalmente
git stash

# Hacer pull
git pull origin main

# Si usaste stash, restaurar cambios (pero generalmente no es necesario)
# git stash pop
```

### Error: "Please commit your changes"

**NO commitees desde el servidor.** En su lugar:

```bash
# Descartar cambios
git restore .

# O guardar temporalmente
git stash

# Hacer pull
git pull origin main
```

### Archivos modificados que no deberían estar

Si accidentalmente modificaste archivos que no deberías:

```bash
# Ver qué cambió
git diff

# Descartar cambios
git restore nombre-del-archivo
```

## Resumen

1. ✅ **SÍ:** `git pull` para obtener cambios
2. ✅ **SÍ:** `git restore` para descartar cambios locales
3. ❌ **NO:** `git commit` desde el servidor
4. ❌ **NO:** `git push` desde el servidor
5. ✅ **SÍ:** `chmod +x` después de pull (si es necesario)
