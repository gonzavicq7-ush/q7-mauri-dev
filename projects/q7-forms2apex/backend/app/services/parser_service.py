"""
parser_service.py — Service wrapper for Oracle Forms parser.

Reuses parser.py from the app package.
"""

import json
from typing import Dict, Any

from app.parser import FormsParser  # type: ignore


class ParserService:
    """
    Service wrapper that runs the FormsParser on raw .txt content.
    """

    def __init__(self) -> None:
        self._parser = FormsParser()

    def parse_form_text(self, text: str) -> Dict[str, Any]:
        """
        Parse Oracle Forms Object List Report text into structured JSON.

        Args:
            text: Raw content of a .txt Object List Report.

        Returns:
            Dictionary with form structure (blocks, items, triggers, alerts).

        Raises:
            ValueError: If parsing fails.
        """
        try:
            # Write to temporary file since parser expects a filepath
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False, encoding="utf-8"
            ) as tmp:
                tmp.write(text)
                tmp_path = tmp.name

            try:
                form = self._parser.parse_file(tmp_path)
                return json.loads(self._parser.to_json(form))
            finally:
                os.unlink(tmp_path)
        except Exception as exc:
            raise ValueError(f"Failed to parse form text: {exc}") from exc


# Singleton instance
_parser_service: "ParserService" = None  # type: ignore


def get_parser_service() -> ParserService:
    """Return a singleton ParserService instance."""
    global _parser_service
    if _parser_service is None:
        _parser_service = ParserService()
    return _parser_service
