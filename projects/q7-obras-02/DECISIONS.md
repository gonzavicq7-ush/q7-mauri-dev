# DECISIONS.md — q7-obras-02 MVP

Decisiones de diseño y arquitectura tomadas durante la creación del proyecto.

---

## 2026-06-11 — Creación del proyecto

### D1. Nombre del proyecto
**Decisión:** `q7-obras-02` — sucesor de q7-obras-01.
**Motivo:** Victor decidió mantener la nomenclatura de proyecto en lugar del working name "ObraClara" de las specs.

### D2. Stack elegido
**Decisión:** React 18 + TypeScript + Vite (frontend), Node + Fastify (API), Prisma + PostgreSQL (DB), pnpm workspaces (monorepo).
**Motivo:** Especificado en `00_ARQUITECTURA_COMUN.md` como stack por defecto. Fastify sobre Express por performance, Prisma sobre raw SQL por type-safety, Vite sobre Next.js por simplicidad (SPA, no necesita SSR para una app interna).

### D3. Ubicación en Mauri-dev
**Decisión:** `mauri-dev/projects/q7-obras-02/` con specs en subcarpeta `specs/`.
**Motivo:** Sigue la regla establecida: proyectos nuevos en carpeta con nombre exacto del proyecto dentro de `Mauri-dev`.

### D4. Relación con q7-obras-01
**Decisión:** q7-obras-02 es el sucesor productivo de q7-obras-01. q7-obras-01 queda como prototipo funcional y fuente de aprendizaje de dominio, pero no se migra código. q7-obras-02 se construye desde cero sobre un stack y arquitectura completamente diferentes.
**Motivo:** El stack (Python/HTMX → React/Fastify) y la arquitectura (monolito → monorepo con contratos) son incompatibles. q7-obras-01 validó las necesidades del dominio; q7-obras-02 las implementa con seriedad productiva.

### D5. Especificaciones inmutables
**Decisión:** Los 8 documentos de spec (00–08) se tratan como fuente de verdad congelada. Cualquier cambio a los specs requiere aprobación explícita de Victor y se registra en este archivo.
**Motivo:** El paralelismo de agentes funciona solo si los contratos no cambian. El doc 00 lo establece como regla.

### D6. Sin implementación hasta decisión de Victor
**Decisión:** El proyecto queda con specs, README, PROJECT_STATE y DECISIONS, pero sin scaffold de código. La Fase 0 (A0) no arranca hasta que Victor lo indique.
**Motivo:** Victor debe decidir entre las opciones A–D planteadas en PROJECT_STATE.md. Arrancar sin alineación generaría retrabajo.
