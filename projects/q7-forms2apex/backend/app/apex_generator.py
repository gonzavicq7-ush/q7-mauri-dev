#!/usr/bin/env python3
"""
apex_generator.py — Generador de DDL SQL para Oracle APEX

Toma la salida JSON de parser.py y genera un script SQL ejecutable en un
workspace de Oracle APEX (SQL Workshop o script de importación).

Uso:
    python3 apex_generator.py <parsed.json> <output.sql> [page_id]

Salida:
    Script SQL compatible con wwv_flow_api que crea:
      - Página APEX con regiones, items, procesos y dynamic actions
      - Regiones por bloque (Form / Interactive Report / Static Content)
      - Items de página mapeados desde items de Forms
      - Procesos de página para triggers a nivel de formulario y bloque
      - Dynamic Actions para alerts y triggers de tipo WHEN-NEW-...

Mapeos principales:
    - Bloque con table_name   → Region "Form" (si tiene items editables)
                               o "Interactive Report" (si solo tiene Display)
    - Bloque sin table_name   → Region "Static Content"
    - Item tipo TEXT ITEM     → APEX TEXT
    - Item tipo DISPLAY ITEM  → APEX DISPLAY_ONLY
    - Item tipo RADIO GROUP   → APEX RADIO_GROUP
    - Item tipo LIST ITEM     → APEX SELECT_LIST (LOV estática)
    - Trigger WHEN-NEW-FORM-INSTANCE → Proceso "After Header" (Page Load)
    - Trigger PRE-INSERT/POST-INSERT   → Proceso DML en la región del bloque
    - Alerts                  → Dynamic Action de alerta (Success/Error/Confirm)
"""

import json
import sys
import re
import hashlib
from typing import List, Dict, Any, Optional, Tuple


# ──────────────────────────────────────────────────────────────────
# Constantes y mapeos
# ──────────────────────────────────────────────────────────────────

# Item types de Forms → tipos nativos de APEX
ITEM_TYPE_MAP = {
    "TEXT ITEM":         "NATIVE_TEXT_FIELD",
    "DISPLAY ITEM":      "NATIVE_DISPLAY_ONLY",
    "CHECK BOX":         "NATIVE_CHECKBOX",
    "LIST ITEM":         "NATIVE_SELECT_LIST",
    "RADIO GROUP":       "NATIVE_RADIOGROUP",
    "BUTTON":            "NATIVE_BUTTON",
    "IMAGE":             "NATIVE_DISPLAY_IMAGE",
    "HIDDEN ITEM":       "NATIVE_HIDDEN",
    "POPLIST":           "NATIVE_SELECT_LIST",
    "COMBO BOX":         "NATIVE_TEXT_FIELD",
    "DATEPICKER":        "NATIVE_DATE_PICKER",
    "DATE PICKER":       "NATIVE_DATE_PICKER",
}

# Trigger names reconocidos a nivel de bloque (vienen como "items" en el JSON)
BLOCK_TRIGGER_NAMES = {
    "PRE-INSERT", "POST-INSERT",
    "PRE-UPDATE", "POST-UPDATE",
    "PRE-DELETE", "POST-DELETE",
    "WHEN-VALIDATE-RECORD", "WHEN-VALIDATE-ITEM",
    "WHEN-NEW-ITEM-INSTANCE", "WHEN-NEW-RECORD-INSTANCE",
    "WHEN-NEW-BLOCK-INSTANCE", "WHEN-NEW-FORM-INSTANCE",
    "ON-ERROR", "ON-MESSAGE",
    "KEY-COMMIT", "KEY-EXIT", "KEY-NXTBLK", "KEY-PRVBLK",
}

# Triggers que se mapean a Dynamic Actions (eventos del lado del cliente)
DA_TRIGGER_NAMES = {
    "WHEN-NEW-FORM-INSTANCE", "WHEN-NEW-BLOCK-INSTANCE",
    "WHEN-NEW-RECORD-INSTANCE", "WHEN-NEW-ITEM-INSTANCE",
}

# Triggers DML que van como procesos de región / página
DML_TRIGGER_NAMES = {
    "PRE-INSERT", "POST-INSERT",
    "PRE-UPDATE", "POST-UPDATE",
    "PRE-DELETE", "POST-DELETE",
    "WHEN-VALIDATE-RECORD", "WHEN-VALIDATE-ITEM",
}

ALERT_STYLE_MAP = {
    "STOP":     "ERROR",      # Stop → mensaje de error rojo
    "CAUTION":  "WARNING",    # Caution → advertencia
    "NOTE":     "SUCCESS",    # Note → info/éxito
    "":         "INFO",
}


class APEXPageGenerator:
    """
    Generador de DDL SQL para APEX a partir del JSON de parser.py.
    """

    def __init__(self, form_data: Dict[str, Any], page_id: int = 100, app_id: int = 100):
        self.form = form_data
        self.page_id = page_id
        self.app_id = app_id
        # IDs determinísticos para evitar colisiones en un mismo script
        self._id_counter = 0
        self.sql_lines: List[str] = []

    # ──────────────────────────────────────────────────────────────
    # Utilidades de ID
    # ──────────────────────────────────────────────────────────────
    def _mk_id(self, base: str) -> int:
        """Genera un ID numérico determinístico a partir de una cadena."""
        h = hashlib.md5(f"{self.page_id}_{base}".encode()).hexdigest()[:8]
        return int(h, 16)

    def _region_id(self, block_name: str) -> int:
        return self._mk_id(f"REG_{block_name}")

    def _item_id(self, block_name: str, item_name: str) -> int:
        return self._mk_id(f"ITEM_{block_name}_{item_name}")

    def _process_id(self, name: str) -> int:
        return self._mk_id(f"PROC_{name}")

    def _da_id(self, name: str) -> int:
        return self._mk_id(f"DA_{name}")

    def _safe_name(self, name: str) -> str:
        """Convierte a identificador SQL/URL seguro."""
        s = re.sub(r"[^A-Za-z0-9_]", "_", name)
        return s.strip("_").upper()

    def _apex_item_name(self, block_name: str, item_name: str) -> str:
        """
        Nombre de item en APEX: P<page_id>_<bloque>_<item>.
        Ej: P100_T_SCHOOL_SCH_NAME
        """
        base = f"P{self.page_id}_{self._safe_name(block_name)}_{self._safe_name(item_name)}"
        return base[:128]  # límite razonable

    # ──────────────────────────────────────────────────────────────
    # Separación de items reales vs triggers embebidos
    # ──────────────────────────────────────────────────────────────
    def _partition_block_items(self, block: Dict[str, Any]) -> Tuple[List[Dict], List[Dict]]:
        """
        Separa los items de un bloque en:
          - real_items: campos de datos/control visibles
          - trigger_items: triggers que el parser dejó como items
        """
        real_items = []
        trigger_items = []
        for it in block.get("items", []):
            name_upper = it.get("name", "").upper()
            if name_upper in BLOCK_TRIGGER_NAMES:
                trigger_items.append(it)
            else:
                real_items.append(it)
        return real_items, trigger_items

    # ──────────────────────────────────────────────────────────────
    # Clasificación de bloques
    # ──────────────────────────────────────────────────────────────
    def _is_data_block(self, block: Dict[str, Any]) -> bool:
        """Bloque con table_name no vacío y no de control (no empieza con C_/I_)."""
        tn = block.get("table_name", "").strip()
        if not tn:
            return False
        if tn.upper().startswith("C_") or tn.upper().startswith("I_"):
            return False
        return True

    def _block_region_type(self, block: Dict[str, Any], real_items: List[Dict]) -> str:
        """
        Decide el tipo de región APEX:
          - Si no hay table_name → STATIC_CONTENT
          - Si todos los items son DISPLAY_ONLY → NATIVE_IR (Interactive Report)
          - En cualquier otro caso → NATIVE_FORM (Form)
        """
        if not self._is_data_block(block):
            return "NATIVE_STATIC_CONTENT"

        # Si todos los items reales son display-only → Interactive Report
        all_display = all(
            ITEM_TYPE_MAP.get(it.get("item_type", "").upper(), "NATIVE_TEXT_FIELD")
            == "NATIVE_DISPLAY_ONLY"
            for it in real_items
        )
        if all_display and real_items:
            return "NATIVE_IR"
        return "NATIVE_FORM"

    # ──────────────────────────────────────────────────────────────
    # Generación SQL principal
    # ──────────────────────────────────────────────────────────────
    def generate(self) -> str:
        """Genera el script SQL completo y lo retorna como string."""
        self.sql_lines = []
        self._write_header()
        self._write_page()
        self._write_regions_and_items()
        self._write_form_triggers()
        self._write_alerts()
        self._write_footer()
        return "\n".join(self.sql_lines)

    def _write_header(self):
        form_name = self.form.get("name", "FORMS_PAGE")
        self.sql_lines.extend([
            "prompt --application/pages/page_" + str(self.page_id).zfill(5),
            "begin",
            "-- ============================================================",
            f"-- APEX Page DDL generado automáticamente desde form: {form_name}",
            f"-- Page ID: {self.page_id} | App ID: {self.app_id}",
            "-- ============================================================",
            "",
        ])

    def _write_footer(self):
        self.sql_lines.extend([
            "",
            "commit;",
            "end;",
            "/",
        ])

    # ──────────────────────────────────────────────────────────────
    # Página
    # ──────────────────────────────────────────────────────────────
    def _write_page(self):
        form_name = self.form.get("name", "FORMS_PAGE")
        console = self.form.get("console_window", "")
        page_title = form_name.replace("_", " ").title()

        self.sql_lines.extend([
            "wwv_flow_api.create_page (",
            f"    p_id           => {self.page_id},",
            f"    p_flow_id      => {self.app_id},",
            f"    p_name         => '{self._escape(page_title)}',",
            f"    p_alias        => '{self._escape(form_name.lower())}',",
            "    p_step_title   => '" + self._escape(page_title) + "',",
            "    p_autocomplete_on_off => 'OFF',",
            "    p_page_is_public      => 'N',",
            "    p_protection_level    => 'N',",
            f"    p_page_comment        => 'Migrado desde Forms: {self._escape(form_name)} | Console: {self._escape(console)}',",
            "    p_last_updated_by     => 'FORMS2APEX',",
            "    p_last_upd_yyyymmddhh24miss => to_char(sysdate,'YYYYMMDDHH24MISS')",
            ");",
            "",
        ])

    # ──────────────────────────────────────────────────────────────
    # Regiones + Items
    # ──────────────────────────────────────────────────────────────
    def _write_regions_and_items(self):
        blocks = self.form.get("blocks", [])
        if not blocks:
            self.sql_lines.append("-- No se encontraron bloques en el formulario.")
            return

        for block in blocks:
            real_items, trigger_items = self._partition_block_items(block)
            region_type = self._block_region_type(block, real_items)
            region_id = self._region_id(block["name"])
            region_name = block["name"].replace("_", " ")
            table_name = block.get("table_name", "")

            # ── Región ─────────────────────────────────────────────
            self.sql_lines.extend([
                f"-- ─── Región: {region_name} ───",
                "wwv_flow_api.create_page_region (",
                f"    p_id           => {region_id},",
                f"    p_flow_id      => {self.app_id},",
                f"    p_page_id      => {self.page_id},",
                f"    p_name         => '{self._escape(region_name)}',",
                f"    p_region_name  => '{self._escape(region_name)}',",
                f"    p_region_type  => '{region_type}',",
                f"    p_display_sequence => 10,",
                "    p_template_options => '#DEFAULT#',",
            ])

            if self._is_data_block(block) and region_type == "NATIVE_FORM":
                self.sql_lines.extend([
                    f"    p_source_type  => 'TABLE',",
                    f"    p_source       => '{self._escape(table_name.upper())}',",
                ])
            elif self._is_data_block(block) and region_type == "NATIVE_IR":
                self.sql_lines.extend([
                    f"    p_source_type  => 'TABLE',",
                    f"    p_source       => '{self._escape(table_name.upper())}',",
                ])
            else:
                self.sql_lines.append("    p_source_type  => 'STATIC',")

            self.sql_lines.extend([
                "    p_region_attributes => null,",
                ");",
                "",
            ])

            # ── Items de la región ─────────────────────────────────
            for item in real_items:
                self._write_item(block["name"], item, region_id, region_type)

            # ── Procesos de triggers a nivel de bloque ─────────────
            for trig in trigger_items:
                self._write_block_trigger_process(block["name"], trig, region_id)

            self.sql_lines.append("")

    def _write_item(self, block_name: str, item: Dict[str, Any], region_id: int, region_type: str):
        """Escribe un item de página APEX."""
        item_name = item.get("name", "")
        if not item_name:
            return

        apex_item = self._apex_item_name(block_name, item_name)
        item_id = self._item_id(block_name, item_name)
        forms_type = item.get("item_type", "").strip()
        apex_type = ITEM_TYPE_MAP.get(forms_type.upper(), "NATIVE_TEXT_FIELD")

        label = item.get("prompt", "").strip()
        if not label:
            label = item_name.replace("_", " ").title()

        db_col = item.get("database_column", "")
        max_len = item.get("max_length", 0) or 0
        required = "Y" if item.get("required", False) else "N"
        visible = "Y" if item.get("visible", True) else "N"
        enabled = "Y" if item.get("enabled", True) else "N"
        format_mask = item.get("format_mask", "")
        initial_value = item.get("initial_value", "")
        width = item.get("width", 0) or 200
        height = item.get("height", 0) or 25

        self.sql_lines.extend([
            f"-- Item: {apex_item} ({forms_type})",
            "wwv_flow_api.create_page_item (",
            f"    p_id           => {item_id},",
            f"    p_flow_id      => {self.app_id},",
            f"    p_page_id      => {self.page_id},",
            f"    p_name         => '{self._escape(apex_item)}',",
            f"    p_region_id    => {region_id},",
            f"    p_item_type    => '{apex_type}',",
            f"    p_label        => '{self._escape(label)}',",
            f"    p_display_as   => '{apex_type}',",
            f"    p_display_sequence => 10,",
        ])

        # Fuente de datos (solo para regiones de tipo form/ir)
        if db_col and region_type in ("NATIVE_FORM", "NATIVE_IR"):
            self.sql_lines.extend([
                f"    p_source_type  => 'DB_COLUMN',",
                f"    p_source       => '{self._escape(db_col.upper())}',",
            ])
        else:
            self.sql_lines.append("    p_source_type  => 'STATIC',")

        # Máscara de formato
        if format_mask:
            self.sql_lines.append(f"    p_format_mask  => '{self._escape(format_mask)}',")

        # Valor inicial
        if initial_value:
            self.sql_lines.append(f"    p_default_value => '{self._escape(initial_value)}',")

        # Requerido
        if required == "Y":
            self.sql_lines.append("    p_is_required  => 'Y',")

        # Visible / Enabled
        if visible == "N":
            self.sql_lines.append("    p_display_when_cond_type => 'NEVER',")

        # LOV estática (para LIST ITEM o RADIO GROUP)
        lov_values = item.get("lov_values", [])
        radio_buttons = item.get("radio_buttons", [])
        lov_pairs = []

        if lov_values:
            for v in lov_values:
                d = v.get("display", "")
                r = v.get("return", "")
                if d or r:
                    lov_pairs.append(f"{d}:{r}")
        elif radio_buttons:
            for b in radio_buttons:
                lbl = b.get("label", "")
                val = b.get("value", "")
                if lbl or val:
                    lov_pairs.append(f"{lbl}:{val}")

        if lov_pairs:
            lov_str = ";".join(lov_pairs)
            self.sql_lines.extend([
                "    p_lov_type     => 'STATIC',",
                f"    p_lov          => 'STATIC:{self._escape(lov_str)}',",
            ])

        # Tamaño (ancho) — solo para campos de texto
        if apex_type in ("NATIVE_TEXT_FIELD", "NATIVE_DISPLAY_ONLY") and width > 0:
            self.sql_lines.append(f"    p_width        => {min(width, 500)},")

        # Height para textareas o imágenes
        if apex_type in ("NATIVE_TEXTAREA", "NATIVE_DISPLAY_IMAGE") and height > 0:
            self.sql_lines.append(f"    p_height       => {min(height, 400)},")

        # Comentario con metadatos de Forms
        meta = (
            f"Forms: {item_name} | "
            f"Type={forms_type} | Col={db_col} | "
            f"Req={required} | Vis={visible} | Ena={enabled}"
        )
        self.sql_lines.append(f"    p_item_comment => '{self._escape(meta)}',")

        self.sql_lines.extend([
            ");",
            "",
        ])

    # ──────────────────────────────────────────────────────────────
    # Procesos para triggers de bloque
    # ──────────────────────────────────────────────────────────────
    def _write_block_trigger_process(self, block_name: str, trig: Dict[str, Any], region_id: int):
        """
        Crea un proceso de página vinculado a la región del bloque.
        Mapea triggers DML de Forms a procesos de APEX.
        """
        trig_name = trig.get("name", "").upper()
        trig_text = trig.get("trigger_text", "")

        if not trig_name:
            return

        proc_name = f"{block_name}_{trig_name}"
        proc_id = self._process_id(proc_name)

        # Punto de ejecución
        if trig_name in ("PRE-INSERT", "PRE-UPDATE", "PRE-DELETE"):
            point = "BEFORE_PROCESSING"
            proc_type = "NATIVE_PLSQL"
        elif trig_name in ("POST-INSERT", "POST-UPDATE", "POST-DELETE"):
            point = "AFTER_PROCESSING"
            proc_type = "NATIVE_PLSQL"
        elif trig_name in ("WHEN-VALIDATE-RECORD", "WHEN-VALIDATE-ITEM"):
            point = "ON_SUBMIT"
            proc_type = "NATIVE_PLSQL"
        else:
            point = "ON_SUBMIT"
            proc_type = "NATIVE_PLSQL"

        plsql_body = trig_text if trig_text else f"-- TODO: Implementar lógica de {trig_name} para bloque {block_name}"

        self.sql_lines.extend([
            f"-- Trigger de bloque: {trig_name} ({block_name})",
            "wwv_flow_api.create_page_process (",
            f"    p_id           => {proc_id},",
            f"    p_flow_id      => {self.app_id},",
            f"    p_page_id      => {self.page_id},",
            f"    p_name         => '{self._escape(proc_name)}',",
            f"    p_region_id    => {region_id},",
            f"    p_process_sequence => 10,",
            f"    p_process_point    => '{point}',",
            f"    p_process_type     => '{proc_type}',",
            f"    p_process_clob     => q'[{plsql_body}]',",
            f"    p_process_comment  => 'Migrado desde Forms: trigger {trig_name} del bloque {block_name}',",
            ");",
            "",
        ])

    # ──────────────────────────────────────────────────────────────
    # Triggers a nivel de formulario
    # ──────────────────────────────────────────────────────────────
    def _write_form_triggers(self):
        triggers = self.form.get("triggers", [])
        if not triggers:
            return

        self.sql_lines.append("-- ═══ Triggers a nivel de Formulario ═══")

        for trig in triggers:
            trig_name = trig.get("name", "").upper()
            trig_text = trig.get("trigger_text", "")

            if not trig_name:
                continue

            # WHEN-NEW-FORM-INSTANCE → ejecutar al cargar la página (After Header)
            if trig_name == "WHEN-NEW-FORM-INSTANCE":
                self._write_page_process(
                    name=f"INIT_{trig_name}",
                    point="BEFORE_HEADER",
                    proc_type="NATIVE_PLSQL",
                    body=trig_text or "-- TODO: inicialización del formulario",
                    comment=f"Migrado: {trig_name}",
                )
            elif trig_name in DML_TRIGGER_NAMES:
                # Triggers DML globales (poco comunes a nivel form)
                self._write_page_process(
                    name=trig_name,
                    point="ON_SUBMIT",
                    proc_type="NATIVE_PLSQL",
                    body=trig_text or f"-- TODO: {trig_name}",
                    comment=f"Migrado: {trig_name}",
                )
            elif trig_name in DA_TRIGGER_NAMES:
                # Dynamic Action en Page Load
                self._write_dynamic_action(trig_name, trig_text)
            else:
                # Cualquier otro trigger → proceso genérico en ON_SUBMIT
                self._write_page_process(
                    name=trig_name,
                    point="ON_SUBMIT",
                    proc_type="NATIVE_PLSQL",
                    body=trig_text or f"-- TODO: {trig_name}",
                    comment=f"Migrado: {trig_name}",
                )

        self.sql_lines.append("")

    def _write_page_process(self, name: str, point: str, proc_type: str, body: str, comment: str = ""):
        proc_id = self._process_id(name)
        safe_body = body.replace("]", "\]").strip()
        self.sql_lines.extend([
            f"-- Proceso: {name}",
            "wwv_flow_api.create_page_process (",
            f"    p_id           => {proc_id},",
            f"    p_flow_id      => {self.app_id},",
            f"    p_page_id      => {self.page_id},",
            f"    p_name         => '{self._escape(name)}',",
            f"    p_process_sequence => 10,",
            f"    p_process_point    => '{point}',",
            f"    p_process_type     => '{proc_type}',",
            f"    p_process_clob     => q'[{safe_body}]',",
            f"    p_process_comment  => '{self._escape(comment)}',",
            ");",
            "",
        ])

    def _write_dynamic_action(self, trig_name: str, trig_text: str):
        """
        Crea una Dynamic Action en evento 'Page Load' para triggers
        del tipo WHEN-NEW-... que deben ejecutarse del lado cliente.
        """
        da_id = self._da_id(trig_name)
        act_id = self._da_id(f"{trig_name}_ACT")

        plsql = trig_text if trig_text else f"-- TODO: {trig_name}"
        safe_plsql = plsql.replace("]", "\]").strip()

        self.sql_lines.extend([
            f"-- Dynamic Action: {trig_name}",
            "wwv_flow_api.create_page_da_event (",
            f"    p_id           => {da_id},",
            f"    p_flow_id      => {self.app_id},",
            f"    p_page_id      => {self.page_id},",
            f"    p_name         => 'DA_{self._escape(trig_name)}',",
            "    p_event_sequence => 10,",
            "    p_bind_type        => 'bind',",
            "    p_when_event       => 'PAGE_LOAD',",
            "    p_affected_elements_type => 'PAGE',",
            ");",
            "",
            "wwv_flow_api.create_page_da_action (",
            f"    p_id           => {act_id},",
            f"    p_flow_id      => {self.app_id},",
            f"    p_page_id      => {self.page_id},",
            f"    p_event_id     => {da_id},",
            "    p_action_sequence => 10,",
            "    p_execute_on_page_init => 'Y',",
            "    p_action_code    => 'NATIVE_EXECUTE_PLSQL_CODE',",
            f"    p_attribute_01   => q'[{safe_plsql}]',",
            f"    p_attribute_02   => 'N',",  # no wait for result
            f"    p_name           => 'EXEC_{self._escape(trig_name)}',",
            ");",
            "",
        ])

    # ──────────────────────────────────────────────────────────────
    # Alerts → Dynamic Actions o Success/Error Messages
    # ──────────────────────────────────────────────────────────────
    def _write_alerts(self):
        alerts = self.form.get("alerts", [])
        if not alerts:
            return

        self.sql_lines.append("-- ═══ Alerts migradas ═══")

        for alert in alerts:
            name = alert.get("name", "")
            title = alert.get("title", "")
            style = alert.get("style", "")
            btn1 = alert.get("button1_label", "")
            btn2 = alert.get("button2_label", "")

            if not name and not title:
                continue  # alert vacío

            apex_msg_type = ALERT_STYLE_MAP.get(style, "INFO")
            da_name = f"ALERT_{name}"
            da_id = self._da_id(da_name)
            act_id = self._da_id(f"{da_name}_ACT")

            # Mensaje compuesto
            message = title.strip()
            if btn1:
                message += f" [Botón 1: {btn1}]"
            if btn2:
                message += f" [Botón 2: {btn2}]"

            # Si es un confirm (Yes/No) → DA de confirmación
            if btn2 and apex_msg_type == "WARNING":
                self.sql_lines.extend([
                    f"-- Alert Confirm: {name}",
                    "wwv_flow_api.create_page_da_event (",
                    f"    p_id           => {da_id},",
                    f"    p_flow_id      => {self.app_id},",
                    f"    p_page_id      => {self.page_id},",
                    f"    p_name         => 'DA_{self._escape(da_name)}',",
                    "    p_event_sequence => 10,",
                    "    p_bind_type        => 'live',",
                    "    p_when_event       => 'CUSTOM',",
                    f"    p_custom_event     => '{self._escape(name)}',",
                    "    p_affected_elements_type => 'PAGE',",
                    ");",
                    "",
                    "wwv_flow_api.create_page_da_action (",
                    f"    p_id           => {act_id},",
                    f"    p_flow_id      => {self.app_id},",
                    f"    p_page_id      => {self.page_id},",
                    f"    p_event_id     => {da_id},",
                    "    p_action_sequence => 10,",
                    "    p_action_code     => 'NATIVE_CONFIRM',",
                    f"    p_attribute_01    => '{self._escape(title)}',",
                    f"    p_name            => 'CONFIRM_{self._escape(name)}',",
                    ");",
                    "",
                ])
            else:
                # Alert simple → proceso de mensaje que se puede invocar
                proc_id = self._process_id(f"ALERT_{name}")
                self.sql_lines.extend([
                    f"-- Alert Message: {name} ({apex_msg_type})",
                    "wwv_flow_api.create_page_process (",
                    f"    p_id           => {proc_id},",
                    f"    p_flow_id      => {self.app_id},",
                    f"    p_page_id      => {self.page_id},",
                    f"    p_name         => 'MSG_{self._escape(name)}',",
                    "    p_process_sequence => 99,",
                    "    p_process_point    => 'ON_SUBMIT',",
                    "    p_process_type     => 'NATIVE_PLSQL',",
                    f"    p_process_clob     => q'[apex_error.add_error(p_message => '{self._escape(message)}', p_display_location => apex_error.c_inline_with_field_and_notif);]',",
                    f"    p_process_comment  => 'Alert migrada: {self._escape(name)} | Estilo Forms: {self._escape(style)}',",
                    ");",
                    "",
                ])

    # ──────────────────────────────────────────────────────────────
    # Utilidades
    # ──────────────────────────────────────────────────────────────
    def _escape(self, text: str) -> str:
        """Escapa comillas simples para SQL."""
        if text is None:
            return ""
        return str(text).replace("'", "''")


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    if len(sys.argv) < 3:
        print("Uso: python3 apex_generator.py <input.json> <output.sql> [page_id] [app_id]")
        print("  input.json   → salida de parser.py")
        print("  output.sql   → script DDL para APEX")
        print("  page_id      → ID de página APEX (default: 100)")
        print("  app_id       → ID de aplicación APEX (default: 100)")
        sys.exit(1)

    json_path = sys.argv[1]
    sql_path = sys.argv[2]
    page_id = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    app_id = int(sys.argv[4]) if len(sys.argv) > 4 else 100

    form_data = load_json(json_path)
    generator = APEXPageGenerator(form_data, page_id=page_id, app_id=app_id)
    sql = generator.generate()

    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(sql)

    # Resumen en stdout
    blocks = form_data.get("blocks", [])
    total_items = sum(len(b.get("items", [])) for b in blocks)
    real_items = 0
    trig_items = 0
    for b in blocks:
        for it in b.get("items", []):
            if it.get("name", "").upper() in BLOCK_TRIGGER_NAMES:
                trig_items += 1
            else:
                real_items += 1

    print(f"✅ Generado: {sql_path}")
    print(f"   Formulario : {form_data.get('name', 'N/A')}")
    print(f"   Página APEX: {page_id} | App: {app_id}")
    print(f"   Bloques    : {len(blocks)}")
    print(f"   Items reales: {real_items}")
    print(f"   Triggers embebidos: {trig_items}")
    print(f"   Triggers form-level: {len(form_data.get('triggers', []))}")
    print(f"   Alerts     : {len(form_data.get('alerts', []))}")
    print(f"   Líneas SQL : {len(sql.splitlines())}")


if __name__ == "__main__":
    main()
