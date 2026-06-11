# 07 — M6: TABLERO Y REPORTE SEMANAL

**Agente:** A6 · **Depende de:** TODOS (es el integrador; arranca último o
contra mocks de los endpoints de resumen de M2/M3/M5 definidos en sus specs).
**Es la cara del producto para el COMITENTE: la pantalla que abre todos los días.**

## 1. Objetivo
Una sola pantalla que responda la pregunta del producto ("¿cuánto me va a
terminar saliendo y cuánta plata me falta poner?") más "¿cómo viene la obra y
qué tengo que decidir hoy?". Y un reporte semanal generado solo, que llegue por
mail sin que nadie abra la app — el feature de retención.

## 2. Dentro / fuera
**Dentro:** tablero por obra con recorte por rol, feed de actividad (tabla
`evento`), bloque "Necesita tu acción", generación del reporte semanal
(job + on-demand), vista web del reporte, envío por email (en dev: log +
vista previa), preferencias de notificación mínimas (recibir/no recibir).
**Fuera:** tablero multi-obra/portafolio (v2), WhatsApp (v2 — dejar el
canal abstraído en `notificaciones/canales.ts`), comparativas entre obras,
exportación PDF del reporte (la vista web imprime bien con CSS print).

## 3. Entidades propias
`reporte_semanal` (doc 00 §5.6). Lee `evento` y los endpoints de resumen:
`GET caja/resumen` (M3), `GET plazos` (M5), `GET presupuestos?tipo=` (M2),
`GET ordenes-cambio?estado=PENDIENTE` (M4).

## 4. Endpoints
```
GET  /api/v1/obras/:obraId/tablero               → payload §5 (recorte por rol server-side)
POST /api/v1/obras/:obraId/reportes/generar      → genera el de la semana en curso
GET  /api/v1/obras/:obraId/reportes              → histórico
GET  /api/v1/obras/:obraId/reportes/:id          → contenido (vista web)
POST /api/v1/obras/:obraId/reportes/:id/enviar   → email a miembros suscritos
GET/PATCH /api/v1/yo/preferencias-notificacion   {reporte_semanal: bool}
Job programado: lunes 07:00 hora del servidor — generar y enviar para toda
obra ACTIVA con actividad en los últimos 60 días (implementar con cron simple
in-process + lock por obra; idempotente por (obra, semana_inicio)).
```

## 5. Tablero /obras/:id (ruta raíz de la obra)
Orden vertical de bloques (desktop 2 columnas, mobile apilado):
1. **Cifras maestras** (full width): Previsto · Comprometido · Pagado ·
   **Proyección final** (la cifra más grande de la pantalla) + Semaforo +
   barra apilada. Subtítulo: delta vs presupuesto_objetivo de la obra si existe.
2. **Necesita tu acción** (si hay): OCs pendientes de aprobar (botón directo),
   invitaciones pendientes, propuestas sin comparar hace >7 días, cotizaciones
   con fecha_precio >60 días. Tarjetas con CTA, máx 5, orden por antigüedad.
3. **Avance de obra**: % global, mini-curva prevista vs real (sparkline),
   "termina el dd/mm (+N días vs plan)" con color según demora.
4. **Desvíos por rubro**: top 5 rubros por |desvío|, con semáforo y monto;
   link "ver caja completa".
5. **Actividad reciente**: últimos 15 eventos (resumen_humano + fecha relativa
   + avatar), con fotos de avance como miniaturas si las hay. Link "ver todo".
6. **Recortes por rol** (server-side): CONSTRUCTOR ve solo: su cuenta
  (cobrado/por cobrar), sus OCs, avance de sus tareas, su actividad.
  PROVEEDOR: no accede al tablero (redirige a Presupuestos). COMITENTE/ADMIN/
  PROFESIONAL: completo.

## 6. Reporte semanal — estructura de `contenido` (jsonb)
```
{ semana: {desde, hasta},
  resumen_ejecutivo: string,           // 2-3 frases en español natural, generadas
                                       // por plantillas determinísticas (sin IA en MVP):
                                       // "Esta semana se pagaron $X en N movimientos.
                                       //  La obra está al Y% con Z días de demora.
                                       //  Tenés 1 orden de cambio esperando tu aprobación."
  cifras: {previsto, comprometido, pagado, proyeccion, delta_semana_pagado},
  avance: {pct_actual, pct_semana_anterior, tareas_finalizadas[], fotos[] (máx 6)},
  desvios: [{rubro, previsto, ejecutado, pct}],     // solo ámbar/rojo
  cambios: {aprobadas[], pendientes[]},
  proxima_semana: [{tarea, fecha_inicio}],          // tareas que arrancan
  pendientes_accion: [...] }                        // mismo criterio del tablero
```
- Vista web `/obras/:id/reportes/:rid`: documento limpio, imprimible, con las
  fotos de la semana en grilla — pensado para reenviar al grupo familiar.
- Email: HTML simple (tabla de cifras + resumen + botón "Ver reporte completo").
  El contenido respeta el recorte de rol del destinatario (generar variante
  COMITENTE y variante CONSTRUCTOR).

## 7. Reglas de negocio
- **R1.** El tablero no calcula nada de negocio: consume los endpoints de
  resumen de cada módulo. Si un módulo no responde, su bloque degrada a estado
  vacío con CTA, nunca rompe la página (cada bloque con error boundary).
- **R2.** Reporte idempotente por (obra, semana): regenerar reemplaza contenido
  pero conserva `generado_en` histórico en payload (lista `regeneraciones`).
- **R3.** Semana = lunes a domingo. El job del lunes reporta la semana cerrada.
- **R4.** No enviar si la obra no tuvo eventos en la semana Y el reporte
  anterior tampoco (evitar spam de obras dormidas); en ese caso generar pero
  marcar `enviado=false` con motivo.
- **R5.** Eventos: `reporte.generado`, `reporte.enviado`.
- **R6.** "Fecha relativa" en español: hoy/ayer/hace 3 días/dd-mm.
- **R7.** Accesibilidad mínima del tablero: cifras con `aria-label` completo,
  semáforos con texto además del color.

## 8. Criterios de aceptación
- [ ] Con la obra demo completa (todos los módulos sembrados) el tablero
  muestra los 5 bloques con datos coherentes con cada módulo (verificación
  cruzada manual documentada).
- [ ] Apagar el API de caja → el bloque degrada, el resto vive.
- [ ] Generar reporte on-demand → vista web correcta, imprimible, email
  logueado en consola con ambas variantes de rol.
- [ ] Job corre dos veces la misma semana → un solo reporte (regenerado).
- [ ] Login constructor → tablero recortado verificado contra payload (no solo CSS).
- [ ] Tests de R1–R4 y snapshot del resumen_ejecutivo con 3 escenarios
  (obra sana / obra con desvío / obra con OC pendiente).
