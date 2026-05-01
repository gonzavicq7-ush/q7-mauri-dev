# DECISIONS.md

**Fecha:** 2026-05-01

## Decisiones clave

### 1. Nombre del proyecto
**Decisión:** `q7-obras` (nombre comercial tentativo: "Q7 Obras")
**Razón:** Prefijo interno `q7-` para namespace. Sufijo `obras` descriptivo del dominio.

### 2. Foco del MVP
**Decisión:** Gestión de gastos y presupuestos de una obra única por usuario particular. El portal profesional queda como fase 2.
**Razón:** Validar el core primero (un particular gestionando su obra) antes de añadir multi-tenancy profesional. Reduce complejidad inicial drásticamente.

### 3. Público objetivo primario
**Decisión:** Particulares con una obra en curso (reforma, construcción) que necesitan controlar gastos de materiales y mano de obra.
**Razón:** Es el segmento más grande y con menos herramientas. Los profesionales usarán software especializado existente; el valor diferencial está en el particular.

### 4. Modelo de revenue (fase 1)
**Decisión:** Gratuito para particulares (sin límite de gastos). Fase 2: plan freemium con límite de obras + plan pago para profesionales (multi-obra, multi-cliente).
**Razón:** El MVP busca adopción y feedback, no monetización inmediata. La gratuidad elimina fricción.

### 5. Stack tecnológico
**Decisión:** Backend Python (FastAPI) + SQLite, Frontend HTMX + Alpine.js, Tailwind CSS. Despliegue simple en VPS.
**Razón:** Stack mínimo, productivo, sin build steps complejos. HTMX evita SPA overhead. SQLite elimina infraestructura de base de datos. Migrable a PostgreSQL si escala.

### 6. No-auth inicial
**Decisión:** El MVP usará un identificador de obra vía URL (token simple en link). Sin registro, login ni contraseñas en fase 1.
**Razón:** Elimina fricción total para el MVP. El particular recibe un link único y gestiona su obra. Se añadirá auth en fase 2.

### 7. Entorno de desarrollo
**Decisión:** Python 3.11+, venv, desarrollo local con hot-reload de FastAPI.
**Razón:** Simplicidad. Sin Docker en fase MVP.
