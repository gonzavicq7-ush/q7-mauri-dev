# M6 — Tablero y Reporte Semanal — Decisiones

## 1. El tablero NO calcula, solo consume

**Decisión:** El tablero no replica lógica de negocio de otros módulos. Consulta directamente:
- `resumenGlobal()` del servicio `caja/calculos` para cifras y desvíos (lectura directa, no HTTP).
- `prisma.tarea` + `prisma.avanceRegistro` directamente para plazos/avance (no existe endpoint plazos en el scaffold).
- Tabla `evento` para actividad reciente.
- Tabla `ordenCambio` para OCs pendientes.

**Motivo:** Según spec §7 R1, "el tablero no calcula nada de negocio". La comunicación entre módulos es por lectura de tablas, no por HTTP. Evitamos circular dependency importando los servicios directamente.

## 2. Degradación por bloque (error boundaries)

Cada bloque del tablero tiene su propio `BlockErrorBoundary` (React class component). Si el fetch de caja falla, solo el bloque "Cifras maestras" muestra error local; los demás bloques siguen funcionando.

## 3. Recorte por rol server-side

El endpoint `GET /tablero` filtra según el rol del miembro antes de devolver datos:
- **CONSTRUCTOR**: la query de eventos usa filtro `OR` con `usuarioId = current` + eventos de tipo caja/plazos. El resumen de caja pasa `contratistaId` al `resumenGlobal`.
- **PROVEEDOR**: devuelve 403 con mensaje de redirigir a Presupuestos.

## 4. Idempotencia del reporte (R2)

`POST /reportes/generar` busca primero si existe un reporte para `(obraId, semana_inicio)`. Si existe, regenera (conserva `_regeneraciones` en el contenido). Si no existe, crea nuevo.

## 5. `preferenciasNotificacion` no existe en schema

El schema `Usuario` no tiene campo `preferenciasNotificacion`. Los endpoints `GET/PATCH /yo/preferencias-notificacion` devuelven默认值 (`reporte_semanal: true`) sin persistencia. Se documenta que cuando el schema se actualice, estos endpoints deben escribir a ese campo.

## 6. Semáforo: 3 estados

Verde ≤90%, Ámbar 90-100%, Rojo >100% (del módulo shared `calcularSemaforo`). Los bloques de cifras maestras y desvíos lo usan.

## 7. Fecha relativa en español

`fechaRelativa()`: "hoy", "ayer", "hace N días", "dd/mm". Implementada directamente en el route del tablero para los eventos.

## 8. Curva de avance mini (sparkline SVG)

Generada como SVG inline `<polyline>` con 8 puntos (últimas 8 semanas desde `avanceRegistro`). No usa librería externa.

## 9. Reporte semanal: plantillas determinísticas (sin IA)

`generarResumenEjecutivo()` usa 3 escenarios simples (SANA / CON_DESVIO / CON_OC_PENDIENTE) con plantillas de string concatenation. No usa OpenAI ni similares. El resumen nunca mencionaIA.

## 10. Emails en desarrollo

`POST /reportes/:id/enviar` loguea a consola en `NODE_ENV !== 'production'`. En producción, queda como placeholder (comentado) para integración con servicio de email real.

## 11. Job programado (cron in-process)

El spec menciona job "lunes 07:00". No se implementó en esta entrega porque requiere要么 scheduler externo (node-cron)要么 una capa de jobs separada. El endpoint `POST /reportes/generar` está disponible para触发 manualmente o desde un cron externo. La lógica de R4 (obra sin eventos → no enviar) está en el servicio `generarReporteSemanal`.