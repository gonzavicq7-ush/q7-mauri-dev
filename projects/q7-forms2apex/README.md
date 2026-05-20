# q7-forms2apex — Migración Oracle Forms → APEX

Herramienta interna de Cuadrante7 para migrar sistemas Oracle Forms 6i/9i a Oracle APEX.

## Arquitectura

- **Backend:** FastAPI + PostgreSQL 15 + Redis + Celery
- **Frontend:** HTMX + Alpine.js + Tailwind (Jinja2 templates)
- **Storage:** MinIO (S3-compatible) para archivos
- **Multi-tenant:** PostgreSQL schema-per-organization

## Quick Start

```bash
# 1. Clonar y entrar
cd q7-forms2apex

# 2. Levantar servicios
docker-compose up -d

# 3. Crear tablas (primera vez)
docker-compose exec api alembic upgrade head

# 4. Abrir
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
# MinIO Console: http://localhost:9001
```

## Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| FastAPI | 8000 | API REST + frontend |
| PostgreSQL | 5433 | Base de datos |
| Redis | 6380 | Cola y cache |
| MinIO | 9000 / 9001 | Storage de archivos |

## Estructura

```
.
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/
│   │   └── versions/
│   └── app/
│       ├── __init__.py
│       ├── main.py              # Entry point FastAPI
│       ├── config.py            # Settings
│       ├── database.py          # Conexión DB
│       ├── celery.py            # Config Celery
│       ├── models.py            # SQLAlchemy models
│       ├── schemas.py           # Pydantic schemas
│       ├── dependencies.py      # Auth, DB session
│       ├── services/
│       │   ├── parser_service.py    # Parser Forms
│       │   ├── generator_service.py # Generator APEX
│       │   └── storage_service.py   # MinIO/S3
│       └── routers/
│           ├── auth.py          # Login/register
│           ├── organizations.py   # CRUD orgs
│           ├── projects.py        # CRUD projects
│           └── migrations.py      # Upload + parse + generate
├── frontend/
│   └── templates/               # Jinja2 templates
│       ├── base.html
│       ├── login.html
│       ├── dashboard.html
│       ├── project_detail.html
│       └── migration_wizard.html
└── parser.py                    # Parser legacy (reutilizado)
    apex_generator.py            # Generator legacy (reutilizado)
```

## Flujo de migración

1. **Login** → Dashboard
2. **Crear proyecto** → Subir `.txt` (Object List Report)
3. **Parser async** con barra de progreso en vivo
4. **Revisar** resultado parseado (bloques, items, triggers)
5. **Generar SQL** APEX → descargar

## Estado del desarrollo

Ver `PROJECT_STATE.md` para el estado actual y `DECISIONS.md` para decisiones técnicas.

## Notas

- Parser actual (`parser.py`) tiene bugs conocidos (triggers internos como items, bloques de control perdidos)
- Se están corrigiendo en paralelo con el desarrollo del frontend
- El generator (`apex_generator.py`) genera DDL SQL usando `wwv_flow_api`