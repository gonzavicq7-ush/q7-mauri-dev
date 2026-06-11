# DECISIONES M4 — Órdenes de Cambio

## Supuestos tomados durante la implementación

### D1: Reparto de días de impacto (R4-b)

**Decisión:** Cuando `impacto_dias > 0` y hay múltiples rubros afectados, todos los días se suman a la **última tarea del primer rubro afectado**.

**Justificación:** El spec dice "a la última tarea (por orden) de cada rubro afectado, repartiendo: total a la última tarea del primer rubro afectado (MVP simple)". Se interpretó que el "reparto" en el MVP significa concentrar todo el impacto en un solo punto (la última tarea del primer rubro) para simplificar la lógica y evitar side effects distribuidos.

**Alternativa considerada (descartada):** Repartir días proporcionalmente entre todas las tareas de todos los rubros afectados. Descartado porque requiere lógica de distribución más compleja y podría generar efectos en cascada difíciles de predecir.

**Impacto conocido:** Si la OC afecta múltiples rubros, solo el primer rubro verá afectado su plazo. En un MVP esto es aceptable; en versiones futuras se podría mejorar para распределить entre todos los rubros afectados.

---

### D2: Rubro para ítems en presupuesto ADOPTADO (R4-a)

**Decisión:** Al copiar ítems de la OC al presupuesto ADOPTADO, se asignan al **primer rubro afectado** (`rubrosAfectados[0]`).

**Justificación:** Una OC puede afectar múltiples rubros pero los ítems en sí no tienen asociado un rubro específico en el modelo de datos (a diferencia de `presupuesto_item` que tiene `rubroObraId`). Para el MVP se asignan todos al primer rubro afectado.

**Alternativa considerada (descartada):** Requerir que cada ítem de OC tenga un rubro asociado. Esto necesitaría modificar el schema, lo cual está prohibido para este módulo.

---

### D3: Asignación de usuario a movimientos (caja)

**Decisión:** Al crear una OC, no se crea automáticamente un movimiento de caja. La OC impacta en el presupuesto ADOPTADO (R4-a) pero no genera registros en `movimiento`.

**Justificación:** El flujo de caja requiere aprobación separada. La OC modifica el presupuesto adoptado, que a su vez influye en la proyección final visible en el tablero M6. La relación OC → Movimiento de caja es opcional y se maneja manualmente o via M3.

---

### D4: Moneda de la OC

**Decisión:** La OC usa la `monedaBase` de la obra al momento de su creación.

**Justificación:** No se permite cambiar la moneda de la OC posteriormente. El impacto se calcula en esa moneda. Si la obra cambia su moneda base, las OCs existentes mantienen su moneda original.

---

### D5: Numeración de OC

**Decisión:** El número de OC es secuencial por obra, asignado al momento de creación (R1). Nunca se reutiliza, ni siquiera si la OC se anula.

**Justificación:** El número de OC es un documento de referencia. Even if anulada, mantener el número evita confusión en la trazabilidad.

---

### D6: Estados editables

**Decisión:** Solo `BORRADOR` permite edición completa (PATCH) y anulación. `PENDIENTE` solo permite aprobar/rechazar. `APROBADA`, `RECHAZADA`, `ANULADA` son inmutables.

**Justificación:** Matches spec R2. Una OC en estado PENDIENTE ya fue enviada para aprobación y no debería modificarse.

---

### D7: Autoaprobación (R3)

**Decisión:** El solicitante NO puede aprobar su propia OC, aunque tenga rol ADMIN_OBRA o COMITENTE en la obra. La verificación es por `solicitanteId === usuarioId`, sin importar los roles del usuario.

**Justificación:** El spec es explícito: `OC_AUTOAPROBACION`. Esto evita conflictos de interés y mantiene la integridad del flujo de aprobación.

---

### D8: Eventos y resumen_humano

**Decisión:** Todos los eventos (`oc.creada`, `oc.enviada`, `oc.aprobada`, `oc.rechazada`) incluyen en `resumen_humano` un texto en español natural con el número de OC, título e impacto.

**Justificación:** El spec §6 indica que el `resumen_humano` se usa textualmente en el feed M6 y el reporte semanal. Debe ser legible por un comitente no técnico.

---

### D9: PDF de OC

**Decisión:** El endpoint `GET /:id/pdf` devuelve un archivo de texto formateado (`.txt`) en lugar de un PDF real. El contenido incluye todos los campos requeridos: obra, número, fechas, partes, descripción, ítems, impacto, estado y nota.

**Justificación:** Generar PDF real requiere una librería adicional (ej: PDFKit, puppeteer). Para el MVP se entrega un formato imprimible simple. La arquitectura permite reemplazar con PDF real sin cambiar la lógica de negocio.

---

### D10: Endpoint de rubros

**Decisión:** El formulario wizard de OC obtiene los rubros de la obra vía `GET /obras/:obraId/rubros` (endpoint de M1).

**Justificación:** Según ARQUITECTURA_COMUN.md §6, "lectura de tablas ajenas: permitida, solo lectura". M1 expone los rubros de la obra, que M4 consume para el selector múltiple de rubros afectados.

---

## Notas de implementación

### Transacción atómica en aprobar (R4)

La implementación de `aprobarOCAtomic` usa `prisma.$transaction` para garantizar que:
1. Crear/buscar presupuesto ADOPTADO
2. Copiar todos los ítems de la OC con `origen=ORDEN_CAMBIO`
3. Actualizar `diasPerdidos` de la última tarea del primer rubro
4. Marcar la OC como APROBADA

ocurran todas juntas o ninguna. Si cualquier operación falla, se hace rollback completo.

### Permisos en aprobar/rechazar

Los endpoints `POST /:id/aprobar` y `POST /:id/rechazar` requieren rol `ADMIN_OBRA` o `COMITENTE`. Adicionalmente, `puedeAprobar()` verifica que el usuario no sea el solicitante (R3).

### Campos calculados del frontend

`impactoCosto` se calcula en el backend como suma de `subtotal` de ítems (R4 del spec: "server-side"). El frontend solo envía `items[]`; el backend calcula y persiste el total.

---

## Reglas de negocio implementadas

| Regla | Descripción | Implementación |
|-------|-------------|----------------|
| R1 | Numeración secuencial por obra | `siguienteNumeroOC()` en POST |
| R2 | Solo BORRADOR editable/anulable | Validación de estado en PATCH, anular, enviar |
| R3 | No autoaprobación | `puedeAprobar()` verifica `solicitanteId !== userId` |
| R4 | Aprobación atómica | `prisma.$transaction` con 3 operaciones |
| R5 | Rechazo con nota obligatoria | Schema con `z.string().min(4)` |
| R6 | Permisos de creación/envío | `requiereRol` con roles específicos |
| R7 | PDF con información completa | `generarTextoOC()` incluye todos los campos |
| R8 | Eventos con resumen_humano | `EventoService.emitir()` en cada operación |