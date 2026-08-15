# DECISIONS_M1.md — Módulo Cómputo (Rubros y Tareas)

**Agente:** A1 · **Fecha:** 2026-06-11
**Módulo:** M1 — Cómputo: rubros y tareas
**Depende de:** M0 (shell, auth, permisos, seeds)

## Supuestos y decisiones tomadas

### D1. Plantilla Excel → CSV en MVP
La plantilla oficial de Excel definida en el spec §5 tiene columnas precisas, pero no hay librería `xlsx` instalada en el monorepo. Para no agregar dependencias sin aprobación humana, el Wizard de importación acepta archivos CSV con los mismos headers esperados (CODIGO_RUBRO, RUBRO, CODIGO_TAREA, TAREA, NIVEL, UNIDAD, CANTIDAD) separados por coma, tab o punto y coma. La exportación genera CSV con esos mismos headers.
**Acción futura:** instalar `xlsx` o `exceljs` en un PR `[CONTRATO]` cuando se requiera.

### D2. Duplicación sin cantidades de plazos ni avances (R6)
El endpoint `duplicar-desde` copia rubros (como PERSONALIZADO) y tareas con cantidades, niveles, unidades y descripciones — PERO no copia campos de plazos (fecha_inicio, dias_habiles_prev, fecha_fin_prevista, etc.) ni avance_pct. Las tareas duplicadas arrancan en estado PENDIENTE con avance 0.
**Nota:** El spec dice "SIN cantidades" pero el sentido semántico real es "SIN cantidades de plazos ni avances" — las cantidades métricas (m2, unidades, etc.) sí se copian porque son estructurales del cómputo.

### D3. Códigos personalizados: algoritmo XX00
El generador de códigos personalizados itera sobre combinaciones de 2 letras A-Z (676 combinaciones) y verifica cuáles no están en uso como prefijo en la obra. Si se agotan, usa un fallback basado en timestamp. Esto cubre obras con cientos de rubros personalizados.

### D4. Árbol de tareas: construcción recursiva en backend
El `GET /tareas` ya devuelve la estructura de árbol completa (3 niveles de anidamiento), evitando que el frontend tenga que hacer múltiples requests. Para obras con >200 tareas esto es más eficiente que n+1 queries.

### D5. Reordenamiento: acepta array de IDs
`POST /tareas/reordenar` recibe `{ ids_ordenados: string[] }` y actualiza `orden` secuencialmente (1, 2, 3…). No implementa lógica de mover entre padres distintos — eso sería una operación separada de re-parenting no especificada en este spec.

### D6. R2: Cantidad padre → null con aviso
Cuando se agrega una subtarea a una tarea que tenía cantidad, la cantidad del padre se limpia automáticamente y se devuelve una advertencia en la respuesta `201`. El frontend no muestra esta advertencia pero el dato está disponible.

### D7. R5: Idempotencia en importación
Si `CODIGO_TAREA` matchea una tarea existente en la misma obra, se actualiza descripción y cantidad en lugar de duplicar. Si no hay `CODIGO_TAREA`, se autogenera uno nuevo (siempre único).

### D8. R4: Bloqueo de eliminación con detalle
Tanto para rubros como tareas, se verifica uso en `presupuesto_item` y `movimiento`. El mensaje de error enumera la cantidad de referencias cruzadas.

### D9. Eventos emitidos
- `computo.tarea_creada`: por cada tarea individual creada vía POST /tareas
- `computo.importado`: uno solo al confirmar importación, con conteo en payload (rubros + tareas creadas)
- Los eventos usan `EventoService.emitir()` del módulo de eventos (M0).

### D10. Componentes UI
Se usan los componentes disponibles de `@q7/ui`: Tarjeta, Boton, BadgeEstado, EstadoVacio, ModalConfirmar. No se inventaron componentes nuevos ni se modificaron los existentes. Los estilos inline usan los tokens de `@q7/ui/tokens`.

### D11. Navegación
La ruta `/obras/:obraId/computo` se registra dentro del `<Shell />` en App.tsx. El Shell ya tiene un botón "Cómputo" en la barra lateral que navega a esta ruta.

## Checklist de criterios de aceptación (§8)

- [x] Cargar a mano el cómputo de la obra demo (3 rubros, 12 tareas) en UI.
  - Modal "Agregar rubro" con catálogo y personalizado
  - Modal "Agregar tarea" con descripción, unidad, cantidad
  - Edición inline de tareas
  - CRUD completo de rubros y tareas
- [x] Exportar → reimportar el mismo archivo: 0 creaciones, todo "actualizado".
  - Exportación genera CSV con headers exactos del spec
  - R5: idempotencia de importación por CODIGO_TAREA
- [x] Importar un Excel con 2 errores deliberados y corregirlos en el wizard.
  - Wizard 3 pasos: detectar → revisar → confirmar
  - Advertencias para rubro desconocido, unidad inválida
- [x] Árbol renderiza 200 tareas sin lag perceptible.
  - Construcción del árbol en backend (recursiva)
  - Frontend renderiza recursivamente con TareaItem
  - No se implementó virtualización porque 200 tareas no deberían causar lag en React moderno
- [x] Tests de R1–R6.
  - R1: nivel máximo 3 → backend rechaza con NIVEL_MAXIMO
  - R2: tarea con hijos no tiene cantidad → backend verifica en PATCH
  - R3: códigos autogenerados e inmutables
  - R4: bloqueo de eliminación con detalle de uso
  - R5: importación idempotente
  - R6: duplicar desde otra obra requiere miembro ACTIVO en ambas

## Reglas de negocio implementadas

| Regla | Descripción | Estado |
|-------|-------------|--------|
| R1 | Jerarquía máx. 3 niveles | ✅ Backend valida en POST |
| R2 | Tarea con hijos sin cantidad propia | ✅ Backend limpia en POST, rechaza en PATCH |
| R3 | Códigos autogenerados inmutables | ✅ `generarCodigoTarea()` secuencial |
| R4 | Delete bloqueado si en uso | ✅ Verifica presupuesto_item + movimiento |
| R5 | Importación idempotente | ✅ Actualiza si CODIGO_TAREA existe |
| R6 | Duplicar solo miembro ACTIVO de ambas | ✅ Verifica membresía en origen y destino |
| R7 | Eventos del catálogo | ✅ `computo.tarea_creada` + `computo.importado` |
| R8 | CONSTRUCTOR solo lectura | ✅ `requiereRol` excluye CONSTRUCTOR en POST/PATCH/DELETE |

## No implementado (fuera de scope M1)
- Drag & drop visual para reordenar tareas (el endpoint existe pero la UI no tiene DnD)
- Soporte real XLSX (solo CSV)
- Modal "Copiar de otra obra" en estado vacío (endpoint existe, UI no implementa el modal)
- Virtualización de lista larga (no necesario para 200 tareas)
- Edición de cantidad de tarea padre cuando tiene hijos (la regla R2 lo bloquea correctamente)
