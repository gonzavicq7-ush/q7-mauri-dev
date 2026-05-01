#!/bin/bash
#
# WikiRAG Search Tool
# Búsqueda recursiva en el directorio wiki/
#

set -e

WIKI_DIR="$(dirname "$0")/../wiki"
SEARCH_TERM="${1:-}"

if [ -z "$SEARCH_TERM" ]; then
    echo "Uso: $0 <término-de-búsqueda>"
    echo ""
    echo "Busca recursivamente en wiki/ y muestra coincidencias con contexto."
    exit 1
fi

echo "🔍 Buscando: $SEARCH_TERM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Buscar con grep recursivo, ignorando binarios
grep -ri --include="*.md" "$SEARCH_TERM" "$WIKI_DIR" | while read -r line; do
    # Extraer archivo y contenido
    file=$(echo "$line" | cut -d: -f1)
    content=$(echo "$line" | cut -d: -f2-)
    
    # Mostrar ruta relativa
    rel_path="${file#$WIKI_DIR/}"
    
    echo "📄 $rel_path"
    echo "   $content"
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Fin de búsqueda"
