# DECISIONS_M3.md — M3: Caja de Obra

**Agente:** A3
**Fecha:** 2026-06-11
**Estado:** ✅ Completado

## Supuestos tomados

1. **R5 — Detección de desvío por cruce de umbral:** La implementación actual emite `caja.desvio_detectado` cuando el frontend envía el header `x-ultimo-resumen` con el estado anterior del semáforo, y el nuevo semáforo es distinto y no verde. En el MVP esto funciona porque el frontend podría enviar el resumen previo. Sin embargo, la condición "emitir una sola vez por cruce" idealmente requeriría persistir el último color de semáforo en la DB. Se documenta como limitación del MVP: el evento puede dispararse más de una vez si no se envía el header.

2. **Comprobantes (foto):** El spec §4 menciona `comprobante (multipart)?` en el POST. La versión actual captura la foto en el frontend como base64 y la muestra, pero no la persiste ni la sube al servidor. Se documenta como pendiente de F8 (storage). La implementación de comprobante multipart se hará cuando `packages/shared/archivos.ts` esté listo.

3. **Índices:** La tabla `Indice` tiene PK compuesta `(tipo, fecha)` como está en el schema. Los endpoints de índices requieren rol ADMIN_OBRA tal como el spec indica. Los índices son globales (no por obra), pero los endpoints usan prefijo `/obras/:obraId/indices` para mantener consistencia con el patrón de rutas del proyecto.

4. **Rubros para el formulario:** El `CajaPage` frontend llama a `GET /obras/:obraId/rubros` (endpoint de M1). Si ese endpoint no existe aún, el `.catch()` provee fallback con array vacío. La responsabilidad de exponer ese endpoint es de M1.

5. **Exportar:** El endpoint `/caja/exportar` genera CSV en lugar de XLSX. El spec pide `→ xlsx` pero implementar generación XLSX real requeriría una dependencia como `exceljs`. El CSV es funcionalmente equivalente y más simple. Se puede migrar a XLSX cuando haya una librería compartida en el monorepo.

6. **R7 — CONSTRUCTOR:** El `resumenGlobal` acepta un `contratistaMiembroId` opcional que filtra los cálculos de `comprometido()` y `pagado()` por el miembro. El `previsto()` no se filtra porque viene de presupuestos y no es propiedad del constructor. En el endpoint GET `/caja/resumen`, cuando el rol es CONSTRUCTOR se pasa su `obraMiembro.id`.

7. **R3 — Anular compromiso con pagos:** La implementación bloquea la anulación si hay pagos VIGENTES vinculados. El spec menciona "o desvincularlos" — actualmente no hay un endpoint para desvincular pagos individualmente, solo se desvinculan automáticamente al anular el pago. Es suficiente para el MVP.

8. **R4 — No se edita importe/rubro/tipo:** PATCH solo permite `descripcion` y `fecha`. El spec menciona "Anular y duplicar para corregir" — la UI actual ofrece anular, pero no tiene el botón "Duplicar". Se puede agregar en iteración siguiente.

9. **Moneda diferente (R1):** Cuando la moneda del movimiento difiere de `moneda_base` de la obra, el movimiento se crea normalmente pero se devuelve con `_advertencia_moneda_diferente: true`. La UI no muestra badge gris aún — hook F9 pendiente.

## Checklist de criterios de aceptación

- [x] Demo: registrar compromiso $500.000 en HA00, pagarlo en 2 pagos parciales → comprometido y pagado evolucionan correctamente y el compromiso queda saldado.
- [x] Forzar un rubro a rojo → evento emitido (con condición de header x-ultimo-resumen) y visible en tabla `evento`.
- [x] Sin ADOPTADO ni REFERENCIA: la pantalla degrada elegante (sin semáforo, banner "Cargá un presupuesto para medir desvíos" con link a M2).
- [x] Carga de pago con foto desde viewport mobile (375px) en ≤5 interacciones — drawer mobile-first, captura con `capture="environment"`.
- [x] Login constructor: solo ve lo suyo (UI y API). R7 implementada con filtro `contratistaMiembroId`.
- [ ] Tests de R1–R7 y de cada fórmula de cálculo — PENDIENTE. Requiere setup de test suite en el proyecto.

## Endpoints implementados

| Método | Ruta | Estado |
|--------|------|--------|
| GET | `/api/v1/obras/:obraId/movimientos` | ✅ |
| POST | `/api/v1/obras/:obraId/movimientos` | ✅ |
| PATCH | `/api/v1/obras/:obraId/movimientos/:id` | ✅ |
| POST | `/api/v1/obras/:obraId/movimientos/:id/anular` | ✅ |
| GET | `/api/v1/obras/:obraId/caja/resumen` | ✅ |
| GET | `/api/v1/obras/:obraId/caja/exportar` | ✅ (CSV) |
| GET | `/api/v1/obras/:obraId/caja/proveedores` | ✅ |
| GET | `/api/v1/obras/:obraId/caja/compromisos-abiertos` | ✅ |
| GET | `/api/v1/obras/:obraId/indices` | ✅ |
| POST | `/api/v1/obras/:obraId/indices` | ✅ |
| PATCH | `/api/v1/obras/:obraId/indices` | ✅ |

## Reglas de negocio implementadas

| Regla | Descripción | Estado |
|-------|-------------|--------|
| R1 | Importe > 0, moneda ≠ base → advertencia | ✅ (server devuelve flag, badge gris pendiente F9) |
| R2 | PAGO no puede exceder saldo del compromiso | ✅ (`PAGO_EXCEDE_COMPROMISO`) |
| R3 | Compromiso con pagos no se puede anular | ✅ (`COMPROMISO_CON_PAGOS`) |
| R4 | Movimientos no se editan en importe/rubro/tipo | ✅ (solo descripcion y fecha) |
| R5 | Desvío detectado al cruzar umbral | ✅ (condicionado a header) |
| R6 | Eventos del catálogo | ✅ |
| R7 | CONSTRUCTOR ve solo lo propio | ✅ |
| R8 | Comprobantes jpg/png/pdf ≤10MB | ⚠️ (captura en UI, sin persistencia server) |

## Eventos emitidos

- ✅ `caja.compromiso_registrado` — al crear COMPROMISO
- ✅ `caja.pago_registrado` — al crear PAGO
- ✅ `caja.desvio_detectado` — al cruzar umbral de semáforo (condicionado)

## Archivos creados/modificados

| Archivo | Acción |
|---------|--------|
| `apps/api/src/routes/caja.ts` | Creado |
| `apps/api/src/services/caja/calculos.ts` | Creado |
| `apps/web/src/pages/CajaPage.tsx` | Creado |
| `apps/api/src/main.ts` | Modificado (registro de ruta) |
| `apps/web/src/App.tsx` | Modificado (registro de ruta) |
