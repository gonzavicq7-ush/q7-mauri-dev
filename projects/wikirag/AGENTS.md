# AGENTS.md - WikiRAG Schema

Schema principal para agentes que mantienen y consultan este wiki.

---

## 1. Objetivo del Proyecto

**Misión**: Wiki personal persistente para acumulación de conocimiento estructurado.

**Visión**: Un sistema donde cada pieza de información tiene:
- **Trazabilidad**: Fuente original en `raw/`
- **Estructura**: Entidades y conceptos en `wiki/`
- **Contexto**: Relaciones y síntesis en `synthesis/`

**Casos de uso**:
- Responder preguntas basándose en conocimiento acumulado
- Mantener un registro de decisiones y su contexto
- Explorar conexiones entre conceptos de diferentes fuentes

---

## 2. Estructura del Wiki

### Capas

| Capa | Propósito | Inmutable |
|------|-----------|-----------|
| `raw/` | Fuentes originales (PDFs, notas, URLs) | ✅ |
| `wiki/` | Contenido estructurado generado por LLM | ❌ |
| `sources/` | Páginas que documentan cada fuente procesada | ❌ |

### Convenciones de Nomenclatura

```
# Entidades
wiki/entities/<nombre-kebab>.md
Ejemplo: wiki/entities/openai-gpt-4.md

# Conceptos
wiki/concepts/<nombre-kebab>.md
Ejemplo: wiki/concepts/attention-mechanism.md

# Fuentes
wiki/sources/<nombre-kebab>.md
Ejemplo: wiki/sources/karpathy-llm-wiki-2024.md

# Síntesis
wiki/synthesis/<nombre-kebab>.md
Ejemplo: wiki/synthesis/weekly-2024-01.md
```

### Frontmatter Estándar

```yaml
---
title: "Título de la Página"
tags:
  - tag1
  - tag2
created: 2024-01-15
updated: 2024-01-15
sources:
  - raw/articulo-original.md
  - https://ejemplo.com/url
related:
  - wiki/concepts/otro-concepto.md
  - wiki/entities/una-entidad.md
---
```

---

## 3. Workflow de Ingest

### Paso 1: Recibir o identificar fuente

```
Recibir: URL, archivo, o texto
↓
```

### Paso 2: Guardar en `raw/`

```bash
# Para archivos
cp origen.pdf raw/

# Para URLs, guardar como markdown
# (futuro: script automático)
```

### Paso 3: Crear página en `sources/`

```markdown
# source:<nombre>

## Metadata
- URL: ...
- Fecha ingest: ...
- Formato: pdf|web|nota

## Resumen
Breve descripción del contenido.

## Contenido Extraído
... (secciones clave)
```

### Paso 4: Identificar entidades

- Extraer personas, organizaciones, productos
- Crear o actualizar páginas en `entities/`

### Paso 5: Identificar conceptos

- Extraer definiciones, técnicas, ideas
- Crear o actualizar páginas en `concepts/`

### Paso 6: Registrar en `log.md`

```
[YYYY-MM-DD] ingest | <fuente> | entidades: X, conceptos: Y
```

---

## 4. Workflow de Query

### Responder una pregunta

```
Recibir pregunta
↓
Buscar en wiki/ con search.sh o grep
↓
Identificar páginas relevantes
↓
Leer frontmatter (sources, related)
↓
Construir respuesta con citas
↓
Actualizar páginas si hay información nueva
```

### Comandos de Búsqueda

```bash
# Búsqueda básica
./tools/search.sh "query"

# Grep recursivo
grep -ri "término" wiki/

# Buscar por tag
grep -r "tags:" wiki/ | grep "tag-buscado"
```

---

## 5. Workflow de Lint

### Revisar salud del wiki

```bash
# 1. Verificar frontmatter requerido
grep -L "^title:" wiki/**/*.md

# 2. Verificar links rotos
grep -r "\]\[" wiki/ | grep -v "related\|sources"

# 3. Revisar log de cambios
cat wiki/log.md

# 4. Buscar páginas huérfanas (sin incoming links)
# (futuro: script automático)
```

### Checklist de Calidad

- [ ] Todas las páginas tienen frontmatter completo
- [ ] Todos los links a otras páginas son válidos
- [ ] El log.md tiene entradas recientes
- [ ] No hay contradicciones entre páginas relacionadas

---

## 6. Convenciones de Página

### Estructura de una Página

```markdown
---
title: "..."
tags: [...]
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [...]
related: [...]
---

# Título

## Introducción
...

## Detalles
...

## Véase También
- [Concepto Relacionado](../concepts/...)
- [Entidad](../entities/...)
```

### Links Entre Páginas

```markdown
# Formato relativo
[Texto](../concepts/otro-concepto.md)

# Formato absoluto desde raíz
[Texto](./concepts/otro-concepto.md)
```

### Tags Comunes

```
# Entidades
person, organization, product, project, company

# Conceptos
concept, technique, method, theory, pattern

# Metadatos
source, summary, reference, history
```

---

## 7. Comandos Útiles

###/search.sh

```bash
# Uso
./tools/search.sh "término de búsqueda"

# Ejemplo
./tools/search.sh "attention mechanism"
```

### Agregar fuente manualmente

```bash
# 1. Copiar a raw/
cp ~/Downloads/paper.pdf raw/

# 2. Crear página de fuente
cat > wiki/sources/mi-fuente.md << 'EOF'
---
title: "Mi Fuente"
...
---
EOF

# 3. Actualizar index.md
# 4. Agregar entrada al log.md
```

### Actualizar página existente

```bash
# 1. Editar archivo
# 2. Actualizar campo 'updated' en frontmatter
# 3. Agregar entrada en log.md
```

---

## Reglas de Oro

1. **Nunca modificar `raw/`** - Es la fuente de verdad
2. **Siempre citar fuentes** - En frontmatter y contenido
3. **Mantener log.md** - Append-only, registra cambios
4. **Links bidireccionales** - Si A ссылается a B, B debe ссылаться a A
5. **Tags consistentes** - Usar tags predefined cuando aplique
