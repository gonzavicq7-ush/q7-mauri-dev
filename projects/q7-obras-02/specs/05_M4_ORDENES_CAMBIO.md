# 05 — M4: ÓRDENES DE CAMBIO

**Agente:** A4 · **Depende de:** M0, M1 (rubros), M2 (escribe ítems en el
ADOPTADO al aprobar — única escritura cruzada permitida junto con plazos),
M5 (suma `dias_perdidos` a tareas al aprobar — segunda escritura permitida).
**Consumido por:** M6 (pendientes de aprobación en tablero y reporte).

## 1. Objetivo
Formalizar el "mientras estás acá, ¿me cambiás esto?" — la causa #1 de conflicto
comitente↔constructor. Una OC se propone, muestra su impacto en $ y días ANTES
de aprobar, se aprueba/rechaza con un clic con sello de usuario y fecha, y al
aprobarse impacta automáticamente en presupuesto adoptado y plazos. Historial
inmutable: la OC es el "contrato chico" que protege a ambas partes.

## 2. Dentro / fuera
**Dentro:** ciclo de vida completo (BORRADOR→PENDIENTE→APROBADA/RECHAZADA,
ANULADA desde borrador), ítems de detalle, impacto en costo y días, aprobación
desde la campana/notificación, PDF imprimible de la OC, listado con filtros.
**Fuera:** firma digital criptográfica, flujos multi-aprobador, versionado de
OC (se rechaza y se crea otra), adjuntos múltiples (solo 1 archivo opcional).

## 3. Entidades propias
`orden_cambio`, `orden_cambio_item` (doc 00 §5.5).

## 4. Endpoints
```
GET  /api/v1/obras/:obraId/ordenes-cambio          ?estado&pagina
POST /api/v1/obras/:obraId/ordenes-cambio          {titulo,descripcion,motivo,
     impacto_dias,rubros_afectados[],items[]} → BORRADOR, numero autoasignado
GET  /api/v1/obras/:obraId/ordenes-cambio/:id
PATCH .../:id                                      (solo en BORRADOR)
POST .../:id/enviar                                → PENDIENTE (notifica aprobadores)
POST .../:id/aprobar                               {nota?} → APROBADA (R4, R5)
POST .../:id/rechazar                              {nota (obligatoria)} → RECHAZADA
POST .../:id/anular                                (solo BORRADOR) → ANULADA
GET  .../:id/pdf                                   → PDF imprimible
```
`impacto_costo` = Σ subtotales de items (server-side; puede ser negativo si la
OC es una economía: ítems con cantidad negativa permitidos).

## 5. Pantallas
1. **/obras/:id/cambios** — lista de tarjetas: `OC #3 · Título`, motivo como
   badge, impacto en $ (verde si negativo/economía, rojo si positivo) e impacto
   en días, estado, solicitante y fecha. Filtros por estado. Cabecera con
   resumen: "OCs aprobadas: +$X y +N días sobre el presupuesto original".
   Pendientes de MI aprobación arriba, destacadas con borde primario.
2. **Detalle /cambios/:id** — encabezado tipo documento (número grande, estados
   como timeline horizontal BORRADOR→PENDIENTE→RESUELTA con fechas y usuarios),
   descripción, tabla de ítems, impacto total en recuadro destacado:
   "**+$450.000 · +5 días de obra**". Si PENDIENTE y el usuario puede aprobar:
   botonera fija inferior `Aprobar` (primario) / `Rechazar` (peligro), ambas
   con ModalConfirmar que repite el impacto textual.
3. **Formulario crear/editar** — wizard 2 pasos: (1) qué y por qué (título,
   motivo, descripción, rubros afectados con SelectorRubro múltiple, impacto en
   días con stepper +/-); (2) detalle económico (tabla de ítems editable inline,
   total calculado en vivo). Guardar como borrador o enviar directo.
4. **Notificación accionable** — el evento `oc.enviada` en la campana muestra
   botón "Revisar y aprobar" que deep-linkea al detalle.

## 6. Reglas de negocio
- **R1.** `numero` secuencial por obra, asignado al crear, nunca reutilizado.
- **R2.** Solo BORRADOR es editable/anulable. PENDIENTE solo admite
  aprobar/rechazar. APROBADA/RECHAZADA son inmutables para siempre.
- **R3.** Pueden aprobar: ADMIN_OBRA y COMITENTE. El solicitante NO puede
  aprobar su propia OC aunque tenga rol aprobador (`OC_AUTOAPROBACION`).
- **R4.** Al aprobar, en una misma transacción: (a) copiar ítems al presupuesto
  ADOPTADO con `origen=ORDEN_CAMBIO` (crear el ADOPTADO si no existe);
  (b) si `impacto_dias > 0` y hay rubros afectados con tareas con plazos
  cargados, sumar los días como `dias_perdidos` a la última tarea (por orden)
  de cada rubro afectado, repartiendo: total a la última tarea del primer rubro
  afectado (MVP simple — documentar en DECISIONES.md); (c) emitir `oc.aprobada`.
- **R5.** Rechazo exige nota; emite `oc.rechazada` con la nota en payload.
- **R6.** Permisos: CONSTRUCTOR y PROFESIONAL crean/envían; COMITENTE puede
  crear (pedido propio) pero igual la aprueba el otro aprobador o el ADMIN si
  el comitente es el solicitante (consecuencia de R3).
- **R7.** PDF incluye: obra, número, fechas, partes (solicitante/resolutor),
  descripción, ítems, impacto, estado y nota — apto para imprimir y firmar en
  papel si las partes quieren.
- **R8.** Eventos: `oc.creada`, `oc.enviada`, `oc.aprobada`, `oc.rechazada`,
  todos con resumen_humano ("Víctor aprobó la OC #3: +$450.000 y +5 días").

## 7. Criterios de aceptación
- [ ] Flujo demo completo: constructor crea OC → comitente la ve en campana →
  aprueba → ítems aparecen en ADOPTADO con origen "OC #n" y días sumados en M5.
- [ ] OC de economía (impacto negativo) se refleja restando en el adoptado.
- [ ] Intento de autoaprobación bloqueado (API y UI).
- [ ] Rechazo sin nota imposible; la nota llega al solicitante vía campana.
- [ ] PDF se genera y abre correctamente.
- [ ] Tests de R1–R6 incluyendo atomicidad de R4 (si falla plazos, no se
  escriben los ítems).
