# Migración a VM dedicada — Guía completa

## Contexto

Mauri (OpenClaw) se muda de `openclaw01` (Proxmox local) a una VM dedicada en la nube.
OpenClaw corre **nativo** (sin Docker), con Node.js + pnpm + PostgreSQL.

## Repositorios en GitHub

| Repo | Contenido | Visibilidad |
|------|-----------|-------------|
| `gonzavicq7-ush/q7-mauri-dev` | Proyectos (10) | privado |
| `gonzavicq7-ush/q7-workspace-root` | Identidad, memoria, skills | privado |

## Requisitos de la VM

- **RAM:** mínimo 2 GB (ideal 4 GB)
- **CPU:** 1-2 vCPUs (x86 o ARM, ambas sirven)
- **Disco:** 20 GB mínimo (whisper.cpp + modelos pesan)
- **SO:** Ubuntu Server 22.04 o 24.04

## Pasos de migración

### 1. Crear la VM y conectarse por SSH

```bash
ssh root@<IP-DE-LA-VM>
```

### 2. Copiar los scripts de setup

Los scripts están en el repo `q7-mauri-dev`:
- `setup-vm.sh` — instala Node, pnpm, PostgreSQL, clona repos
- `setup-q7-obras-02.sh` — levanta q7-obras-02

Opciones para copiarlos:
```bash
# Opción A: clonar primero y ejecutar desde el repo
git clone https://github.com/gonzavicq7-ush/q7-mauri-dev.git /tmp/mauri-dev
cd /tmp/mauri-dev

# Opción B: scp desde openclaw01
scp /opt/openclaw/workspace/mauri-dev/setup-vm.sh root@<IP>:/root/
scp /opt/openclaw/workspace/mauri-dev/setup-q7-obras-02.sh root@<IP>:/root/
```

### 3. Ejecutar setup base

```bash
chmod +x setup-vm.sh
./setup-vm.sh
```

Esto instala:
- Node.js 20 LTS
- pnpm
- PostgreSQL
- Clona `q7-mauri-dev` y `q7-workspace-root`
- Clona `whisper.cpp` (código de terceros)
- Instala dependencias de q7-obras-02

### 4. Levantar q7-obras-02

```bash
chmod +x setup-q7-obras-02.sh
./setup-q7-obras-02.sh
```

### 5. Instalar OpenClaw (gateway)

```bash
# Instalar OpenClaw CLI
npm install -g openclaw

# O según la documentación oficial
# https://docs.openclaw.ai
```

### 6. Configurar OpenClaw

Copiar la configuración desde openclaw01:
```bash
# En openclaw01
scp /opt/openclaw/openclaw.json root@<IP>:/opt/openclaw/
scp /opt/openclaw/.env root@<IP>:/opt/openclaw/  # si existe
```

## Notas importantes

### whisper.cpp
- Es código de terceros (ggerganov/whisper.cpp), se clona aparte
- Los modelos (`ggml-*.bin`) NO están en git, hay que descargarlos de nuevo
- ffmpeg/ffprobe estáticos también hay que reinstalarlos

### Datos que NO migran por git
- `node_modules` (se reinstala con `pnpm install`)
- Modelos de whisper (se descargan de nuevo)
- Binarios compilados (ffmpeg, whisper-cli)
- Bases de datos con datos reales (solo migran los seeds demo)

### Token de GitHub
- El token `ghp_...` estuvo expuesto en memoria local
- **Recomendado rotarlo** antes de la migración
- El remote de git ya lo tiene embebido (funciona sin config extra)

## Verificación post-migración

```bash
# 1. Verificar servicios
node --version
pnpm --version
psql --version

# 2. Verificar q7-obras-02
cd /opt/openclaw/workspace/mauri-dev/projects/q7-obras-02
pnpm dev
# → frontend en :3041, API en :3011

# 3. Probar login
curl -X POST http://localhost:3011/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.obra","password":"demo123"}'
```
