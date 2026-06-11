# PROJECT_STATE.md — q7-obras-02 MVP

## Proyecto
- **Nombre:** q7-obras-02
- **Ubicación:** `mauri-dev/projects/q7-obras-02/`
- **Estado:** Especificación cerrada, implementación no iniciada
- **Specs:** 8 documentos en `specs/` (00 al 08)
- **Creado:** 2026-06-11
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

| Aspecto | q7-obras-01 (prototipo) | ObraClara (producto) |
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

## Próximo paso (a decidir con Victor)

1. **Opción A — Arrancar Fase 0**: scaffold del monorepo con A0 (M0 completo)
2. **Opción B — Revisión profunda**: detectar más gaps/contradicciones entre módulos
3. **Opción C — Plan de migración**: roadmap para pasar de q7-obras-01 a ObraClara
4. **Opción D — MVP reducido**: versión mínima con M0 + M2 + M3 primero, el resto después
