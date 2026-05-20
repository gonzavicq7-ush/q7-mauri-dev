# PROJECT_STATE.md

## Proyecto: q7-forms2apex
- **Workspace:** Mauri-dev
- **Estado:** diseño y prototipado inicial → **en transición a MVP funcional**
- **Objetivo:** automatizar la migración de Oracle Forms 6i/9i a Oracle APEX, extrayendo lógica de negocio desde Object List Reports y generando specs declarativas compatibles con APEXLang
- **Tipo de producto:** Herramienta interna de Cuadrante7 para migrar sistemas de clientes (no SaaS público)
- **Última actualización:** 2026-05-20
- **Responsable/s:** Mauri + Victor

## Arquitectura definida

### Tipo
Monolito API REST + Frontend SPA ligero (HTMX/Alpine.js)

### Stack
| Componente | Tecnología |
|---|---|
| Backend API | FastAPI (Python) |
| Base de datos | PostgreSQL 15 (multi-tenant por schema) |
| Cola async | Celery + Redis |
| Frontend | HTMX + Alpine.js + Tailwind (Jinja2 templates) |
| Storage | MinIO (S3-compatible) para archivos .txt y .sql |
| Auth | JWT + email/password |
| Contenerización | Docker Compose |

### Modelo de tenancy
- Una **Organización** = un cliente de Cuadrante7
- Un **Proyecto** = una migración específica (un sistema Forms)
- Múltiples **Usuarios** por organización (equipo de Cuadrante7 + cliente si aplica)
- Multi-tenant por **schema de PostgreSQL** (un schema por organización)

### Flujo de migración
1. Usuario crea Proyecto → sube `.txt` (Object List Report)
2. Parser async (Celery) extrae: bloques, items, triggers, alerts, canvas
3. Generador produce DDL SQL APEX
4. Tracking en tiempo real: % completado, logs, errores
5. Descarga del SQL generado

### Estados de una migración
| Estado | Descripción |
|---|---|
| `PENDING` | Archivo subido, esperando parseo |
| `PARSING` | Parser ejecutándose |
| `PARSED` | JSON generado, esperando revisión |
| `REVIEWING` | Usuario revisa mapeos |
| `GENERATING` | Generando SQL APEX |
| `COMPLETED` | SQL listo para descarga |
| `FAILED` | Error en alguna etapa |

## Recursos existentes en el workspace
- Repo brasileiro clonado: `/mauri-dev/projects/oracle-forms-migration/`
- Object List Reports de demo: `sch0001.txt`, `sch0002.txt`
- Parser Python funcional: `parser.py` (v1, con bugs conocidos)
- Generador APEX funcional: `apex_generator.py` (v1, genera DDL SQL)
- Paquetes PL/SQL generados de referencia: `.proposed_plsql.sql`, `.oracle_apex_plsql_calls.sql`
- CSVs de valores estáticos: LOVs y radio groups exportados