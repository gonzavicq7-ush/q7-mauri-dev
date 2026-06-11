# PROJECT_STATE.md — q7-obras-02 MVP

## Proyecto
- **Nombre:** q7-obras-02
- **Ubicación:** `mauri-dev/projects/q7-obras-02/`
- **Estado:** Fase 0 ✅ completa — scaffold del monorepo + M0 implementado
- **Specs:** 8 documentos en `specs/` (00 al 08)
- **Creado:** 2026-06-11
- **Última actividad:** 2026-06-11 — Fase 0 (M0 + scaffold total) desplegado
- **Propietario:** Victor Gonzalez

## Resumen del producto
Sistema operativo financiero de obras de construcción. Compite contra cuaderno + WhatsApp + Excel. Pregunta central: "¿Cuánto me va a terminar saliendo y cuánta plata me falta poner?"

## Arquitectura definida
- Monorepo pnpm: apps/web (React 18/Vite), apps/api (Node/Fastify), packages/db (Prisma/PostgreSQL), packages/ui (design system), packages/shared
- 5 roles: ADMIN_OBRA, COMITENTE, PROFESIONAL, CONSTRUCTOR, PROVEEDOR
- Comunicación por tabla `evento` (append-only), lectura cruzada permitida, escritura prohibida (salvo M4→M2+M5)
- Soft-delete universal, UUID v4, Decimal(14,2) para dinero, JWT auth

## Módulos (7)

| Módulo | Agente | Dependencias | Complejidad |
|--------|--------|-------------|-------------|
| M0 — Shell, auth, obras, equipo | A0 | Ninguna (Fase 0, bloqueante) | Alta (scaffold + schema + seeds + UI system) |
| M1 — Cómputo (rubros + tareas) | A1 | M0 | Media (jerarquía 3 niveles, import/export Excel) |
| M2 — Presupuestos + comparador | A2 | M0, M1 | Alta (3 momentos, comparador estrella) |
| M3 — Caja de obra | A3 | M0, M1 | Media-Alta (compromisos, pagos, desvío, semáforos) |
| M4 — Órdenes de cambio | A4 | M0, M1, M2, M5 | Alta (escritura cruzada, flujo aprobación, PDF) |
| M5 — Plazos y avance | A5 | M0, M1 | Media (cálculos hábiles, Gantt, curva S) |
| M6 — Tablero + reporte | A6 | Todos (Fase 3, integrador) | Alta (consume todos los módulos, email) |

## Análisis de fortalezas de la spec

- ✅ Modelo de 3 momentos (Referencia→Propuesta→Adoptado) captura EXACTAMENTE cómo se presupuesta
- ✅ Total comparable ≠ total nominal — evita el error clásico de comparar alcances distintos
- ✅ Compromiso + Pago como entidades separadas (no solo pagos — anticipa desvíos)
- ✅ OC con impacto visible ANTES de aprobar + escritura automática en adoptado/plazos
- ✅ Recorte de privacidad por rol en backend (no solo UI hide)
- ✅ Seeds con obra demo completa para tests de integración
- ✅ Definición de "terminado" clara y aplicable uniformemente

## Riesgos detectados en revisión

| Riesgo | Severidad | Detalle | Recomendación |
|--------|-----------|---------|--------------|
| Scope creep en M2 | Media | Features "hook F9/F10/F11" documentados pero fuera de MVP — tientan a implementar de más | Mantener los hooks como 501 o placeholder vacío |
| M4 escritura cruzada transaccional | Alta | Al aprobar OC, escribe en ADOPTADO (M2), tareas (M5) y emite evento en una sola transacción. Si un módulo no está, falla en cadena | Test de atomicidad exhaustivo; la spec ya lo pide ✅ |
| % cobertura M2 recalculado on-read | Baja | Con 50+ propuestas puede ser lento | OK para MVP; cachear solo si es necesario |
| Empate en adopción "todo verde" | Media | Botón global "Adoptar todo lo marcado en verde" — si 2 propuestas empatan en precio, ¿cuál gana? | Definir tiebreaker: menor precio → más antigua → alfabético proveedor |
| Parser Excel compartido M1/M2 | Media | M1 define parser; M2 lo reutiliza pero con columnas extras (PRECIO_UNITARIO, INCLUYE, EXCLUYE) | El parser debe ser extensible/parametrizable; documentar interfaz |
| M3 sin ADOPTADO ni REFERENCIA | Baja | Degrada elegante según spec, pero es un estado frecuente al inicio de una obra | ✅ Ya contemplado en spec: banner con CTA a M2 |
| M5 Constructor — regla de avance ambigua | Media | R7: "si no se puede determinar [si tiene adopciones], puede registrar avance en cualquier tarea" — abre brecha | Definir política concreta antes de implementar |
| Fechas hábiles sin feriados | Baja | MVP solo L-V. En AR hay ~15 feriados/año que impactan plazos | ✅ Documentado como fuera de MVP; fácil de agregar luego |

## Decisiones de diseño que acertaron

1. **Schema completo desde A0** — evita que agentes en paralelo migren en conflicto
2. **Seeds incluyen obra demo** — fixture de integración para todos los módulos
3. **Eventos con resumen_humano** — M6 los usa textualmente en feed y reporte
4. **Adopción = snapshot (deep copy)** — cambios posteriores en propuesta no contaminan
5. **Rechazo de OC exige nota** — trazabilidad en conflictos comitente↔constructor
6. **R4 M3 — movimientos no se editan** — se anulan y recrean, trazabilidad total
7. **R1 M5 — solo tareas hoja llevan plazos** — evita inconsistencias en jerarquía

## Fases y plan de ejecución

```
Fase 0 (secuencial, bloqueante): A0 → M0 + scaffold + schema TOTAL + UI system + seeds
Fase 1 (paralelo 3 agentes):     A1 (M1) · A3 (M3) · A5 (M5)
Fase 2 (paralelo 2 agentes):     A2 (M2) · A4 (M4)
Fase 3 (secuencial, integrador): A6 (M6) + pasada E2E completa
```

## Comparativa con q7-obras-01

| Aspecto | q7-obras-01 (prototipo) | q7-obras-02 (producto) |
|---------|------------------------|---------------------|
| Stack | Python/FastAPI + SQLite + HTMX | React/TS + Node/Fastify + Prisma/PostgreSQL |
| Tamaño | 8 HU, ~2000 líneas | 7 módulos, ~50K+ líneas estimadas |
| Auth | Sin auth (link por UUID token) | JWT + 5 roles con matriz granular |
| Presupuesto | Un solo presupuesto por categoría | 3 momentos: Referencia/Propuesta/Adoptado |
| Comparador | No existe | Es EL diferenciador del producto |
| Caja | Solo gastos (sin compromisos) | Compromisos + Pagos + Proyección |
| Órdenes de cambio | No existen | Flujo completo con impacto y aprobación |
| Plazos | No existen | Gantt, curva S, días hábiles |
| Tablero | Panel simple | Tablero integrador + reporte semanal automático |
| UX | Templates HTML básicos | Design system completo con tokens y componentes |

## Análisis por módulo (M3–M6)

### M3 — Caja de Obra
- ✅ Compromiso y Pago como entidades separadas: el compromiso anticipa el desvío, el pago confirma
- ✅ Semáforo verde ≤90% / ámbar 90-100% / rojo >100% — consistente con el componente `Semaforo` del DS
- ✅ Fallback en cascada: ADOPTADO → REFERENCIA → sin semáforo + CTA a M2
- ✅ R5: evento `caja.desvio_detectado` se emite una sola vez por cruce de umbral (no spam)
- ✅ R4: movimientos inmutables — se anulan y recrean, trazabilidad total
- ⚠️ R1: moneda distinta excluye de totales (badge gris) — correcto para MVP pero genera inconsistencia visual
- ⚠️ R3: anular compromiso con 50 pagos puede ser frustrante — considerar "anular en cascada"

### M4 — Órdenes de Cambio
- ✅ R3: solicitante NO puede aprobar su propia OC — evita conflicto de interés
- ✅ R4: transacción atómica al aprobar — escribe en ADOPTADO + tareas + evento. Si falla uno, nada persiste
- ✅ OC de economía: ítems con cantidad negativa → resta en el adoptado
- ⚠️ R4 reparto de días: "total a la última tarea del primer rubro" es simplista para obras con muchas tareas
- ✅ R8: 5 eventos distintos con resumen_humano para que M6 los muestre textualmente

### M5 — Plazos y Avance
- ✅ Solo tareas hoja llevan plazos (R1) — padres y rubros son rollup calculado
- ✅ Avance no puede bajar sin nota de corrección, solo ADMIN/PROFESIONAL (R2)
- ✅ Finalizar exige avance 100% — forzado por endpoint (R3)
- ✅ Gantt simplificado + curva S con Recharts — suficiente para MVP
- ⚠️ R7 Constructor: fallback "cualquier tarea" si no se determina pertenencia — política ambigua

### M6 — Tablero y Reporte Semanal
- ✅ R1: el tablero no calcula nada — consume endpoints de resumen de cada módulo
- ✅ Bloques con error boundary: si caja falla, el resto vive
- ✅ Recorte por rol server-side — PROVEEDOR redirige a Presupuestos
- ✅ Reporte idempotente por (obra, semana_inicio) — no duplica envíos
- ✅ R4: no enviar si la obra no tuvo eventos en la semana — evita spam
- ✅ Resumen ejecutivo con 3 escenarios de test: obra sana / con desvío / con OC pendiente

## Riesgos cross-module consolidados

| Riesgo | Severidad | Módulos afectados | Acción |
|--------|-----------|-------------------|--------|
| M4 escritura atómica en 3 tablas | 🔴 Alto | M4↔M2↔M5 | Test de atomicidad exhaustivo |
| Parser Excel M1/M2 con columnas distintas | 🟡 Medio | M1↔M2 | Hacerlo parametrizable desde día 1 |
| M5 Constructor avance en "cualquier tarea" | 🟡 Medio | M5 | Definir antes de implementar |
| Empate adopción "todo verde" M2 | 🟡 Medio | M2 | Tiebreaker: menor precio → antigüedad → alfabético |
| M3 sin presupuesto (estado frecuente) | 🟢 Bajo | M3↔M2 | Ya degrada con CTA a M2 |

## Próximo paso (a decidir con Victor)

1. **Opción A — Arrancar Fase 0**: scaffold del monorepo con A0 (M0 completo)
2. **Opción B — Revisión profunda**: más gaps/contradicciones entre módulos
3. **Opción C — Plan de migración**: roadmap q7-obras-01 → q7-obras-02
4. **Opción D — MVP reducido**: M0 + M2 + M3 primero, el resto después
