# 00 — ARQUITECTURA COMÚN (DOCUMENTO MAESTRO)

> **Este documento es de cumplimiento OBLIGATORIO para todos los agentes.**
> Ningún módulo puede crear tablas, rutas, colores, componentes o convenciones
> que no estén definidos aquí o en su propio spec. Ante una duda no resuelta por
> este documento, el agente debe elegir la opción más simple y documentarla en
> `DECISIONES.md` de su módulo — nunca inventar una entidad nueva.

## 1. Producto

**Nombre de trabajo:** `ObraClara` (placeholder, configurable en `branding.ts`).
**Tesis:** el sistema operativo financiero de una obra, para comitentes que
autogestionan, pymes constructoras y estudios de arquitectura que invitan a sus
clientes. Compite contra el cuaderno, WhatsApp y tres planillas de Excel.
**Pregunta que el producto responde siempre, en toda pantalla:**
*"¿Cuánto me va a terminar saliendo y cuánta plata me falta poner?"*

## 2. Alcance del MVP

| Módulo | Código | Spec | Agente |
|---|---|---|---|
| Shell, auth, obras y equipo (roles) | M0 | 01 | A0 (primero, bloqueante) |
| Cómputo: rubros y tareas | M1 | 02 | A1 |
| Presupuestos y comparador (3 momentos) | M2 | 03 | A2 |
| Caja de obra (compromisos y pagos) | M3 | 04 | A3 |
| Órdenes de cambio | M4 | 05 | A4 |
| Plazos y avance | M5 | 06 | A5 |
| Tablero + reporte semanal | M6 | 07 | A6 (último, integrador) |

Fuera del MVP (no construir, no modelar UI): contabilidad fiscal, stock,
certificaciones de obra pública, BIM/takeoff, chat interno, app nativa,
biblioteca de precios de mercado, asistente IA de mapeo (hook documentado en 03).

## 3. Stack y estructura del repositorio (por defecto, reemplazable)

- **Monorepo** con `pnpm workspaces`.
- `apps/web` — React 18 + TypeScript + Vite + React Router. Estado de servidor
  con TanStack Query. Formularios con react-hook-form + zod.
- `apps/api` — Node + TypeScript + Fastify. Validación zod en cada endpoint.
- `packages/db` — Prisma + PostgreSQL. **El schema Prisma vive SOLO acá** y se
  corresponde 1:1 con la sección 5 de este documento. Ningún módulo agrega
  modelos por su cuenta.
- `packages/ui` — sistema de diseño compartido (sección 7). Componentes
  exportados; los módulos NO definen estilos globales propios.
- `packages/shared` — tipos TS compartidos, enums, helpers de moneda y fechas.
- Seeds: `packages/db/seed/` (sección 9).

Reglas de código comunes:
- Todo en español: nombres de entidades, campos, rutas, labels. Código interno
  (variables, funciones) puede ser inglés, pero los tipos de dominio usan los
  nombres de la sección 5.
- Fechas siempre ISO 8601 en API; en UI formato `dd/mm/aaaa`.
- Dinero: `Decimal(14,2)` en DB; en API string decimal `"1234.50"`; nunca float.
  Toda cifra de dinero viaja acompañada de `moneda` (ISO 4217: ARS, USD, PYG).
- IDs: UUID v4 en todas las tablas.
- Soft-delete universal: campo `eliminado_en` (timestamp nullable). **Nada se
  borra físicamente** — regla de oro del producto: todo dato histórico se
  conserva para comparar.

## 4. Roles y matriz de permisos

Roles por obra (un usuario puede tener roles distintos en obras distintas):

`ADMIN_OBRA` (quien crea la obra) · `COMITENTE` · `PROFESIONAL` ·
`CONSTRUCTOR` · `PROVEEDOR` (solo lectura de lo propio).

Matriz (C=crear, R=leer, U=editar, A=aprobar, ·=sin acceso):

| Recurso | ADMIN | COMITENTE | PROFESIONAL | CONSTRUCTOR | PROVEEDOR |
|---|---|---|---|---|---|
| Obra (datos) | CRU | R | RU | R | · |
| Miembros/invitaciones | CRU | R | R | R | · |
| Rubros y tareas | CRU | R | CRU | RU(avance) | · |
| Presupuesto REFERENCIA | CRU | R | CRU | · | · |
| Presupuesto PROPUESTA | CRU | R | CRU | CRU (solo las propias) | R (solo las propias) |
| Adopción de propuesta | A | A | propone | · | · |
| Caja: compromisos/pagos | CRU | CRU | CRU | R (solo lo que cobra) | · |
| Orden de cambio | CRU+A | R+A | CRU | CRU (propone) | · |
| Plazos y avance | CRU | R | CRU | RU(avance propio) | · |
| Tablero y reportes | R | R | R | R (recorte propio) | · |

**Regla de privacidad de costos (crítica):** un CONSTRUCTOR ve únicamente las
propuestas que él cargó y los pagos a su nombre. Nunca ve propuestas de otros
constructores ni el presupuesto de referencia del comitente. El backend filtra
SIEMPRE por rol; no alcanza con ocultar en UI.

## 5. Modelo de datos único (fuente de verdad)

Convención: snake_case, singular para el modelo conceptual. Todas las tablas
llevan `id uuid pk`, `creado_en`, `actualizado_en`, `eliminado_en?`.

### 5.1 Identidad y obra (dueño: M0)
```
usuario        : email unique, nombre, password_hash, avatar_url?
obra           : nombre, tipo enum[VIVIENDA,REFORMA,COMERCIO,CONDOMINIO,OTRO],
                 direccion?, pais char(2), moneda_base char(3),
                 superficie_m2 decimal?, presupuesto_objetivo decimal?,
                 estado enum[ACTIVA,PAUSADA,FINALIZADA], creador_id fk usuario
obra_miembro   : obra_id fk, usuario_id fk?, email_invitado?,
                 rol enum[ADMIN_OBRA,COMITENTE,PROFESIONAL,CONSTRUCTOR,PROVEEDOR],
                 estado enum[PENDIENTE,ACTIVO,REVOCADO], token_invitacion?
                 -- unique(obra_id, usuario_id, rol)
evento         : obra_id fk, usuario_id fk?, tipo varchar(60),
                 payload jsonb, fecha timestamptz
                 -- bitácora append-only; TODOS los módulos escriben acá (sección 6)
```

### 5.2 Cómputo (dueño: M1)
```
rubro_catalogo : codigo char(4) unique (TP00..JA00), nombre, orden int  -- seed global
rubro_obra     : obra_id fk, codigo char(4), nombre, orden int,
                 origen enum[CATALOGO,PERSONALIZADO]
                 -- unique(obra_id, codigo)
tarea          : obra_id fk, rubro_obra_id fk, padre_id fk tarea?,
                 codigo varchar(8) (ej HA01), descripcion, nivel int (1..3),
                 unidad enum[GL,M2,M3,ML,UN,KG,HS,DIA],
                 cantidad decimal?, orden int,
                 -- campos de plazos (dueño funcional: M5, dueño de tabla: M1):
                 fecha_inicio date?, dias_habiles_prev int?,
                 fecha_fin_prevista date? (calculada), dias_perdidos int default 0,
                 fecha_fin_nueva date? (calculada), fecha_fin_real date?,
                 avance_pct decimal(5,2) default 0,
                 estado enum[PENDIENTE,EN_CURSO,FINALIZADA,CANCELADA]
```

### 5.3 Presupuestos (dueño: M2)
```
presupuesto    : obra_id fk, tipo enum[REFERENCIA,PROPUESTA,ADOPTADO],
                 nombre, contratista_miembro_id fk obra_miembro?,
                 proveedor_nombre? (si no es miembro),
                 moneda char(3), fecha_precio date,
                 estado enum[BORRADOR,VIGENTE,ADOPTADO_PARCIAL,ADOPTADO_TOTAL,DESCARTADO],
                 observaciones?
                 -- restricción: máx 1 REFERENCIA vigente y máx 1 ADOPTADO por obra
presupuesto_item:presupuesto_id fk, rubro_obra_id fk, tarea_id fk?,
                 descripcion, tipo_recurso enum[MO,MATERIAL,EQUIPO,SUBCONTRATO,OTRO],
                 unidad enum (mismo set que tarea), cantidad decimal,
                 precio_unitario decimal(14,2),
                 subtotal decimal(14,2) (calculado = cantidad*precio_unitario),
                 incluye text?, excluye text?, no_cotizado bool default false,
                 origen enum[MANUAL,IMPORTACION,ADOPCION,ORDEN_CAMBIO],
                 origen_item_id fk presupuesto_item?  -- trazabilidad de adopción
adopcion       : obra_id fk, rubro_obra_id fk,
                 presupuesto_origen_id fk presupuesto,
                 decidido_por fk usuario, fecha timestamptz, nota?
                 -- registro de "qué propuesta gana cada rubro"
```

### 5.4 Caja de obra (dueño: M3)
```
movimiento     : obra_id fk, rubro_obra_id fk, tarea_id fk?,
                 tipo enum[COMPROMISO,PAGO],
                 compromiso_id fk movimiento? (un PAGO puede saldar un COMPROMISO),
                 fecha date, proveedor_nombre,
                 contratista_miembro_id fk obra_miembro?,
                 descripcion, moneda char(3), importe decimal(14,2),
                 comprobante_url?, medio_pago enum[EFECTIVO,TRANSFERENCIA,OTRO]?,
                 orden_cambio_id fk? (si nace de una OC),
                 estado enum[VIGENTE,ANULADO]
indice         : tipo enum[INFLACION_MENSUAL,TC_USD], fecha date, valor decimal(12,4)
                 -- seed manual editable por ADMIN; hook F9
```

### 5.5 Órdenes de cambio (dueño: M4)
```
orden_cambio   : obra_id fk, numero int (secuencial por obra), titulo,
                 descripcion, motivo enum[PEDIDO_COMITENTE,IMPREVISTO,ERROR_PROYECTO,MEJORA,OTRO],
                 impacto_costo decimal(14,2) (+/-), moneda char(3),
                 impacto_dias int (+/-),
                 rubros_afectados uuid[] (fk rubro_obra),
                 estado enum[BORRADOR,PENDIENTE,APROBADA,RECHAZADA,ANULADA],
                 solicitante_id fk usuario, resolutor_id fk usuario?,
                 fecha_resolucion timestamptz?, nota_resolucion?
orden_cambio_item: orden_cambio_id fk, descripcion, tipo_recurso enum,
                 unidad enum, cantidad decimal, precio_unitario decimal,
                 subtotal decimal (calculado)
```

### 5.6 Avance y reporte (dueño: M5 / M6)
```
avance_registro: tarea_id fk, obra_id fk, fecha date, avance_pct decimal(5,2),
                 nota?, foto_url?, registrado_por fk usuario
reporte_semanal: obra_id fk, semana_inicio date, generado_en timestamptz,
                 contenido jsonb (estructura en spec 07), enviado bool
```

## 6. Contrato de eventos (integración entre módulos)

Los módulos NO se llaman entre sí directamente. Se comunican por dos vías:
1. **Lectura de tablas ajenas: permitida, solo lectura,** vía los repositorios
   exportados por `packages/db`.
2. **Escritura cruzada: prohibida,** salvo las dos excepciones documentadas
   (OC aprobada → ítems en presupuesto ADOPTADO, spec 05; y OC aprobada →
   `dias_perdidos` en tareas, spec 05). Para todo lo demás: emitir un evento.

Todo módulo escribe en la tabla `evento` al producir un hecho de negocio.
Catálogo cerrado de `evento.tipo` del MVP (no agregar tipos sin actualizar acá):

```
obra.creada                 miembro.invitado            miembro.activado
computo.tarea_creada        computo.importado
presupuesto.creado          presupuesto.item_agregado   presupuesto.adoptado_rubro
caja.compromiso_registrado  caja.pago_registrado        caja.desvio_detectado
oc.creada                   oc.enviada                  oc.aprobada      oc.rechazada
plazos.avance_registrado    plazos.dias_perdidos        plazos.tarea_finalizada
reporte.generado            reporte.enviado
```
`payload` mínimo: `{ entidad_id, resumen_humano: string, datos: {...} }`.
`resumen_humano` se redacta en español natural ("Se aprobó la OC #3 por +$450.000
y +5 días") porque el M6 lo usa textualmente en el feed y el reporte semanal.

## 7. Sistema de diseño y UX (obligatorio, define la identidad única)

### 7.1 Tokens (en `packages/ui/tokens.ts` y CSS variables)
```
--color-primario:   #1F6F78  (verde petróleo)      --color-primario-hover: #18565D
--color-fondo:      #F7F8F9                         --color-superficie: #FFFFFF
--color-texto:      #1C2B33                         --color-texto-suave: #5B6B73
--color-borde:      #E3E8EA
--ok:    #2E9E5B    --alerta: #E5A50A    --peligro: #D64545    --info: #3B7DD8
--radius: 10px      --sombra: 0 1px 3px rgba(16,24,40,.08)
Tipografía: Inter (400/500/600/700). Escala: 12/14/16/20/24/32.
Espaciado: múltiplos de 4px. Contenedor máx: 1200px. Mobile-first (breakpoint 768px).
```

### 7.2 Shell de navegación (lo construye M0; los demás solo registran rutas)
- Barra superior: logo + selector de obra + campana de notificaciones + avatar.
- Navegación lateral (desktop) / tab bar inferior (mobile), por obra:
  `Tablero · Cómputo · Presupuestos · Caja · Cambios · Plazos · Equipo`
  Visibilidad por rol según matriz (sección 4). PROVEEDOR solo ve `Presupuestos`.
- Cada módulo registra sus rutas bajo `/obras/:obraId/<modulo>/...` mediante el
  registro `registerModuleRoutes()` que expone M0. Prohibido crear layouts propios.

### 7.3 Componentes compartidos (en `packages/ui`, los construye A0)
`Boton` (primario/secundario/peligro/fantasma) · `Tarjeta` · `TablaDatos`
(orden, búsqueda, paginado, vacío con ilustración) · `BadgeEstado` (mapea cada
enum de estado a color) · `Semaforo` (verde ≤90% · ámbar 90–100% · rojo >100%,
recibe previsto/actual) · `Dinero` (formatea con moneda y separador es-AR) ·
`Avatar` · `ModalConfirmar` · `Drawer` · `Wizard` (pasos) · `CampoFormulario` ·
`SubidaArchivo` (imagen/pdf, máx 10MB) · `EstadoVacio` · `Migas` ·
`SelectorRubro` (combobox con código+nombre) · `BarraProgreso`.

### 7.4 Reglas de UX transversales
- Toda pantalla responde en su cabecera la pregunta de la sección 1 cuando
  aplica: muestra `Total previsto · Comprometido · Pagado · Proyección final`.
- Toda acción destructiva o de aprobación pasa por `ModalConfirmar` con el
  impacto explícito en texto ("Vas a aprobar +$450.000 y +5 días de obra").
- Estados vacíos siempre con CTA ("Todavía no cargaste presupuestos →
  Cargar el primero" / "Importar desde Excel").
- Lenguaje: voseo rioplatense, sin jerga técnica para el rol COMITENTE
  ("lo que pusiste" en vez de "egresos devengados").
- Carga optimista solo en avance %; el resto, espera confirmación del server.

## 8. Convenciones de API

- REST JSON. Prefijo `/api/v1`. Recursos anidados por obra:
  `GET/POST /api/v1/obras/:obraId/tareas`, etc. (rutas exactas en cada spec).
- Auth: JWT en header `Authorization: Bearer`. M0 expone middleware
  `requiereRol(obraId, [...roles])` que TODOS los endpoints usan.
- Errores: `{ error: { codigo: "OBRA_SIN_PERMISO", mensaje: "..." } }`,
  HTTP 400/401/403/404/409/422.
- Paginado: `?pagina=1&porPagina=25` → `{ datos: [], total, pagina }`.
- Filtros comunes: `?rubroId=&desde=&hasta=&tipo=`.

## 9. Datos semilla (en `packages/db/seed/`, los carga A0)

1. `rubros.json`: los 24 rubros del catálogo (códigos exactos):
   TP00 Trabajos preliminares · MV00 Movimiento de suelo · AB00 Albañilería ·
   HA00 Hormigón armado · MA00 Mamposterías · RV00 Revoques y terminaciones ·
   CP00 Contrapisos y carpetas · PI00 Pisos · RE00 Revestimientos ·
   CR00 Cielorrasos · CU00 Cubierta · JU00 Juntas de trabajo ·
   IM00 Impermeabilizaciones · CE00 Cerco de cerramiento · HE00 Herrería ·
   CA00 Carpinterías · PN00 Pintura y terminaciones · AC00 Artefactos y accesorios ·
   IS00 Instalaciones sanitarias · IE00 Instalaciones eléctricas ·
   ID00 Instalación baja tensión-datos · IG00 Instalación de gas ·
   II00 Instalación incendio · JA00 Jardinería y parquización
2. `demo.ts`: una obra demo "Vivienda Demo 200 m²" con 4 usuarios (uno por rol),
   12 tareas en 3 rubros (HA, MA, CA), 1 referencia, 2 propuestas con alcances
   deliberadamente desiguales (una sin gas, otra con "tareas no previstas"),
   6 movimientos de caja, 1 OC aprobada y 1 pendiente, avances al 40%.
   **Sirve de fixture para los tests de integración de todos los módulos.**
3. `indices.json`: 12 valores mensuales de INFLACION_MENSUAL y TC_USD de ejemplo.

## 10. Definición de "terminado" (aplica a todo módulo)

1. Compila y corre con `pnpm dev` desde raíz; migraciones aplican limpias.
2. Todos los endpoints del spec implementados con validación zod y permisos.
3. Todas las pantallas del spec navegables desde el shell, responsive, con
   estados vacío/carga/error.
4. Emite todos los eventos de su catálogo (sección 6).
5. Tests: unitarios de reglas de negocio numeradas + 1 test de flujo feliz
   end-to-end contra la obra demo.
6. `DECISIONES.md` en la carpeta del módulo con supuestos tomados.
7. No tocó schema, tokens ni componentes compartidos sin PR separado etiquetado
   `[CONTRATO]` (requiere aprobación humana).
