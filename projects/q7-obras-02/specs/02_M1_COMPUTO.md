# 02 — M1: CÓMPUTO (RUBROS Y TAREAS)

**Agente:** A1 · **Depende de:** M0 (shell, permisos, seeds)
**Consumido por:** M2 (ítems de presupuesto referencian tareas/rubros),
M3 (movimientos imputan a rubro/tarea), M5 (plazos viven en `tarea`).

## 1. Objetivo
Que cualquier usuario arme el esqueleto de su obra (rubros → tareas, hasta 3
niveles) en menos de 10 minutos, a mano o importando un Excel. El cómputo es la
columna vertebral: todo lo demás (presupuestos, caja, plazos) cuelga de él.

## 2. Dentro / fuera
**Dentro:** alta de rubros desde catálogo o personalizados, CRUD de tareas con
jerarquía (nivel 1 a 3), reordenado drag & drop, cantidades y unidades,
importación de Excel con plantilla oficial + asistente de mapeo, exportación a
Excel, duplicar cómputo desde otra obra propia.
**Fuera:** cómputo métrico automático desde planos, fórmulas entre tareas,
versiones del cómputo (el histórico vive en presupuestos).

## 3. Entidades propias
`rubro_catalogo` (solo lectura, seed), `rubro_obra`, `tarea` (doc 00 §5.2).
**Atención:** los campos de plazos de `tarea` existen en el schema pero este
módulo NO los muestra ni edita (los maneja M5). En formularios de M1 se ignoran.

## 4. Endpoints
```
GET  /api/v1/catalogo/rubros                          (público autenticado)
GET  /api/v1/obras/:obraId/rubros                     → con totales de tareas
POST /api/v1/obras/:obraId/rubros                     {codigo? | nombre} 
     -- si viene codigo: copia del catálogo; si viene nombre: PERSONALIZADO
     -- código personalizado autogenerado: XX00 con iniciales libres no usadas
PATCH/DELETE /api/v1/obras/:obraId/rubros/:id         (DELETE=soft, solo si sin
     tareas con datos vinculados; si hay, error RUBRO_EN_USO)
GET  /api/v1/obras/:obraId/tareas                     ?rubroId → árbol ordenado
POST /api/v1/obras/:obraId/tareas                     {rubro_obra_id,padre_id?,
     descripcion,unidad,cantidad?} → código autogenerado (prefijo rubro + NN)
PATCH/DELETE /api/v1/obras/:obraId/tareas/:id         (DELETE=soft; si tiene
     ítems de presupuesto o movimientos → error TAREA_EN_USO con detalle)
POST /api/v1/obras/:obraId/tareas/reordenar           {ids_ordenados[]}
POST /api/v1/obras/:obraId/computo/importar           multipart xlsx →
     {filas_detectadas[], mapeo_sugerido} (paso 1, no persiste)
POST /api/v1/obras/:obraId/computo/importar/confirmar {filas_mapeadas[]} →
     {creadas, advertencias[]}
GET  /api/v1/obras/:obraId/computo/exportar           → xlsx plantilla oficial
POST /api/v1/obras/:obraId/computo/duplicar-desde     {obra_origen_id}
```

## 5. Plantilla Excel oficial (definir en `packages/shared/plantillas/computo.ts`)
Columnas exactas, fila 1 = encabezados:
`CODIGO_RUBRO | RUBRO | CODIGO_TAREA | TAREA | NIVEL | UNIDAD | CANTIDAD`
- Importador tolerante: si CODIGO_RUBRO no matchea catálogo ni rubros de la
  obra, sugiere el más parecido (distancia de Levenshtein sobre nombre) y deja
  elegir "crear personalizado". Unidades no reconocidas → sugerir del enum.
- La exportación de M1 produce exactamente esta plantilla (ida y vuelta sin
  pérdida). **M2 reutiliza este mismo parser**, no implementa otro.

## 6. Pantallas
1. **/obras/:id/computo** — layout dos paneles: izquierda lista de rubros
   (orden, contador de tareas, total cantidad), derecha árbol de tareas del
   rubro seleccionado con indentación por nivel, edición inline de
   descripción/unidad/cantidad, drag & drop para reordenar, menú fila
   (agregar subtarea, eliminar). Cabecera con resumen (doc 00 §7.4) y botones
   `Importar Excel · Exportar · Agregar rubro`. Mobile: paneles apilados con
   navegación rubro→tareas.
2. **Modal "Agregar rubro"** — dos pestañas: "Del catálogo" (lista de los 24 con
   checkbox múltiple, los ya agregados deshabilitados) y "Personalizado" (nombre).
3. **Wizard de importación (3 pasos)** — (1) subir archivo + link "descargar
   plantilla"; (2) vista previa con mapeo: tabla de filas detectadas,
   advertencias en ámbar (rubro desconocido, unidad inválida, cantidad no
   numérica) con corrección inline; (3) confirmación con resumen
   ("Se crearán 4 rubros y 38 tareas") y resultado.
4. **Estado vacío** del cómputo — CTA triple: "Empezar del catálogo" /
   "Importar Excel" / "Copiar de otra obra".

## 7. Reglas de negocio
- **R1.** Jerarquía máx. 3 niveles; intentar crear nivel 4 → `NIVEL_MAXIMO`.
- **R2.** Una tarea con hijos no admite cantidad propia (la cantidad vive en
  las hojas); al agregarle un hijo, su cantidad se limpia con aviso.
- **R3.** Códigos de tarea autogenerados `PREFIJO+NN` secuenciales por rubro
  (HA01, HA02…), inmutables, nunca se reutilizan tras soft-delete.
- **R4.** Eliminar rubro/tarea referenciada por M2/M3 está bloqueado con
  mensaje que enumera qué la usa ("3 ítems de la propuesta de NITO").
- **R5.** Importación idempotente dentro de la misma obra: si CODIGO_TAREA ya
  existe, actualiza descripción/cantidad en vez de duplicar (advertencia).
- **R6.** Duplicar desde otra obra requiere ser miembro ACTIVO de ambas; copia
  rubros y tareas SIN cantidades de plazos ni avances.
- **R7.** Eventos: `computo.tarea_creada` (una por lote con conteo en payload
  si es importación), `computo.importado`.
- **R8.** Permisos según matriz: CONSTRUCTOR solo lectura aquí.

## 8. Criterios de aceptación
- [ ] Cargar a mano el cómputo de la obra demo (3 rubros, 12 tareas) en UI.
- [ ] Exportar → reimportar el mismo archivo: 0 creaciones, todo "actualizado".
- [ ] Importar un Excel con 2 errores deliberados y corregirlos en el wizard.
- [ ] Árbol renderiza 200 tareas sin lag perceptible (virtualizar si hace falta).
- [ ] Tests de R1–R6.
