# q7-obras-02 — MVP (sucesor de q7-obras-01)

Sistema operativo financiero de obras de construcción. Para comitentes que autogestionan, pymes constructoras y estudios de arquitectura que invitan a sus clientes.

**Producto:** `q7-obras-02`

## Tesis

Competir contra el cuaderno, WhatsApp y tres planillas de Excel respondiendo siempre:

> **"¿Cuánto me va a terminar saliendo y cuánta plata me falta poner?"**

## Módulos MVP

| # | Módulo | Agente | Fase | Estado |
|---|--------|--------|------|--------|
| M0 | Shell, auth, obras, equipo | A0 | Fase 0 (bloqueante) | 🔴 Pendiente |
| M1 | Cómputo: rubros y tareas | A1 | Fase 1 (paralelo) | 🔴 Pendiente |
| M2 | Presupuestos y comparador | A2 | Fase 2 (paralelo) | 🔴 Pendiente |
| M3 | Caja de obra | A3 | Fase 1 (paralelo) | 🔴 Pendiente |
| M4 | Órdenes de cambio | A4 | Fase 2 (paralelo) | 🔴 Pendiente |
| M5 | Plazos y avance | A5 | Fase 1 (paralelo) | 🔴 Pendiente |
| M6 | Tablero + reporte semanal | A6 | Fase 3 (secuencial) | 🔴 Pendiente |

## Stack

- **Monorepo** pnpm workspaces: `apps/web` (React 18/TypeScript/Vite), `apps/api` (Node/Fastify), `packages/db` (Prisma/PostgreSQL), `packages/ui` (design system), `packages/shared`
- **Auth:** JWT + email/password
- **DB:** PostgreSQL 15, schema único en `packages/db`, soft-delete universal, UUID v4
- **Roles:** ADMIN_OBRA, COMITENTE, PROFESIONAL, CONSTRUCTOR, PROVEEDOR
- **Comunicación entre módulos:** tabla `evento` (append-only)

## Especificaciones

Todas las specs viven en `specs/`. Orden de lectura: `00 → spec del módulo → 08`.

| Archivo | Contenido |
|---------|-----------|
| `specs/00_ARQUITECTURA_COMUN.md` | Constitución: modelo de datos, roles/permisos, eventos, UX, API, seeds |
| `specs/01_M0_SHELL_OBRAS_EQUIPO.md` | Auth, obras, invitaciones, shell de navegación |
| `specs/02_M1_COMPUTO.md` | Rubros y tareas, importación/exportación Excel |
| `specs/03_M2_PRESUPUESTOS_COMPARADOR.md` | Los 3 momentos + comparador |
| `specs/04_M3_CAJA_OBRA.md` | Compromisos, pagos, semáforo de desvío |
| `specs/05_M4_ORDENES_CAMBIO.md` | Ciclo de OC con aprobación digital |
| `specs/06_M5_PLAZOS_AVANCE.md` | Fechas, días perdidos, avance, curva S |
| `specs/07_M6_TABLERO_REPORTE.md` | Tablero integrador + reporte semanal |
| `specs/08_ORQUESTACION_AGENTES.md` | Fases, prompts, checklist E2E |

## Requisitos de entorno

- Node.js 20+
- PostgreSQL 15+
- pnpm 8+
- Redis (opcional, para jobs)

## Quick start

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Reglas de oro

1. **Nada se borra físicamente** — soft-delete universal (`eliminado_en`)
2. **Todo dato histórico se conserva** — comparar es el core del producto
3. **Escritura cruzada prohibida** — solo M4 escribe en M2 y M5 (vía funciones exportadas por M2)
4. **Todo en español** — entidades, campos, rutas, labels
5. **IDs UUID v4** en todas las tablas
6. **Dinero Decimal(14,2)** — nunca float, siempre con `moneda` ISO 4217

## Relación con q7-obras-01

`q7-obras-01` fue el prototipo funcional (Python/FastAPI + SQLite + HTMX) que validó el dominio. q7-obras-02 es el **sucesor productivo** con arquitectura seria, multi-tenant por esquema PostgreSQL, design system completo, y soporte para implementación con agentes en paralelo.