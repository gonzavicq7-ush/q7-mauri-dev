# 08 — ORQUESTACIÓN DE AGENTES Y PLAN DE EJECUCIÓN

Cómo ejecutar los 7 specs con agentes Claude (Claude Code) en paralelo sin que
se pisen, y cómo verificar la integración final.

## 1. Principio rector
**El paralelismo funciona porque los contratos están congelados antes de
empezar:** schema completo, eventos, rutas, tokens y componentes viven en el
doc 00 y los crea A0. Los agentes A1–A5 nunca migran la base ni tocan
`packages/ui` ni `packages/shared` — si necesitan un cambio, lo piden con un
PR etiquetado `[CONTRATO]` que aprueba un humano (vos) y se comunica a todos.

## 2. Secuencia

```
Fase 0 (secuencial, bloqueante) ─ A0 → M0 + scaffold + schema TOTAL + ui + seeds
Fase 1 (paralelo) ─ A1 (M1 Cómputo) · A3 (M3 Caja) · A5 (M5 Plazos)
Fase 2 (paralelo) ─ A2 (M2 Presupuestos) · A4 (M4 Órdenes de cambio)
Fase 3 (secuencial) ─ A6 (M6 Tablero/Reporte) + pasada de integración
```
Justificación: M2 lee el cómputo (mejor con M1 real), M4 escribe en M2 y M5.
Si querés máximo paralelismo, A2 y A4 pueden arrancar en Fase 1 desarrollando
contra la obra demo sembrada por A0 (el seed ya incluye cómputo y presupuestos),
y solo dejan para el final los puntos de contacto. Riesgo bajo, lo permite el
seed; decidilo según cuántas sesiones corras a la vez.

## 3. Reglas de trabajo por agente
1. Rama por módulo: `feat/m1-computo`, etc. PRs chicos contra `main`.
2. Cada agente arranca leyendo, en este orden: `00_ARQUITECTURA_COMUN.md` →
   su spec → el seed (`packages/db/seed/demo.ts`).
3. Prohibido: crear tablas/campos, tipos de evento nuevos, colores fuera de
   tokens, layouts propios, otro parser de Excel, lógica de permisos propia.
4. Obligatorio: `DECISIONES.md` por módulo, eventos del catálogo, criterios de
   aceptación tildados en el PR, tests verdes.
5. Conflictos esperables y su dueño: `tarea` (tabla de M1; campos de plazos los
   edita solo M5), `presupuesto ADOPTADO` (M2 dueño; M4 escribe vía la función
   `adoptarItemsDesdeOC()` que EXPONE M2 en `packages/db` — A2 la entrega como
   parte de su módulo y A4 la consume, nunca inserta directo).

## 4. Prompt plantilla para cada agente
```
Sos el agente <An> del proyecto ObraClara. Tu único objetivo es entregar el
módulo <Mn> completo y funcional según su especificación, en la rama <rama>.

Pasos obligatorios:
1. Leé /specs/00_ARQUITECTURA_COMUN.md COMPLETO. Es de cumplimiento estricto.
2. Leé /specs/<tu spec>. Implementá TODO lo que dice y NADA fuera de alcance.
3. Explorá el scaffold existente (apps/, packages/) y la obra demo del seed.
4. Implementá backend primero (endpoints + reglas R# con tests), después UI.
5. No modifiques packages/db (schema), packages/ui ni packages/shared. Si algo
   te bloquea, escribí el cambio propuesto en CONTRATO_PENDIENTE.md y avanzá
   con un workaround local mínimo.
6. Antes de terminar: corré pnpm lint, pnpm test, pnpm build; verificá cada
   criterio de aceptación de tu spec contra la obra demo y dejá el checklist
   tildado en DECISIONES.md junto a todo supuesto que tomaste.
Definición de terminado: sección 10 del doc 00.
```

## 5. Pasada de integración (la hacés con un agente integrador al final)
Checklist E2E sobre la obra demo, en este orden (cruza todos los módulos):
1. Registro → crear obra → invitar 4 roles → aceptar.
2. Importar cómputo Excel (plantilla) → 3 rubros, 12 tareas.
3. Crear REFERENCIA → cargar 2 PROPUESTAS (una por importación, una a mano,
   con hueco de alcance deliberado).
4. Comparador: el hueco se ve, total comparable ≠ nominal, adoptar mixto.
5. Caja: compromiso + 2 pagos parciales + forzar rubro a rojo → evento en
   campana y en tablero.
6. Plazos: cargar fechas, registrar avance con foto.
7. OC del constructor → aprobación del comitente → verificar ítems en
   ADOPTADO + días en plazos + actividad en feed.
8. Generar reporte semanal → vista web + emails logueados por rol.
9. Recorrer la app entera logueado como CONSTRUCTOR y como PROVEEDOR
   verificando recortes (lo que NO deben ver).
10. `pnpm build` limpio, lighthouse mobile del tablero > 80 performance.

## 6. Después del MVP (no abrir hasta cerrar lo anterior)
F9 conversión/indexación (los datos ya se capturan) → F10 mapeo IA de
presupuestos (hook 501 ya existe) → F11 escenarios de ingeniería de valor →
F12 biblioteca de precios → portafolio multi-obra → WhatsApp.
