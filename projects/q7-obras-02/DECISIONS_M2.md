# DECISIONS_M2.md — M2: Presupuestos y Comparador

## Supuestos y decisiones tomadas

### 1. Endpoints adicionales más allá del spec
- **POST /api/v1/obras/:obraId/adopciones/masivas**: Permite adoptar múltiples rubros en una sola llamada para la funcionalidad "Adoptar todo lo marcado en verde" del comparador.
- **GET /api/v1/obras/:obraId/adoptado**: Retorna el presupuesto ADOPTADO con su breakdown por rubro, items, adopciones y totales. Necesario para la pantalla de adoptado.
- **GET /api/v1/obras/:obraId/presupuestos/:id/items/:rubroId**: Devuelve los items de un rubro específico dentro de un presupuesto. Usado por el drawer del Comparador para mostrar items tarea por tarea.

### 2. Cálculo de % cobertura (R3)
- Se calcula como: (rubros con ≥1 item en la propuesta) / (rubros de la obra con ≥1 tarea de nivel 3) × 100
- Recalculado on-read en el listado de presupuestos (no persistido).

### 3. Cálculo del comparador
- Servicio dedicado `apps/api/src/services/presupuestos/comparador.ts`
- **parcial**: una celda es parcial si cotizó menos items que el máximo observado entre todas las propuestas para ese rubro.
- **mejor_precio**: solo entre columnas de tipo PROPUESTA que NO son parciales (cotización completa).
- **no_cotizado**: rubro sin ningún item en ese presupuesto. Se muestra con fondo gris rayado.
- **total_comparable**: suma solo de rubros donde TODAS las columnas (incluyendo referencia) cotizaron completo (sin parcial/empty). Si una columna no cotiza o es parcial, ese rubro no entra en su total comparable.
- **total_nominal**: suma todo lo que cada columna cotizó, incluyendo parciales.

### 4. Adopción (R5, R6)
- Servicio dedicado `apps/api/src/services/presupuestos/adopcion.ts`
- Deep copy con `origenItemId` para trazabilidad.
- Re-adoptar soft-deletea ítems previos (`eliminado_en = now()`) y crea nuevos.
- La adopción se registra en tabla `adopcion` y se conserva.
- R7 implementado: propuesta con ≥1 adopción pasa a ADOPTADO_PARCIAL, si todos sus rubros fueron adoptados pasa a ADOPTADO_TOTAL.

### 5. Privacidad (R8)
- CONSTRUCTOR/PROVEEDOR solo ve presupuestos donde `contratistaMiembroId = su membresía`.
- Jamás reciben la REFERENCIA ni otras propuestas (filtro en el where del GET list).
- El comparador requiere rol ADMIN_OBRA, COMITENTE o PROFESIONAL (CONSTRUCTOR/PROVEEDOR no tiene acceso).

### 6. Importación Excel
- Reutiliza el mismo formato de M1: CSV con headers CODIGO_RUBRO, CODIGO_TAREA, DESCRIPCION, TIPO_RECURSO, UNIDAD, CANTIDAD, PRECIO_UNITARIO, INCLUYE, EXCLUYE.
- Dos pasos: POST importar (detecta filas) → POST importar/confirmar (persiste).
- Si CODIGO_TAREA no existe, el item se vincula solo al rubro con advertencia.

### 7. UI / UX
- PresupuestosPage: 3 secciones (Referencia, Propuestas, Adoptado) con tarjetas y CTA.
- ComparadorPage: tabla con columnas=propuestas, filas=rubros. Celda no_cotizada con fondo gris rayado (`repeating-linear-gradient`), celda parcial con borde ámbar, mejor precio con borde verde. Drawer lateral para items detallados. ModalConfirmar para adopción.
- AdoptadoPage: tabla por rubro con columna Origen (link a propuesta). Línea de los 3 momentos (Referencia → Adoptado con delta %).
- Mobile: responsive con overflow-x auto en tablas.

### 8. Eventos emitidos
- `presupuesto.creado` — al crear cualquier presupuesto
- `presupuesto.item_agregado` — al agregar item manualmente
- `presupuesto.adoptado_rubro` — al adoptar (simple o masivo)

### 9. Limitaciones y hooks documentados
- **F9 (indexación a moneda constante):** `fecha_precio` se captura y badge de antigüedad >60 días se muestra, pero no hay conversión automática.
- **F10 (mapeo IA):** No implementado. En un futuro: `POST /propuestas/:id/mapeo-asistido` con 501.
- **F11 (escenarios de ingeniería de valor):** No implementado.
- **Exportar Excel:** El endpoint /comparador/exportar devuelve estructura; la descarga efectiva (.xlsx vs .csv) queda para iteración futura.

### 10. Tests pendientes
- R1: máx 1 REFERENCIA y 1 ADOPTADO por obra
- R2: ADOPTADO no recibe items manuales
- R3: % cobertura correcto
- R4: monedas diferentes → error 400
- R5: adopción = deep copy con origenItemId
- R6: re-adoptar soft-deletea y crea nuevos
- R7: estado ADOPTADO_PARCIAL/ADOPTADO_TOTAL correcto
- R8: CONSTRUCTOR no ve referencia ni otras propuestas
- R9: fecha_precio obligatoria, badge >60 días
- R10: totales calculados server-side
