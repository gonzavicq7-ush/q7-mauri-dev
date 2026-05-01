# WikiRAG

Wiki personal persistente para acumulación de conocimiento basado en el patrón de Karpathy's LLM Wiki.

## Descripción

WikiRAG es un sistema de gestión de conocimiento diseñado para:

- **Ingestar fuentes**: Artículos, documentación, notas, PDFs, URLs y cualquier fuente de conocimiento
- **Procesar y estructurar**: Extraer entidades, conceptos y relaciones
- **Consultar de forma RAG**: Responder preguntas basándose en el conocimiento acumulado
- **Mantener trazabilidad**: Registro cronológico de todos los cambios

## Estructura de Carpetas

```
wikirag/
├── README.md              ← Este archivo
├── AGENTS.md              ← Schema y workflow para agentes (principal)
├── .gitignore
├── raw/                   ← Fuentes originales (inmutables)
│   └── .gitkeep
├── wiki/                  ← Contenido generado por el LLM
│   ├── index.md          ← Catálogo del wiki
│   ├── log.md            ← Registro cronológico
│   ├── entities/         ← Páginas de entidades (personas, productos, etc.)
│   ├── concepts/         ← Páginas de conceptos y definiciones
│   ├── sources/          ← Páginas de fuentes procesadas
│   └── synthesis/        ← Páginas de síntesis general
└── tools/                ← Scripts útiles
    └── search.sh         ← Búsqueda en el wiki
```

## Primeros Pasos

### 1. Clonar o copiar el proyecto

```bash
git clone <repo> wikirag
cd wikirag
```

### 2.Primera consulta

```bash
# Buscar en el wiki
./tools/search.sh "tu pregunta"

# O directamente con grep
grep -r "término" wiki/
```

### 3. Hacer ingest de una fuente

```bash
# Agregar fuente raw (copiar archivo a raw/)
cp ~/documentos/mi-nota.md raw/

# Registrar en log.md
# (manual o via script futuro)

# Crear página en sources/
# Crear páginas relacionadas en entities/ y concepts/
```

## Requisitos del Sistema

- **Sistema operativo**: Linux, macOS, Windows (WSL)
- **Shell**: Bash 4.0+ o compatible
- **Git**: Para control de versiones
- **Opcional**: LLM API para auto-ingest (futuro)

## Tecnologías Utilizadas

- **Markdown**: Formato principal del contenido
- **YAML**: Frontmatter para metadatos
- **Git**: Control de versiones y colaboración
- **Bash**: Scripts de automatización
- **LLM**: Para procesamiento y síntesis del conocimiento

## Licencia

MIT License
