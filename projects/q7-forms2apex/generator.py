"""
Forms to APEX — Generador de DDL para páginas APEX
Toma el JSON del parser y genera scripts DDL para crear las páginas en APEX.

Genera:
  - CREATE_PAGE: página con regions, items y procesos
  - Tablas relacionadas si no existen
  - LOVs estáticas
  - Packages PL/SQL de soporte (triggers migrados)
"""

import json
from dataclasses import dataclass, asdict, field
from typing import Optional


@dataclass
class APEXPage:
    page_id: int
    page_name: str
    page_title: str
    region_type: str = "STATIC_CONTENT"
    items: list = field(default_factory=list)
    processes: list = field(default_factory=list)
    branches: list = field(default_factory=list)


@dataclass
class APEXItem:
    name: str
    item_type: str   # TEXT, DISPLAY_ONLY, SELECT_LIST, RADIO_GROUP, etc.
    label: str
    source_type: str = "DB_COLUMN"
    source_db_column: str = ""
    lov_type: str = ""      # STATIC, SQL_QUERY
    lov_sql: str = ""
    lov_static_values: str = ""
    format_mask: str = ""
    width: int = 0
    height: int = 0
    prompt_alignment: str = "LEFT"
    required: bool = False
    visible: bool = True
    readonly_condition: str = ""


class APEXGenerator:
    """
    Convierte el JSON del FormsParser en scripts DDL para Oracle APEX.
    """

    # Mapeo de tipos de item en Forms → tipos en APEX
    ITEM_TYPE_MAP = {
        'TEXT ITEM':         'TEXT',
        'DISPLAY ITEM':     'DISPLAY_ONLY',
        'CHECK BOX':        'CHECKBOX',
        'LIST ITEM':        'SELECT_LIST',
        'RADIO GROUP':      'RADIO_GROUP',
        'BUTTON':           'BUTTON',
        'IMAGE':            'IMAGE',
        'HIDDEN ITEM':      'HIDDEN',
        'POPLIST':          'SELECT_LIST',
        'COMBO BOX':        'TEXT',
        'DATEPicker':       'DATE_PICKER',
    }

    # Mapeo tipos de datos Forms → tipos DB Oracle
    DATA_TYPE_MAP = {
        'VARCHAR2':  'VARCHAR2',
        'NUMBER':    'NUMBER',
        'DATE':      'DATE',
        'CHAR':      'CHAR',
        'LONG':      'CLOB',
        'CLOB':      'CLOB',
        'BLOB':      'BLOB',
    }

    def __init__(self, form_json: dict):
        self.form = form_json

    # ──────────────────────────────────────────────────────────────
    # Generación de tablas
    # ──────────────────────────────────────────────────────────────
    def generate_table_ddl(self, block: dict) -> list:
        """Genera CREATE TABLE para un bloque (block) de Forms."""
        lines = []
        table_name = block.get('table_name', '').upper()
        if not table_name or table_name.startswith('C_') or table_name.startswith('I_'):
            return lines

        if not block.get('items'):
            return lines

        lines.append(f"-- Tabla para bloque {block['name']}")
        lines.append(f"CREATE TABLE {table_name} (")

        cols = []
        for item in block['items']:
            col_name = item.get('database_column', '')
            if not col_name:
                continue
            col_type = item.get('data_type', 'VARCHAR2')
            col_type = self.DATA_TYPE_MAP.get(col_type, col_type)

            max_len = item.get('max_length', 0)
            if col_type == 'VARCHAR2' and max_len > 0:
                col_type = f"VARCHAR2({max_len})"
            elif col_type == 'NUMBER':
                precision = item.get('precision', 0) or 38
                scale = item.get('scale', 0) or 0
                col_type = f"NUMBER({precision},{scale})"

            required = item.get('required', False)
            req_str = " NOT NULL" if required else ""

            cols.append(f"  {col_name:30s} {col_type}{req_str}")

        if cols:
            lines.append(",\n".join(cols))
            lines.append(");")

        lines.append("")
        return lines

    # ──────────────────────────────────────────────────────────────
    # Generación de columnas (para ALTER TABLE existente)
    # ──────────────────────────────────────────────────────────────
    def generate_column_sql(self, block: dict) -> list:
        """Genera ALTER TABLE con las columnas que faltan."""
        lines = []
        table_name = block.get('table_name', '').upper()
        if not table_name or table_name.startswith('C_') or table_name.startswith('I_'):
            return lines

        for item in block['items']:
            col_name = item.get('database_column', '')
            if not col_name:
                continue
            col_type = item.get('data_type', 'VARCHAR2')
            col_type = self.DATA_TYPE_MAP.get(col_type, col_type)
            max_len = item.get('max_length', 0)
            if col_type == 'VARCHAR2' and max_len > 0:
                col_type = f"VARCHAR2({max_len})"
            elif col_type == 'NUMBER':
                precision = item.get('precision', 0) or 38
                scale = item.get('scale', 0) or 0
                col_type = f"NUMBER({precision},{scale})"

            lines.append(f"ALTER TABLE {table_name} ADD ({col_name} {col_type});")

        if lines:
            lines.append("")
        return lines

    # ──────────────────────────────────────────────────────────────
    # Página APEX
    # ──────────────────────────────────────────────────────────────
    def generate_page_ddl(self, page_id: int, region_title: str = "") -> list:
        """Genera script DDL para página APEX completa."""
        lines = []

        lines.append("=" * 70)
        lines.append(f"-- APEX Page DDL - Form: {self.form['name']}")
        lines.append("=" * 70)
        lines.append("")

        # ── Tablas ──────────────────────────────────────────────────
        lines.append("-- ═══════════════════════════════════════════════════════")
        lines.append("-- TABLAS")
        lines.append("-- ═══════════════════════════════════════════════════════")
        for block in self.form.get('blocks', []):
            ddl = self.generate_table_ddl(block)
            lines.extend(ddl)

        # ── LOVs estáticas ──────────────────────────────────────────
        static_lovs = self.form.get('static_lovs', [])
        if static_lovs:
            lines.append("-- ═══════════════════════════════════════════════════════")
            lines.append("-- LOVs ESTÁTICAS")
            lines.append("-- ═══════════════════════════════════════════════════════")
            for lov in static_lovs:
                self._generate_lov_ddl(lines, lov)

        # ── Página APEX ────────────────────────────────────────────
        lines.append("-- ═══════════════════════════════════════════════════════")
        lines.append(f"-- PÁGINA APEX #{page_id}")
        lines.append("-- ═══════════════════════════════════════════════════════")

        for block in self.form.get('blocks', []):
            if block.get('table_name', '').startswith('C_'):
                continue  # Saltar bloques de control

            block_ddl = self._generate_block_page_ddl(page_id, block, region_title)
            lines.extend(block_ddl)

        # ── Triggers ───────────────────────────────────────────────
        triggers = self.form.get('triggers', [])
        if triggers:
            lines.append("")
            lines.append("-- ═══════════════════════════════════════════════════════")
            lines.append("-- PAQUETE PL/SQL CON TRIGGERS MIGRADOS")
            lines.append("-- ═══════════════════════════════════════════════════════")
            pkg = self._generate_package(triggers)
            lines.extend(pkg)

        lines.append(";")
        return lines

    def _generate_lov_ddl(self, lines: list, lov: dict):
        """Genera LOV estática en APEX."""
        block = lov.get('block_name', '')
        item = lov.get('item_name', '')
        values = lov.get('values', [])

        if not values:
            return

        lov_name = f"LOV_{block}_{item}".upper()
        lov_name = "".join(c if c.isalnum() else "_" for c in lov_name)

        display_col = "DISPLAY" if values and "display" in values[0] else "RETURN"
        return_col = "RETURN" if values and "return" in values[0] else "DISPLAY"

        lines.append(f"-- LOV: {lov_name} ({block}.{item})")
        lines.append(f"-- Nombre: {lov_name}")
        for v in values:
            d = v.get('display', '')
            r = v.get('return', '')
            if d or r:
                lines.append(f"--   {d} → {r}")
        lines.append("")

    def _generate_block_page_ddl(self, page_id: int, block: dict, region_title: str) -> list:
        lines = []
        table_name = block.get('table_name', '').upper()
        block_name = block.get('name', '')
        items = block.get('items', [])

        lines.append(f"-- ─── Bloque: {block_name} → {table_name} ───")
        lines.append(f"-- Fuente: Bloque {block_name} de {self.form['name']}")
        lines.append("")

        # Region
        region_id = self._safe_name(block_name)
        lines.append(f"/*")
        lines.append(f"-- Region: {region_title or block_name}")
        lines.append(f"-- Tipo: Form Region")
        lines.append(f"-- Fuente: {table_name}")
        lines.append(f"*/")
        lines.append("")

        # Items del bloque
        for item in items:
            item_ddl = self._generate_item_ddl(page_id, block_name, item)
            lines.extend(item_ddl)

        # Proceso automático
        if items:
            lines.append(f"-- Proceso: Guardar {block_name}")
            lines.append(f"/*")
            lines.append(f"WWV_FLOW_API.CREATE_PROCESS(")
            lines.append(f"    P_ID           => :APP_WORKSPACE_ID,")
            lines.append(f"    P_PAGE_ID      => {page_id},")
            lines.append(f"    P_NAME         => 'Save {block_name}',")
            lines.append(f"    P_REGION_ID    => {region_id},")
            lines.append(f"    P_PROCESS_POINT=> 'ON_SUBMIT',")
            lines.append(f"    P_PROCESS_TYPE => 'TABLE_API',")
            lines.append(f"    P_PROCESS_NAME => 'Save {block_name}'")
            lines.append(f");")
            lines.append("")

        return lines

    def _generate_item_ddl(self, page_id: int, block_name: str, item: dict) -> list:
        lines = []
        name = item.get('name', '')

        # Saltar nombres de triggers
        trigger_names = {'PRE-INSERT', 'POST-INSERT', 'PRE-UPDATE', 'POST-UPDATE',
                        'PRE-DELETE', 'POST-DELETE', 'WHEN-VALIDATE-RECORD',
                        'WHEN-VALIDATE-ITEM', 'WHEN-NEW-ITEM-INSTANCE',
                        'WHEN-NEW-RECORD-INSTANCE', 'WHEN-NEW-BLOCK-INSTANCE',
                        'WHEN-NEW-FORM-INSTANCE'}
        if name in trigger_names:
            return lines

        item_type_forms = item.get('item_type', '')
        item_type_apex = self.ITEM_TYPE_MAP.get(item_type_forms, 'TEXT')

        label = item.get('prompt', '') or name.replace('_', ' ').title()
        col = item.get('database_column', '')
        width = item.get('width', 0) or 200
        height = item.get('height', 0) or 25
        required = 'Yes' if item.get('required') else 'No'
        format_mask = item.get('format_mask', '')
        visible = 'Yes' if item.get('visible', True) else 'No'
        enabled = 'Yes' if item.get('enabled', True) else 'No'

        lines.append(f"-- Item: {name} ({item_type_forms})")
        lines.append(f"--   Label: {label}")
        lines.append(f"--   Tipo APEX: {item_type_apex}")
        lines.append(f"--   Columna: {col}")
        if format_mask:
            lines.append(f"--   Formato: {format_mask}")
        if item.get('lov_values'):
            lov_pairs = [f"{v['display']}:{v['return']}" for v in item['lov_values']]
            lines.append(f"--   LOV: {';'.join(lov_pairs[:5])}")
        if item.get('radio_buttons'):
            radio_pairs = [f"{b['label']}:{b['value']}" for b in item['radio_buttons']]
            lines.append(f"--   Radio: {';'.join(radio_pairs)}")

        # DDL comment (referencia para APEX builder)
        item_name_safe = self._safe_name(name)
        lines.append(f"/* Item: {item_name_safe} | Tipo={item_type_apex} | Label={label} | Fuente={col} | Req={required} */")
        lines.append("")
        return lines

    def _generate_package(self, triggers: list) -> list:
        lines = []
        form_name = self.form.get('name', 'FORMS').upper()
        pkg_name = f"PKG_{form_name}_TRIGGERS"

        lines.append(f"CREATE OR REPLACE PACKAGE {pkg_name} AS")
        lines.append("")
        lines.append("  -- Triggers migrados de Oracle Forms")
        lines.append(f"  -- Form origen: {self.form['name']}")
        lines.append("")

        for t in triggers:
            t_name = t.get('name', '')
            t_text = t.get('trigger_text', '')
            if t_name and t_text:
                lines.append(f"  -- {t_name}")
                lines.append(f"  -- {t_text[:60]}...")

        lines.append("")
        lines.append(f"END {pkg_name};")
        lines.append("/")
        lines.append("")
        return lines

    def _safe_name(self, name: str) -> str:
        """Convierte nombre a identifier seguro (sin caracteres especiales)."""
        return "".join(c if c.isalnum() else "_" for c in name.upper())

    def generate_json(self, page_id: int = 100) -> str:
        """Genera JSON estructurado de la página APEX (para importar vía API)."""
        output = {
            "form_name": self.form['name'],
            "page_id": page_id,
            "page_name": self.form['name'],
            "console_window": self.form.get('console_window', ''),
            "blocks": [],
            "triggers_count": len(self.form.get('triggers', [])),
            "alerts_count": len(self.form.get('alerts', [])),
        }

        for block in self.form.get('blocks', []):
            block_data = {
                "name": block['name'],
                "table_name": block.get('table_name', ''),
                "items": [],
            }
            for item in block.get('items', []):
                item_data = {
                    "name": item['name'],
                    "item_type": item.get('item_type', ''),
                    "label": item.get('prompt', '') or item['name'],
                    "database_column": item.get('database_column', ''),
                    "max_length": item.get('max_length', 0),
                    "required": item.get('required', False),
                    "format_mask": item.get('format_mask', ''),
                    "lov_values": item.get('lov_values', []),
                    "radio_buttons": item.get('radio_buttons', []),
                }
                block_data["items"].append(item_data)
            output["blocks"].append(block_data)

        return json.dumps(output, indent=2, ensure_ascii=False)


def main():
    import sys

    if len(sys.argv) < 2:
        print("Uso: python generator.py <archivo_json.json> [page_id]")
        print("  Si no hay archivo JSON, usar --parse <txt> para parsear y generar")
        sys.exit(1)

    json_path = sys.argv[1]
    page_id = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    with open(json_path, 'r') as f:
        form_data = json.load(f)

    gen = APEXGenerator(form_data)

    # Generar DDL
    ddl = gen.generate_page_ddl(page_id, form_data['name'])
    print("\n".join(ddl))

    # Generar JSON resumido
    print("\n" + "=" * 70)
    print("JSON OUTPUT")
    print("=" * 70 + "\n")
    print(gen.generate_json(page_id))


if __name__ == "__main__":
    main()