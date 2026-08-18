#!/usr/bin/env bash
# ============================================================
#  setup-vm.sh — Preparación de VM dedicada para OpenClaw/Mauri
#  Ejecutar como root en Ubuntu Server 22.04 / 24.04 (x86 o ARM)
# ============================================================
set -euo pipefail

echo "=============================================="
echo "  Setup VM dedicada — OpenClaw / Mauri"
echo "=============================================="

# ── 0. Variables ──────────────────────────────────────────
GITHUB_USER="gonzavicq7-ush"
WORKSPACE_DIR="/opt/openclaw/workspace"
NODE_MAJOR="20"          # Node.js LTS (20.x). Cambiar a 22 si se prefiere
PG_PASSWORD="q7obras02"  # Contraseña PostgreSQL (ajustar si se desea)

# ── 1. Actualizar sistema ────────────────────────────────
echo ""
echo "[1/8] Actualizando sistema..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git build-essential ca-certificates gnupg lsb-release

# ── 2. Instalar Node.js LTS ──────────────────────────────
echo ""
echo "[2/8] Instalando Node.js ${NODE_MAJOR}.x..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

# ── 3. Instalar pnpm ─────────────────────────────────────
echo ""
echo "[3/8] Instalando pnpm..."
if ! command -v pnpm >/dev/null 2>&1; then
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  # Cargar en sesión actual
  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
  # Persistir en bashrc
  grep -q "PNPM_HOME" "$HOME/.bashrc" 2>/dev/null || {
    echo 'export PNPM_HOME="$HOME/.local/share/pnpm"' >> "$HOME/.bashrc"
    echo 'export PATH="$PNPM_HOME:$PATH"' >> "$HOME/.bashrc"
  }
fi
echo "pnpm: $(pnpm --version)"

# ── 4. Instalar PostgreSQL ───────────────────────────────
echo ""
echo "[4/8] Instalando PostgreSQL..."
if ! command -v psql >/dev/null 2>&1; then
  apt-get install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

# Configurar password del usuario postgres
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${PG_PASSWORD}';" 2>/dev/null || true
echo "PostgreSQL: $(psql --version 2>/dev/null || echo 'instalado')"

# ── 5. Crear estructura de directorios ───────────────────
echo ""
echo "[5/8] Creando estructura de directorios..."
mkdir -p "$WORKSPACE_DIR"

# ── 6. Clonar repositorios ───────────────────────────────
echo ""
echo "[6/8] Clonando repositorios..."

# 6a. Proyectos (mauri-dev)
if [ ! -d "$WORKSPACE_DIR/mauri-dev" ]; then
  git clone "https://github.com/${GITHUB_USER}/q7-mauri-dev.git" "$WORKSPACE_DIR/mauri-dev"
else
  echo "  mauri-dev ya existe, saltando..."
fi

# 6b. Identidad y memoria (workspace root)
if [ ! -d "$WORKSPACE_DIR/.git" ]; then
  git clone "https://github.com/${GITHUB_USER}/q7-workspace-root.git" "$WORKSPACE_DIR"
else
  echo "  workspace root ya existe, saltando..."
fi

# 6c. whisper.cpp (código de terceros, se clona aparte)
WHISPER_DIR="$WORKSPACE_DIR/mauri-dev/projects/q7-audio2md/tools/whisper.cpp"
if [ ! -d "$WHISPER_DIR/.git" ]; then
  echo "  Clonando whisper.cpp (código de terceros)..."
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
else
  echo "  whisper.cpp ya existe, saltando..."
fi

# ── 7. Instalar dependencias de proyectos ────────────────
echo ""
echo "[7/8] Instalando dependencias de proyectos..."

# q7-obras-02 (monorepo pnpm)
if [ -d "$WORKSPACE_DIR/mauri-dev/projects/q7-obras-02" ]; then
  echo "  Instalando q7-obras-02..."
  cd "$WORKSPACE_DIR/mauri-dev/projects/q7-obras-02"
  pnpm install --no-frozen-lockfile || true
  # Aprobar builds de Prisma/esbuild
  pnpm approve-builds --all 2>/dev/null || true
  pnpm install || true
fi

# ── 8. Resumen final ─────────────────────────────────────
echo ""
echo "=============================================="
echo "  ✅ Setup completado"
echo "=============================================="
echo ""
echo "  Node.js:      $(node --version)"
echo "  pnpm:         $(pnpm --version)"
echo "  PostgreSQL:   $(psql --version 2>/dev/null | head -1)"
echo "  Workspace:    $WORKSPACE_DIR"
echo ""
echo "  Repos clonados:"
echo "    - $WORKSPACE_DIR/mauri-dev  (proyectos)"
echo "    - $WORKSPACE_DIR            (identidad/memoria)"
echo ""
echo "  Próximos pasos:"
echo "    1. Configurar OpenClaw (instalar gateway)"
echo "    2. Crear base de datos q7_obras_02"
echo "    3. Migrar y sembrar q7-obras-02"
echo "    4. Levantar servicios"
echo ""
echo "  PostgreSQL: user=postgres pass=${PG_PASSWORD} db=localhost:5432"
echo "=============================================="
