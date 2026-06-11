# 03 — M2: PRESUPUESTOS Y COMPARADOR (LOS 3 MOMENTOS)

**Agente:** A2 · **Depende de:** M0, M1 (lee rubros/tareas; reutiliza el parser
Excel de M1 con plantilla propia).
**Consumido por:** M3 (el ADOPTADO es el "previsto" contra el que se mide la
caja), M4 (las OC aprobadas inyectan ítems al ADOPTADO), M6 (totales).
**Es el módulo diferenciador del producto: máxima prioridad de calidad UX.**

## 1. Objetivo
Modelar los tres momentos del costo — REFERENCIA (lo que estimo), PROPUESTA
(lo que me cotizan, 1..n), ADOPTADO (lo que decido) — y dar la pantalla que
ningún competidor da: comparar propuestas normalizadas por rubro, ver huecos de
alcance, y adoptar ganadores rubro por rubro o en bloque.

## 2. Dentro / fuera
**Dentro:** CRUD de presupuestos de los 3 tipos, ítems con
incluye/excluye/no_cotizado, importación Excel de propuestas, comparador por
rubro, adopción parcial/total con snapshot trazable, vista del presupuesto
adoptado consolidado, totales por rubro y por tipo_recurso, exportar comparativa.
**Fuera (hooks documentados):** mapeo asistido por IA de PDFs (F10 — dejar el
endpoint `POST /propuestas/:id/mapeo-asistido` devolviendo 501 con mensaje
"disponible próximamente"), escenarios de ingeniería de valor clonables (F11),
indexación a moneda constante (F9 — el dato fecha_precio+moneda ya se captura).

## 3. Entidades propias
`presupuesto`, `presupuesto_item`, `adopcion` (doc 00 §5.3).

## 4. Endpoints
```
GET  /api/v1/obras/:obraId/presupuestos               ?tipo → lista con totales
POST /api/v1/obras/:obraId/presupuestos               {tipo,nombre,moneda,
     fecha_precio,contratista_miembro_id?|proveedor_nombre?,observaciones?}
GET  /api/v1/obras/:obraId/presupuestos/:id           → con ítems agrupados por rubro
PATCH/DELETE /api/v1/obras/:obraId/presupuestos/:id   (DELETE → estado DESCARTADO)
POST /api/v1/obras/:obraId/presupuestos/:id/items     {rubro_obra_id,tarea_id?,
     descripcion,tipo_recurso,unidad,cantidad,precio_unitario,incluye?,excluye?}
PATCH/DELETE .../items/:itemId
POST .../:id/items/no-cotizado                        {rubro_obra_id} (marca hueco)
POST .../:id/importar                                 (wizard reutilizando parser M1,
     plantilla §5) / .../importar/confirmar
GET  /api/v1/obras/:obraId/comparador                 ?propuestas=id1,id2,id3 →
     estructura §6.3 (núcleo del módulo)
POST /api/v1/obras/:obraId/adopciones                 {rubro_obra_id,
     presupuesto_origen_id,nota?}  → copia ítems al ADOPTADO (R5)
DELETE /api/v1/obras/:obraId/adopciones/:id           (revierte, conserva historial)
GET  /api/v1/obras/:obraId/comparador/exportar        ?propuestas= → xlsx
```

## 5. Plantilla Excel de propuesta
`CODIGO_RUBRO | CODIGO_TAREA(opcional) | DESCRIPCION | TIPO_RECURSO | UNIDAD |
CANTIDAD | PRECIO_UNITARIO | INCLUYE | EXCLUYE`
Mismas tolerancias del parser de M1. Si CODIGO_TAREA no existe en el cómputo, el
ítem queda vinculado solo a rubro (válido) con advertencia informativa.

## 6. Pantallas

### 6.1 /obras/:id/presupuestos (índice)
Tres secciones apiladas con encabezado propio:
1. **Mi estimación (REFERENCIA)** — tarjeta única: total, fecha_precio, antigüedad
   en días con badge ámbar si >60 días ("precios de hace 4 meses"). CTA crear si
   no existe.
2. **Propuestas recibidas** — tarjetas por propuesta: proveedor, total, fecha,
   % cobertura del cómputo (R3), badge de estado, botón "Comparar" (checkbox de
   selección múltiple, máx 4) que habilita botón flotante "Comparar (n)".
3. **Presupuesto adoptado** — tarjeta resumen: total, desglose origen
   (presupuestos / adicionales / órdenes de cambio), link a vista detalle.

### 6.2 Detalle de presupuesto (/presupuestos/:pid)
Tabla agrupada por rubro con subtotales, edición inline, columnas:
código tarea, descripción, recurso (`BadgeEstado` por tipo), unidad, cantidad,
precio unit., subtotal, incluye/excluye (icono ℹ con popover). Pie: total y
total por tipo_recurso (MO vs MATERIAL — los usuarios deciden con esa apertura).
Cabecera: editar metadatos, importar Excel, descartar.

### 6.3 Comparador (/presupuestos/comparar?ids=…) — LA PANTALLA ESTRELLA
Estructura de datos del endpoint y de la UI:
```
filas = rubros de la obra (orden del cómputo)
columnas = [REFERENCIA?] + propuestas seleccionadas
celda = { subtotal, items_count, no_cotizado?, parcial? } donde
  parcial = true si la propuesta cotiza menos tareas del rubro que la que más cotiza
```
- Celda **no cotizada**: fondo gris rayado + texto "No cotiza" (el hueco de
  alcance, hallazgo central del proyecto, debe GRITAR visualmente).
- Celda **parcial**: borde ámbar + tooltip "Cotiza 3 de 5 tareas del rubro".
- Mejor precio por fila (entre cotizaciones completas): borde verde.
- Columna REFERENCIA con fondo diferenciado y desvío % de cada propuesta vs
  referencia en cada celda (pequeño, color ok/peligro).
- Fila inferior fija: **Total comparable** (suma solo de rubros que TODAS las
  columnas cotizan completo) + **Total nominal** de cada una, con leyenda
  explicativa: "El total nominal engaña si los alcances difieren".
- Acción por fila: botón "Adoptar" en la celda elegida → ModalConfirmar con
  impacto ("Adoptás HORMIGÓN de NITO por $2.250.000"). Fila adoptada queda con
  fondo verde suave y candado (re-adoptar pide confirmación de reemplazo).
- Botón global "Adoptar todo lo marcado en verde" (mejor precio completo por
  rubro) con resumen previo.
- Click en celda → drawer lateral con los ítems de ese rubro en esa propuesta,
  comparados tarea por tarea contra las otras columnas cuando hay match por
  CODIGO_TAREA.
- Mobile: el comparador rota a "rubro por rubro" (cards apiladas por rubro con
  las propuestas como filas).

### 6.4 Presupuesto adoptado (/presupuestos/adoptado)
Tabla por rubro con columna **Origen** (proveedor + link a propuesta origen, o
"OC #3", o "Adicional"). Cabecera con la línea de los 3 momentos:
`Referencia $X → Mejor propuesta $Y → Adoptado $Z` con deltas % coloreados.

## 7. Reglas de negocio
- **R1.** Máx. 1 REFERENCIA no descartada y exactamente 0 o 1 ADOPTADO por
  obra. El ADOPTADO se crea automáticamente (sistema) en la primera adopción.
- **R2.** El ADOPTADO no se edita a mano: solo recibe ítems por (a) adopción de
  rubro, (b) ítem suelto marcado "Adicional" (formulario directo con
  origen=MANUAL), (c) OC aprobada (escribe M4, origen=ORDEN_CAMBIO). UI lo
  explica en estado vacío.
- **R3.** % cobertura de una propuesta = rubros con ≥1 ítem ÷ rubros del cómputo
  con ≥1 tarea. Recalcular on-read, no persistir.
- **R4.** Comparar exige misma moneda; si difieren → aviso bloqueante
  "Convertí las propuestas a una misma moneda para comparar" (conversión
  automática es F9, fuera del MVP).
- **R5.** Adoptar un rubro: copia profunda de los ítems (snapshot) al ADOPTADO
  con `origen=ADOPCION` y `origen_item_id`; cambios posteriores en la propuesta
  NO alteran el adoptado. Registra `adopcion` y evento
  `presupuesto.adoptado_rubro` (resumen_humano con proveedor y monto).
- **R6.** Re-adoptar un rubro ya adoptado: soft-delete de los ítems previos del
  ADOPTADO de ese rubro (quedan en historial) + nueva copia; la `adopcion`
  anterior conserva su registro.
- **R7.** Una PROPUESTA con al menos un rubro adoptado pasa a estado
  ADOPTADO_PARCIAL (o ADOPTADO_TOTAL si todos); no puede descartarse.
- **R8.** Privacidad: CONSTRUCTOR/PROVEEDOR solo ven y editan presupuestos
  donde `contratista_miembro_id` = su membresía; jamás reciben en payload la
  REFERENCIA, otras propuestas ni el comparador (403). Test obligatorio.
- **R9.** `fecha_precio` es obligatoria al crear; badge de antigüedad >60 días
  en todas las vistas (hook F9).
- **R10.** Totales siempre calculados server-side; UI no suma.

## 8. Criterios de aceptación
- [ ] Con la obra demo: comparar las 2 propuestas desiguales → el comparador
  muestra el hueco "No cotiza IG00" y el total comparable ≠ total nominal.
- [ ] Adoptar 2 rubros de una propuesta y 1 de otra → adoptado consolidado
  correcto con orígenes trazables.
- [ ] Re-adoptar un rubro y verificar historial conservado.
- [ ] Importar propuesta por Excel con 1 rubro inexistente → flujo de corrección.
- [ ] Login como constructor demo: no ve referencia ni comparador (UI y API).
- [ ] Export del comparador abre en Excel con los mismos números.
- [ ] Tests de R1–R10.
