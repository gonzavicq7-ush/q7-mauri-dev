# 04 — M3: CAJA DE OBRA (COMPROMISOS, PAGOS Y DESVÍO)

**Agente:** A3 · **Depende de:** M0, M1 (imputación a rubro/tarea). Lee de M2 el
total adoptado por rubro (solo lectura) para calcular desvío; si no hay
ADOPTADO, usa REFERENCIA; si no hay ninguno, muestra solo ejecutado sin semáforo.
**Consumido por:** M6 (totales y alertas de desvío).

## 1. Objetivo
Responder en todo momento, por rubro y total: **previsto / comprometido /
pagado / proyección final**, con semáforo. El insight rector: registrar solo
pagos llega tarde; el compromiso (lo acordado/encargado) es el dato que anticipa.

## 2. Dentro / fuera
**Dentro:** registro de COMPROMISO y PAGO, pago que salda compromiso (total o
parcial), foto/PDF de comprobante, filtros, anulación con motivo, vista por
rubro con semáforo, detección y evento de desvío, carga rápida mobile.
**Fuera:** conciliación bancaria, cheques/vencimientos, retenciones e impuestos,
cuenta corriente por proveedor (v2), conversión de moneda (F9).

## 3. Entidades propias
`movimiento`, `indice` (doc 00 §5.4). `indice` solo con ABM mínimo de ADMIN en
una pantalla simple de configuración (sin uso en cálculos aún — hook F9).

## 4. Endpoints
```
GET  /api/v1/obras/:obraId/movimientos        ?tipo&rubroId&desde&hasta&proveedor&pagina
POST /api/v1/obras/:obraId/movimientos        {tipo,rubro_obra_id,tarea_id?,fecha,
     proveedor_nombre|contratista_miembro_id,descripcion,moneda,importe,
     compromiso_id?,medio_pago?,comprobante (multipart)?}
PATCH /api/v1/obras/:obraId/movimientos/:id   (solo descripcion, fecha, comprobante)
POST  /api/v1/obras/:obraId/movimientos/:id/anular  {motivo} → estado ANULADO
GET  /api/v1/obras/:obraId/caja/resumen       → §6.1 (cabecera global y por rubro)
GET  /api/v1/obras/:obraId/caja/exportar      ?filtros → xlsx
GET/POST/PATCH /api/v1/obras/:obraId/indices  (ADMIN, ABM simple)
```

### Definiciones de cálculo (server-side, único lugar: `caja/calculos.ts`)
```
previsto(rubro)     = Σ subtotales ADOPTADO del rubro (fallback REFERENCIA)
comprometido(rubro) = Σ COMPROMISO vigentes − Σ pagos aplicados a esos compromisos
                      (un compromiso saldado deja de sumar como comprometido)
pagado(rubro)       = Σ PAGO vigentes
ejecutado           = comprometido + pagado
proyeccion(rubro)   = max(previsto, ejecutado)   -- MVP simple y honesto
desvio_pct          = (ejecutado − previsto) / previsto
semaforo            = verde ≤ 90% · ámbar 90–100% · rojo > 100% (componente común)
```

## 5. Pantallas
1. **/obras/:id/caja** — cabecera con 4 cifras grandes (`Dinero`): Previsto ·
   Comprometido · Pagado · Proyección final, más `Semaforo` global y barra
   apilada (pagado/comprometido/restante sobre previsto). Debajo, dos pestañas:
   - **Por rubro:** tabla rubro | previsto | comprometido | pagado | desvío % |
     semáforo. Click → drawer con movimientos del rubro y mini-resumen.
   - **Movimientos:** tabla cronológica con filtros, badge COMPROMISO/PAGO,
     miniatura de comprobante (click → visor), acción anular (ModalConfirmar
     con motivo obligatorio). Compromisos muestran barra de saldado
     ("$300.000 de $500.000 pagados").
2. **Botón flotante "+ Registrar"** (siempre visible en el módulo) → formulario
   en drawer, **optimizado mobile** (es la carga que se hace desde la obra o el
   corralón): tipo (toggle grande Compromiso/Pago), rubro (`SelectorRubro`),
   tarea opcional, importe con teclado numérico, proveedor con autocompletar de
   históricos de la obra, foto desde cámara. Si tipo=PAGO: selector opcional
   "¿Salda un compromiso?" listando compromisos abiertos del rubro con saldo.
3. **Configuración → Índices** (solo ADMIN): tabla editable fecha/tipo/valor.

## 6. Reglas de negocio
- **R1.** Importe > 0 siempre; moneda por defecto = moneda_base; si difiere,
  advertencia "no se sumará en los totales hasta convertirla (próximamente)" y
  el movimiento queda excluido de cálculos con badge gris (hook F9).
- **R2.** Un PAGO con `compromiso_id` no puede exceder el saldo del compromiso
  (`PAGO_EXCEDE_COMPROMISO`); pagos parciales múltiples permitidos.
- **R3.** Anular un compromiso con pagos aplicados exige anular antes los pagos
  (o desvincularlos), con mensaje guiado.
- **R4.** Movimientos no se editan en importe/rubro/tipo: se anulan y recrean
  (la UI ofrece "Anular y duplicar para corregir"). Garantiza trazabilidad.
- **R5.** Al cruzar umbral de semáforo de un rubro (verde→ámbar o →rojo) tras
  persistir un movimiento, emitir `caja.desvio_detectado` (payload: rubro,
  previsto, ejecutado, desvío %; resumen_humano: "HORMIGÓN superó el previsto:
  $2.480.000 sobre $2.250.000"). Emitir una sola vez por cruce (no repetir
  mientras siga en el mismo color).
- **R6.** Eventos: `caja.compromiso_registrado`, `caja.pago_registrado` (con
  resumen_humano incluyendo proveedor y rubro), `caja.desvio_detectado`.
- **R7.** Permisos: CONSTRUCTOR ve solo movimientos con su
  `contratista_miembro_id` (su cuenta de cobros), sin totales de obra (la
  cabecera para él muestra solo "Cobrado / Comprometido a tu favor").
- **R8.** Comprobantes: jpg/png/pdf ≤10MB, almacenados en `storage/` local con
  URL firmada simple (abstraer en `packages/shared/archivos.ts` para
  reemplazar por S3 luego).

## 7. Criterios de aceptación
- [ ] Demo: registrar compromiso $500.000 en HA00, pagarlo en 2 pagos parciales
  → comprometido y pagado evolucionan correctamente y el compromiso queda saldado.
- [ ] Forzar un rubro a rojo → evento emitido una única vez y visible en campana.
- [ ] Sin ADOPTADO ni REFERENCIA: la pantalla degrada elegante (sin semáforo,
  banner "Cargá un presupuesto para medir desvíos" con link a M2).
- [ ] Carga de pago con foto desde viewport mobile (375px) en ≤5 interacciones.
- [ ] Login constructor: solo ve lo suyo (UI y API).
- [ ] Tests de R1–R7 y de cada fórmula de cálculo.
