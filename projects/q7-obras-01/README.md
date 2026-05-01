# Q7 Obras — MVP

Aplicación web mínima para controlar gastos de obras de construcción/reforma. Sin registro, sin app — un link, una obra, control total.

## Stack

- Python 3.11+ / FastAPI
- SQLite + SQLAlchemy
- HTMX + Alpine.js
- Tailwind CSS (CDN)
- Jinja2

## Ejecutar localmente

```bash
cd q7-obras-01
chmod +x run.sh
./run.sh
```

Abrir http://localhost:8000

## Endpoints principales

| Ruta | Descripción |
|------|-------------|
| `GET /` | Landing — crear obra |
| `POST /obras` | Crear obra (HU-1) |
| `GET /obras/{token}` | Panel con comparativa (HU-4) |
| `GET /obras/{token}/presupuesto` | Presupuesto por categorías (HU-2) |
| `GET /obras/{token}/gastos/nuevo` | Formulario de gasto (HU-3) |
| `POST /obras/{token}/gastos` | Registrar gasto |
| `GET /obras/{token}/gastos` | Lista de gastos (HU-5) |
| `GET /obras/{token}/proveedores` | CRUD proveedores (HU-6) |

## Arquitectura

- `database.py` — conexión SQLite, creación de tablas
- `models.py` — modelos SQLAlchemy (Obra, CategoriaPresupuesto, ItemPresupuesto, Proveedor, Gasto)
- `schemas.py` — Pydantic schemas (preparados para futura API JSON)
- `main.py` — FastAPI app con todas las rutas HTML
- `templates/` — Jinja2 templates, mobile-first con Tailwind

## Auth

Sin login. El token UUID en la URL es la única credencial (`/obras/{token}`). Guardá el link — no hay recuperación.

## Licencia

MIT
