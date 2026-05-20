# DECISIONS.md — q7-forms2apex

## Decisiones técnicas

### Parser: split_kv por doble espacio
- El Object List Report usa formato con padding de espacios: `* Name                    VALUE`
- El separador clave/valor es 2+ espacios entre la clave y el valor
- No usa `:` como delimitador (los dos-puntos aparecen solo cuando el valor tiene `:` por contenido, ej: "Title: Attention:")
- `split_kv` busca el primer par de espacios y divide ahí

### Indentación: clave para el nivel (depth)
- `get_depth(line)`: cuenta espacios al inicio, divide por 2
- `depth=0` → nivel form (propiedades del form, section headers)
- `depth=1` → nivel block (* Name = T_NOMBRE, propiedades de bloque, triggers, alerts)
- `depth=2` → nivel item (* Name = nombre de item dentro de bloque)
- Las líneas `* Name` sin indentation al inicio son secciones (TRIGGERS, ALERTS, BLOCKS)

### Triggers: detección por depth + nombre
- Cuando `section == 'triggers'` y `key == '* Name'`, un trigger name aparece a depth=1
- La marca de trigger text es `* Trigger Text` también a depth=1
- El texto PL/SQL viene líneas a depth=0 y depth=1 (BEGIN/END están a depth=0)
- Acumulación: si depth >= 1 y estamos dentro de trigger text → acumular línea completa

### Bloques: distinción control/data
- Los bloques de control empiezan con C_ o I_ → no generan tabla DDL
- Los bloques de datos tienen T_ prefix y Query Data Source Name

### Items: filtrado de triggers internos
- Items con `name` en trigger name list (WHEN-*, PRE-*, POST-*, KEY-*) son triggers internos del bloque, no items de UI
- Se filtran en el generator (no aparecen en el DDL de la página APEX)

### Radio Group / LOV
- Se mapean en `_map_item` cuando aparecen las propiedades específicas
- Se acumulan en `state['radio_buttons']` y `state['lov_values']`
- Se asignan al item al hacer flush

## Metodología de migración

1. **Object List Report** → archivo .txt de cada form
2. **Parser** → JSON estructurado (bloques, items, triggers, alerts, LOVs)
3. **Generator** → DDL SQL para crear las tablas y página APEX correspondiente
4. **Pendiente**: integrate APEXLang (26.1) cuando esté disponible para specs declarativas

## Limitaciones reconocidas
- El Object List Report **no incluye layout visual** (XY de canvas no mappea a coordinates APEX sin más)
- La posición X/Y de los items está en la sección de propiedades del item, accesible
- Se genera un grid aproximado en APEX basándose en X/Y pero requiere validación manual
- Los triggers PL/SQL se migran como texto dentro de un package helper, no como código ejecutable
- La UI exacta de la forma no puede reconstruirse automáticamente — requiere diseño APEX manual

## Próximo paso planificado
- Integrar más archivos de ejemplo del repo brasileiro para validar覆盖率
- Investigar cómo el pkg_import_form genera el SQL de las tablas del Object List Report
- Ver si el Object List Report incluye suficientes metadatos para replicar la UI en APEX

---

## Decisiones de arquitectura y producto (2026-05-20)

### Producto: herramienta interna de Cuadrante7
- **No es SaaS público.** Es una herramienta interna para migrar sistemas de clientes de Cuadrante7.
- No hay freemium ni billing. El acceso es controlado por Cuadrante7.
- Los usuarios son el equipo de Cuadrante7 + clientes específicos si aplica.

### Arquitectura: Monolito API REST + Frontend SPA ligero
- **Backend:** FastAPI (ya tenemos experiencia con él en q7-obras-01)
- **Frontend:** HTMX + Alpine.js + Tailwind (más ligero que React, suficiente para wizard de migración)
- **Base de datos:** PostgreSQL 15 con multi-tenant por schema (un schema por organización/cliente)
- **Cola async:** Celery + Redis para parsing y generación en background
- **Storage:** MinIO (S3-compatible) para archivos .txt de Forms y .sql generados
- **Auth:** JWT con email/password (inicialmente)

### Modelo de datos de tenancy
| Entidad | Descripción |
|---|---|
| `Organization` | Cliente de Cuadrante7 (ej: "Municipalidad de X") |
| `Project` | Una migración específica dentro de la org (ej: "Sistema de Escuelas") |
| `User` | Miembro del equipo de Cuadrante7 o contacto del cliente |
| `Migration` | Una ejecución de migración: upload → parse → review → generate → download |
| `FormFile` | El `.txt` del Object List Report subido |
| `ParsedResult` | JSON generado por el parser |
| `GeneratedSQL` | DDL SQL APEX generado |

### Flujo de trabajo (MVP)
1. Login → Dashboard de organizaciones
2. Crear proyecto → Subir `.txt`
3. Parser automático async con barra de progreso en vivo
4. Revisar resultado parseado (árbol de bloques/items/triggers)
5. Ajustar mapeos si es necesario
6. Generar SQL APEX → descargar
7. Historial de migraciones por proyecto

### Deployment
- **Fase 1:** Docker Compose local (Proxmox/VM del entorno de Victor)
- **Fase 2:** Si se necesita alta disponibilidad → Kubernetes o Docker Swarm
- **Arranque inmediato:** `docker-compose up` con todos los servicios