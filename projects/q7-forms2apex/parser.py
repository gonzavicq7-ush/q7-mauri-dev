"""
Forms to APEX — Parser de Object List Report
Lee archivos .txt generados por Oracle Forms (File -> Administration -> Object List Report)
y los convierte en JSON estructurado.

El Object List Report tiene formato de árbol con indentation:
- Líneas con * Name son nombres de objetos
- Líneas con - o * (sin "Name") son propiedades
- La indentation determina el nivel (se mide en espacios, /2)
- El separador de propiedades es "  " (2+ espacios) entre key y value
"""

import json
from dataclasses import dataclass, asdict, field
from typing import Optional


@dataclass
class FormBlock:
    name: str = ""
    table_name: str = ""
    records_displayed: int = 10
    where_clause: str = ""
    order_by: str = ""
    items: list = field(default_factory=list)
    triggers: list = field(default_factory=list)


@dataclass
class FormItem:
    name: str = ""
    item_type: str = ""
    data_type: str = ""
    max_length: int = 0
    required: bool = False
    database_column: str = ""
    canvas: str = ""
    x: int = 0
    y: int = 0
    width: int = 0
    height: int = 0
    font_name: str = ""
    font_size: int = 0
    font_weight: str = ""
    prompt: str = ""
    prompt_attachment: str = ""
    format_mask: str = ""
    initial_value: str = ""
    visible: bool = True
    enabled: bool = True
    justification: str = ""
    radio_buttons: list = field(default_factory=list)
    lov_values: list = field(default_factory=list)


@dataclass
class FormTrigger:
    name: str = ""
    trigger_text: str = ""


@dataclass
class FormAlert:
    name: str = ""
    title: str = ""
    style: str = ""
    button1_label: str = ""
    button2_label: str = ""


@dataclass
class Form:
    name: str = ""
    console_window: str = ""
    blocks: list = field(default_factory=list)
    triggers: list = field(default_factory=list)
    alerts: list = field(default_factory=list)


def get_depth(line: str) -> int:
    """Calcula profundidad basado en espacios izquierdo (2 espacios = 1 nivel)."""
    expanded = line.expandtabs(8)
    leading = len(expanded) - len(expanded.lstrip())
    return leading // 2


def split_kv(line: str) -> tuple:
    """
    Separa key/value de una línea.
    El formato es: '  KEY                                     VALUE'
    Separa en el primer par de espacios múltiples (2+ espacios).
    Retorna (key, value) ambas con strip.
    """
    line = line.strip()
    # Split on 2 or more spaces — split only once on the first double-space
    idx = -1
    for i in range(1, len(line)):
        if line[i] == ' ' and i+1 < len(line) and line[i+1] == ' ':
            idx = i
            break
    if idx >= 0:
        key = line[:idx].strip()
        value = line[idx:].strip()
        return key, value
    if ':' in line:
        return line.split(':', 1)
    return line, ''


class FormsParser:

    def parse_file(self, filepath: str) -> Form:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        form = Form()
        state = {
            'section': 'form',
            'in_trigger_text': False,
            'trigger_text_lines': [],
            'block': None,
            'item': None,
            'trigger': None,
            'alert': None,
            'radio_buttons': [],
            'lov_values': [],
            'block_subsection': 'properties',
            'block_trigger': None,
            'in_block_trigger_text': False,
            'block_trigger_text_lines': [],
        }

        for raw_line in lines:
            line = raw_line.rstrip('\n\r')
            if not line.strip():
                # Blank lines inside trigger text are OK, skip them
                # Trigger text ends when we hit a property line (key starts with - or *)
                continue

            depth = get_depth(line)
            key, value = split_kv(line)
            key_upper = key.upper()

            # ── Section detection ──────────────────────────────────
            if 'TRIGGERS' in key_upper and depth == 0:
                self._flush_block(state, form)
                self._flush_item(state)
                state['section'] = 'triggers'
                continue
            if 'ALERTS' in key_upper and depth == 0:
                self._flush_block(state, form)
                self._flush_item(state)
                state['section'] = 'alerts'
                continue
            if 'BLOCKS' in key_upper and depth == 0:
                state['section'] = 'blocks'
                continue

            # ── Form-level ─────────────────────────────────────────
            if state['section'] == 'form':
                if key_upper == '* NAME':
                    form.name = value
                elif 'CONSOLE WINDOW' in key_upper:
                    form.console_window = value
                continue

            # ── Triggers section ───────────────────────────────────
            if state['section'] == 'triggers':
                self._parse_trigger(key, value, depth, state, form, line)
                continue

            # ── Alerts section ────────────────────────────────────
            if state['section'] == 'alerts':
                self._parse_alert(key, value, state, form)
                continue

            # ── Blocks / Items ─────────────────────────────────────
            if state['section'] == 'blocks':
                self._parse_block_item(key, value, depth, state, form, line)

        self._flush_item(state)
        self._flush_block(state, form)
        self._flush_trigger(state, form)
        self._flush_alert(state, form)
        return form

    # ── Trigger parsing ───────────────────────────────────────────
    def _parse_trigger(self, key: str, value: str, depth: int, state: dict, form: Form, line: str):
        s = state

        # Name of trigger at depth 3 (indented under triggers)
        if key_upper(key) == '* NAME' and depth == 1:
            self._flush_trigger(s, form)
            s['trigger'] = FormTrigger(name=value)
            s['in_trigger_text'] = False
            s['trigger_text_lines'] = []
            return

        if s['trigger'] is None:
            return

        # Trigger text (indented under trigger name)
        if key_upper(key) == '* TRIGGER TEXT':
            s['in_trigger_text'] = True
            s['trigger_text_lines'] = []
            if value:
                s['trigger_text_lines'].append(value)
            return

        if s['in_trigger_text']:
            if key.startswith('* Name') or key.startswith('-'):
                # Nueva propiedad/obj → terminar trigger text
                s['in_trigger_text'] = False
                s['trigger'].trigger_text = '\n'.join(s['trigger_text_lines'])
            else:
                s['trigger_text_lines'].append(line.strip())

    # ── Alert parsing ─────────────────────────────────────────────
    def _parse_alert(self, key: str, value: str, state: dict, form: Form):
        s = state
        key_u = key_upper(key)

        if key_u == '* NAME':
            self._flush_alert(s, form)
            s['alert'] = FormAlert(name=value)
            return
        if s['alert'] is None:
            return
        if 'TITLE' in key_u:
            s['alert'].title = value
        elif 'ALERT STYLE' in key_u:
            s['alert'].style = value
        elif 'BUTTON 1 LABEL' in key_u:
            s['alert'].button1_label = value
        elif 'BUTTON 2 LABEL' in key_u:
            s['alert'].button2_label = value

    # ── Block / Item parsing ───────────────────────────────────────
    def _parse_block_item(self, key: str, value: str, depth: int, state: dict, form: Form, line: str):
        s = state
        key_u = key_upper(key)

        # New block starts at depth=1 with * Name
        if depth == 1 and key_u == '* NAME':
            # Control blocks start with C_, I_, etc. Data blocks start with T_, BLOCK_
            if value.startswith(('T_', 'BLOCK_', 'C_', 'I_')):
                self._flush_item(s)
                self._flush_block(s, form)
                s['block'] = FormBlock(name=value)
                s['item'] = None
                s['block_trigger'] = None
                s['in_block_trigger_text'] = False
                s['block_trigger_text_lines'] = []
                s['block_subsection'] = 'properties'
                return

        if s['block'] is None:
            return

        # ── Sub-section detection within block ─────────────────────
        if depth == 1 and 'TRIGGERS' in key_u:
            s['block_subsection'] = 'triggers'
            self._flush_item(s)
            return
        if depth == 1 and 'ITEMS' in key_u:
            s['block_subsection'] = 'items'
            return

        # ── Block-level triggers ───────────────────────────────────
        if s.get('block_subsection') == 'triggers':
            if depth == 2 and key_u == '* NAME':
                # Flush previous block trigger
                self._flush_block_trigger(s)
                s['block_trigger'] = FormTrigger(name=value)
                s['in_block_trigger_text'] = False
                s['block_trigger_text_lines'] = []
                return

            if s['block_trigger'] is None:
                return

            if key_u == '* TRIGGER TEXT':
                s['in_block_trigger_text'] = True
                s['block_trigger_text_lines'] = []
                if value:
                    s['block_trigger_text_lines'].append(value)
                return

            if s['in_block_trigger_text']:
                if key.startswith('* Name') or key.startswith('-'):
                    s['in_block_trigger_text'] = False
                    s['block_trigger'].trigger_text = '\n'.join(s['block_trigger_text_lines'])
                else:
                    s['block_trigger_text_lines'].append(value if value else line.strip())
                return

            # Other trigger properties
            if s['block_trigger'] is not None and not s['in_block_trigger_text']:
                # Trigger style, etc.
                return

        # ── Block items ────────────────────────────────────────────
        if depth == 2 and key_u == '* NAME' and s.get('block_subsection') != 'triggers':
            self._flush_item(s)
            self._flush_block_trigger(s)
            s['item'] = FormItem()
            s['item'].name = value
            s['radio_buttons'] = []
            s['lov_values'] = []
            s['block_subsection'] = 'items'
            return

        if s['item'] is not None:
            self._map_item(key, value, s)
        elif s['block'] is not None:
            self._map_block(key, value, s)

    def _map_block(self, key: str, value: str, s: dict):
        key_u = key_upper(key)
        if 'QUERY DATA SOURCE NAME' in key_u:
            s['block'].table_name = value
        elif 'NUMBER OF RECORDS DISPLAYED' in key_u:
            try:
                s['block'].records_displayed = int(value)
            except:
                pass
        elif 'WHERE CLAUSE' in key_u:
            s['block'].where_clause = value
        elif 'ORDER BY' in key_u:
            s['block'].order_by = value

    def _map_item(self, key: str, value: str, s: dict):
        key_u = key_upper(key)

        if 'ITEM TYPE' in key_u:
            s['item'].item_type = value
        elif 'DATA TYPE' in key_u:
            s['item'].data_type = value
        elif 'MAXIMUM LENGTH' in key_u:
            try:
                s['item'].max_length = int(value)
            except:
                pass
        elif 'REQUIRED' in key_u:
            s['item'].required = value.upper() == 'YES'
        elif 'CANVAS' in key_u:
            s['item'].canvas = value
        elif 'X POSITION' in key_u:
            try:
                s['item'].x = int(value)
            except:
                pass
        elif 'Y POSITION' in key_u:
            try:
                s['item'].y = int(value)
            except:
                pass
        elif 'WIDTH' in key_u:
            try:
                s['item'].width = int(value)
            except:
                pass
        elif 'HEIGHT' in key_u:
            try:
                s['item'].height = int(value)
            except:
                pass
        elif 'FONT NAME' in key_u:
            s['item'].font_name = value
        elif 'FONT SIZE' in key_u:
            try:
                s['item'].font_size = int(value)
            except:
                pass
        elif 'FONT WEIGHT' in key_u:
            s['item'].font_weight = value
        elif key_u == 'PROMPT':
            s['item'].prompt = value
        elif 'PROMPT ATTACHMENT EDGE' in key_u:
            s['item'].prompt_attachment = value
        elif 'COLUMN NAME' in key_u and value:
            s['item'].database_column = value
        elif 'INITIAL VALUE' in key_u:
            s['item'].initial_value = value
        elif 'FORMAT MASK' in key_u:
            s['item'].format_mask = value
        elif 'VISIBLE' in key_u:
            s['item'].visible = value.upper() == 'YES'
        elif 'ENABLED' in key_u:
            s['item'].enabled = value.upper() == 'YES'
        elif 'JUSTIFICATION' in key_u:
            s['item'].justification = value
        elif 'RADIO BUTTON LABEL' in key_u:
            s['radio_buttons'].append({'label': value, 'value': ''})
        elif 'RADIO BUTTON VALUE' in key_u:
            if s['radio_buttons']:
                s['radio_buttons'][-1]['value'] = value
        elif 'LIST ITEM TEXT' in key_u and value:
            s['lov_values'].append({'display': value, 'return': ''})
        elif 'LIST ITEM VALUE' in key_u:
            if s['lov_values']:
                s['lov_values'][-1]['return'] = value

    # ── Flush helpers ──────────────────────────────────────────────
    def _flush_item(self, s: dict):
        if s['item'] is not None:
            if s['radio_buttons']:
                s['item'].radio_buttons = list(s['radio_buttons'])
            if s['lov_values']:
                s['item'].lov_values = list(s['lov_values'])
            if s['block'] is not None:
                s['block'].items.append(asdict(s['item']))
            s['item'] = None
            s['radio_buttons'] = []
            s['lov_values'] = []

    def _flush_block(self, s: dict, form: Form):
        if s['block'] is not None:
            # Flush any pending block trigger before saving block
            self._flush_block_trigger(s)
            # Save block even if empty (for control blocks without items)
            form.blocks.append(asdict(s['block']))
        s['block'] = None

    def _flush_block_trigger(self, s: dict):
        if s['block_trigger'] is not None:
            if s['in_block_trigger_text']:
                s['block_trigger'].trigger_text = '\n'.join(s['block_trigger_text_lines'])
            if s['block'] is not None:
                s['block'].triggers.append(asdict(s['block_trigger']))
            s['block_trigger'] = None
            s['block_trigger_text_lines'] = []
            s['in_block_trigger_text'] = False

    def _flush_trigger(self, s: dict, form: Form):
        if s['trigger'] is not None:
            if s['in_trigger_text']:
                s['trigger'].trigger_text = '\n'.join(s['trigger_text_lines'])
            form.triggers.append(asdict(s['trigger']))
            s['trigger'] = None
            s['trigger_text_lines'] = []
            s['in_trigger_text'] = False

    def _flush_alert(self, s: dict, form: Form):
        if s['alert'] is not None:
            form.alerts.append(asdict(s['alert']))
            s['alert'] = None

    def to_json(self, form: Form) -> str:
        return json.dumps(asdict(form), indent=2, ensure_ascii=False)


def key_upper(key: str) -> str:
    return key.upper()


def main():
    import sys
    if len(sys.argv) < 2:
        print("Uso: python parser.py <archivo_object_list_report.txt>")
        sys.exit(1)

    parser = FormsParser()
    form = parser.parse_file(sys.argv[1])

    print(f"Form: {form.name}")
    print(f"Console: {form.console_window}")
    print(f"Bloques: {len(form.blocks)}")
    for b_data in form.blocks:
        b = FormBlock(**b_data)
        print(f"  [{b.name}] tabla={b.table_name} items={len(b.items)}")
    print(f"Triggers: {len(form.triggers)}")
    for t_data in form.triggers:
        t = FormTrigger(**t_data)
        print(f"  - {t.name}")
    print(f"Alerts: {len(form.alerts)}")

    print("\n--- JSON OUTPUT ---")
    print(parser.to_json(form))


if __name__ == "__main__":
    main()