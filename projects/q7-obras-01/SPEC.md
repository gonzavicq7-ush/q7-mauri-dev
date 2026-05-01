# SPEC.md — Q7 Obras MVP

## Visión del producto

Gestionar una obra de construcción sin perder el control de los gastos es uno de los dolores más comunes para cualquier particular que se enfrente a una reforma o construcción. Presupuestos que se desbordan, facturas dispersas, pagos a proveedores sin trazabilidad clara. El mercado ofrece software complejo pensado para constructoras grandes, o nada.

Q7 Obras resuelve esto con una herramienta web mínima y directa: el particular registra los gastos de su obra —materiales, mano de obra, honorarios— y los compara contra el presupuesto que definió al inicio. Sin registro, sin app que instalar, sin curvas de aprendizaje. Un link, una obra, control total.

En una segunda fase, el sistema se abre a profesionales (arquitectos, ingenieros, jefes de obra) que gestionan múltiples obras para múltiples clientes. El MVP valida primero el núcleo: ¿sirve para un particular con una obra?

## Modelo conceptual

### Entidades principales

```
OBRA (Project)
├── id, nombre, descripción, presupuesto_total
├── fecha_inicio, fecha_fin_prevista
├── estado (planificada | en_curso | finalizada)
├── token_unico (UUID para acceso sin auth)
│
├── PRESUPUESTO (Budget) — partición del presupuesto por categoría
│   ├── id, nombre_categoria (ej: "Albañilería", "Electricidad", "Pintura")
│   ├── monto_presupuestado, monto_real (calculado)
│   │
│   └── ITEM (LineItem) — líneas concretas dentro de cada categoría
│       ├── id, descripcion, cantidad, precio_unitario, total
│       └── tipo (material | mano_obra | honorarios | otro)
│
├── PROVEEDOR (Supplier)
│   ├── id, nombre, contacto, telefono, email, notas
│   │
│   └── GASTO (Expense) — cada gasto real registrado
│       ├── id, descripcion, monto, fecha, comprobante (opcional)
│       ├── categoria, tipo
│       └── FK → proveedor_id (opcional)
```

### Relaciones clave
- Una **Obra** tiene muchos **Presupuestos** (categorías)
- Una **Obra** tiene muchos **Gastos**
- Un **Presupuesto** tiene muchos **Items**
- Un **Gasto** puede vincularse a un **Proveedor** y a una **categoría presupuestaria**
- Un **Gasto** afecta el `monto_real` de su categoría de presupuesto

## Alcance MVP

### Entra en el MVP
- ✅ Crear una obra con presupuesto total
- ✅ Definir categorías de presupuesto con items detallados
- ✅ Registrar gastos reales (monto, fecha, categoría, proveedor opcional)
- ✅ Ver comparativa presupuesto vs real por categoría
- ✅ Ver resumen global (total presupuestado vs total gastado, saldo)
- ✅ Lista de gastos con filtro básico por categoría
- ✅ Acceso a la obra vía link único (token UUID en URL)
- ✅ Interfaz responsive básica (funciona en móvil)

### No entra en el MVP
- ❌ Registro/login de usuarios
- ❌ Múltiples obras por usuario
- ❌ Portal de profesionales / multi-cliente
- ❌ Subida de archivos (facturas, fotos)
- ❌ Notificaciones o alertas
- ❌ Exportación a PDF/Excel
- ❌ Dashboard con gráficos
- ❌ App móvil nativa
- ❌ Roles y permisos
- ❌ Integraciones bancarias o contables

## Historias de usuario priorizadas

### HU-1: Crear mi obra
**Como** particular, **quiero** crear una obra con nombre, presupuesto total y fechas estimadas, **para** tener el punto de partida contra el que mediré todo.

**Criterios:**
- Formulario con: nombre de obra, presupuesto total, fecha inicio, fecha fin prevista
- Al crear, se genera un link único (token UUID)
- Redirige al panel de la obra

### HU-2: Definir mi presupuesto por categorías
**Como** particular, **quiero** desglosar mi presupuesto en categorías (albañilería, electricidad, etc.) con items detallados (cantidad x precio), **para** saber exactamente cuánto pensaba gastar en cada partida.

**Criterios:**
- Crear categorías: nombre y monto total presupuestado
- Añadir items a cada categoría: descripción, cantidad, precio unitario
- Ver totales por categoría y global

### HU-3: Registrar gastos que voy teniendo
**Como** particular, **quiero** anotar cada gasto real (pago al albañil, compra de materiales) vinculándolo a una categoría y opcionalmente a un proveedor, **para** tener trazabilidad completa de lo que gasto.

**Criterios:**
- Formulario de gasto: descripción, monto, fecha, categoría, proveedor (opcional)
- Registrar proveedor sobre la marcha (nombre, teléfono)
- El gasto se refleja inmediatamente en la comparativa

### HU-4: Ver cómo voy respecto al presupuesto
**Como** particular, **quiero** ver un resumen por categoría comparando lo presupuestado vs lo gastado, y el saldo global, **para** saber si me estoy pasando y dónde.

**Criterios:**
- Tabla: Categoría | Presupuestado | Gastado | Diferencia | %
- Fila de totales
- Indicador visual de desviación (verde = ok, rojo = excedido)

### HU-5: Revisar la lista de gastos
**Como** particular, **quiero** ver todos los gastos registrados y filtrarlos por categoría, **para** revisar en detalle dónde se fue el dinero.

**Criterios:**
- Lista cronológica de gastos
- Filtro por categoría
- Cada gasto muestra: fecha, descripción, monto, categoría, proveedor

### HU-6: Gestionar proveedores
**Como** particular, **quiero** mantener una lista de proveedores con sus datos de contacto, **para** no tener que reingresarlos cada vez que registro un gasto con ellos.

**Criterios:**
- CRUD de proveedores: nombre, contacto, teléfono, email, notas
- Al registrar gasto, autocompletar desde proveedores existentes
- Ver gastos asociados a un proveedor

### HU-7: Compartir mi obra
**Como** particular, **quiero** copiar el link único de mi obra y compartirlo con mi arquitecto o pareja, **para** que ambos puedan ver y registrar gastos.

**Criterios:**
- Botón "copiar link" visible en el panel
- Cualquiera con el link puede ver y añadir gastos
- Aviso de que el link es la única forma de acceder (sin recuperación)

### HU-8: Navegación simple en móvil
**Como** particular, **quiero** poder registrar un gasto desde el móvil mientras estoy en la obra, **para** no olvidar anotar pagos en efectivo o compras del día.

**Criterios:**
- Interfaz responsive (Tailwind mobile-first)
- Formulario de gasto rápido accesible desde cualquier pantalla
- Navegación inferior simplificada

## Stack tecnológico sugerido

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Backend | **Python 3.11+ / FastAPI** | Rápido de desarrollar, tipado, async nativo, validación con Pydantic. Excelente DX. |
| Base de datos | **SQLite + SQLAlchemy** | Sin servidor externo. Cero configuración. Migrable a PostgreSQL si escala. Perfecto para MVP. |
| Frontend | **HTMX + Alpine.js** | HTMX para interacciones server-side sin escribir JS. Alpine.js para micro-interactividad (modales, toggles). Sin build step. |
| CSS | **Tailwind CSS (CDN)** | Estilos sin archivos CSS propios. CDN en MVP (sin PostCSS/build). |
| Templates | **Jinja2 (incluido en FastAPI)** | Server-side rendering. Simple, sin framework JS. |
| Despliegue | **VPS Linux + uvicorn + systemd** | Una sola máquina. Sin contenedores. Sin orquestación. |
| Control de versiones | **Git (+ GitHub)** | Estándar. |

### ¿Por qué no...?
- **Django:** demasiado opinado para este scope. FastAPI es más ligero.
- **React/Vue/Svelte:** overkill para un MVP de formularios y tablas. HTMX rinde mejor con menos código.
- **PostgreSQL:** SQLite alcanza perfecto para un solo usuario concurrente. Sin overhead de administración.
- **Docker:** añade complejidad innecesaria en fase MVP. systemd + proceso único es suficiente.

## Wireframes funcionales (texto)

### Pantalla 1: Panel principal de la obra
```
┌─────────────────────────────────────────┐
│  🏗️ Q7 Obras                            │
│  [Reforma Casa]              [Copiar 🔗] │
├─────────────────────────────────────────┤
│  Presupuesto: $15.000.000               │
│  Gastado:     $12.450.000  (83%)        │
│  Saldo:       $2.550.000   (17%)        │
├─────────────────────────────────────────┤
│  COMPARATIVA POR CATEGORÍA              │
│  Categoría      Presup.  Gastado   %    │
│  ─────────────────────────────────────  │
│  Albañilería    5.000K   4.800K   96% ✅│
│  Electricidad   3.000K   3.200K  107% 🔴│
│  Pintura        2.500K   1.200K   48% ✅│
│  Fontanería     2.000K   1.850K   93% ✅│
│  Varios         2.500K   1.400K   56% ✅│
│  ─────────────────────────────────────  │
│  TOTAL         15.000K  12.450K   83%   │
├─────────────────────────────────────────┤
│  [➕ Nuevo gasto]  [📋 Ver gastos]      │
│  [📊 Presupuesto]  [🏢 Proveedores]     │
└─────────────────────────────────────────┘
```

### Pantalla 2: Formulario de gasto rápido
```
┌─────────────────────────────────────────┐
│  ← Volver          NUEVO GASTO          │
├─────────────────────────────────────────┤
│  Descripción: [______________________]  │
│  Monto:       [$_________]              │
│  Fecha:       [01/05/2026]              │
│  Categoría:   [Albañilería     ▼]       │
│  Proveedor:   [Buscar o nuevo... ▼]     │
│                                         │
│  [💾 Guardar gasto]                     │
└─────────────────────────────────────────┘
```

### Pantalla 3: Detalle de presupuesto (categoría)
```
┌─────────────────────────────────────────┐
│  ← Panel       ALBAÑILERÍA              │
├─────────────────────────────────────────┤
│  Presupuestado: $5.000.000              │
│  Gastado:       $4.800.000  (96%)       │
│  Diferencia:    $200.000                │
├─────────────────────────────────────────┤
│  ITEMS PRESUPUESTADOS                   │
│  Descripción           Cant  Precio  Tot│
│  ─────────────────────────────────────  │
│  Ladrillos huecos     5000  $150  750K  │
│  Cemento (bolsas)      200  $2.5K 500K  │
│  Arena (m³)             15  $50K  750K  │
│  Mano de obra albañil    1  $3.0M  3.0M │
│  ─────────────────────────────────────  │
│  Total items                    $5.0M   │
│                                         │
│  [+ Añadir item]                        │
├─────────────────────────────────────────┤
│  GASTOS REALES EN ESTA CATEGORÍA        │
│  Fecha       Descripción       Monto    │
│  ─────────────────────────────────────  │
│  15/04  Ladrillos Corralón    $750K     │
│  18/04  Cemento x100          $250K     │
│  22/04  Pago albañil semana   $750K     │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Pantalla 4: Lista de gastos con filtro
```
┌─────────────────────────────────────────┐
│  ← Panel          TODOS LOS GASTOS      │
├─────────────────────────────────────────┤
│  Filtrar: [Todas las categorías ▼]      │
│                                         │
│  Fecha      Descripción          Monto  │
│  ─────────────────────────────────────  │
│  01/05/26   Cableado eléctrico   $450K  │
│             Electricidad · ElectroSur   │
│  ─────────────────────────────────────  │
│  28/04/26   Pago pintor semana   $600K  │
│             Pintura · Juan Pérez        │
│  ─────────────────────────────────────  │
│  25/04/26   Tuberías y conexiones $380K │
│             Fontanería · CasaFont       │
│  ...                                    │
│                                         │
│  [➕ Nuevo gasto]                       │
└─────────────────────────────────────────┘
```

### Pantalla 5: Crear obra (landing inicial)
```
┌─────────────────────────────────────────┐
│                                         │
│         🏗️ Q7 Obras                     │
│                                         │
│  Controlá los gastos de tu obra         │
│  sin complicaciones.                    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Nombre de la obra: [_________]  │    │
│  │ Presupuesto total:  [$________] │    │
│  │ Fecha inicio:       [__/__/__]  │    │
│  │ Fecha fin prevista:  [__/__/__] │    │
│  │                                 │    │
│  │ [🚀 Crear obra]                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Sin registro. Sin app. Solo tu link.   │
└─────────────────────────────────────────┘
```

## Criterios de aceptación del MVP

El MVP se considera listo cuando:

1. **Flujo completo funcional:** un particular puede crear obra → definir presupuesto → registrar gastos → ver comparativa, sin errores.
2. **Acceso por link:** una obra creada genera un token UUID. Cualquiera con el link puede ver y operar la obra.
3. **Datos persistentes:** los datos sobreviven a reinicios del servidor (SQLite en disco).
4. **Responsive básico:** la interfaz es usable en móvil (ancho 375px+) y desktop.
5. **Sin errores 500:** todas las operaciones CRUD funcionan con validación del lado servidor.
6. **Cálculos correctos:** la comparativa presupuesto vs real es exacta y se actualiza en tiempo real.
7. **Despliegue funcionando:** accesible vía URL pública en un VPS.
8. **Código versionado:** repositorio Git con README básico de setup.
