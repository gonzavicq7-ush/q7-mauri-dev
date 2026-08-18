#!/usr/bin/env bash
# ============================================================
#  setup-q7-obras-02.sh — Levantar q7-obras-02 en la VM nueva
#  Ejecutar DESPUÉS de setup-vm.sh
# ============================================================
set -euo pipefail

WORKSPACE_DIR="/opt/openclaw/workspace"
PROJECT_DIR="$WORKSPACE_DIR/mauri-dev/projects/q7-obras-02"
PG_PASSWORD="q7obras02"
DB_NAME="q7_obras_02"

echo "=============================================="
echo "  Setup q7-obras-02"
echo "=============================================="

cd "$PROJECT_DIR"

# ── 1. Crear base de datos ───────────────────────────────
echo ""
echo "[1/4] Creando base de datos ${DB_NAME}..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb "$DB_NAME"
echo "  DB ${DB_NAME} lista."

# ── 2. Configurar .env ───────────────────────────────────
echo ""
echo "[2/4] Configurando .env..."
cat > packages/db/.env << EOF
DATABASE_URL=postgresql://postgres:${PG_PASSWORD}@localhost:5432/${DB_NAME}
EOF

cat > apps/api/.env << EOF
DATABASE_URL=postgresql://postgres:${PG_PASSWORD}@localhost:5432/${DB_NAME}
JWT_SECRET=q7-obras-02-dev-secret-change-in-prod
PORT=3011
EOF
echo "  .env creados."

# ── 3. Migrar y sembrar ─────────────────────────────────
echo ""
echo "[3/4] Migrando y sembrando..."
pnpm db:generate
pnpm db:migrate
pnpm db:seed
echo "  Migración y seed completados."

# ── 4. Resumen ──────────────────────────────────────────
echo ""
echo "=============================================="
echo "  ✅ q7-obras-02 listo"
echo "=============================================="
echo ""
echo "  Para levantar:"
echo "    cd $PROJECT_DIR"
echo "    pnpm dev"
echo ""
echo "  Frontend: http://localhost:3041"
echo "  API:      http://localhost:3011"
echo ""
echo "  Usuarios demo (password: demo123):"
echo "    admin@demo.obra      (ADMIN_OBRA)"
echo "    comitente@demo.obra  (COMITENTE)"
echo "    pro@demo.obra        (PROFESIONAL)"
echo "    construct@demo.obra  (CONSTRUCTOR)"
echo "=============================================="
