"""
generator_service.py — Service wrapper for APEX SQL generator.

Reuses apex_generator.py from the app package.
"""

from typing import Dict, Any

from app.apex_generator import APEXPageGenerator  # type: ignore


class GeneratorService:
    """
    Service wrapper that runs the APEXPageGenerator on parsed form JSON.
    """

    def generate_sql(
        self,
        parsed_json: Dict[str, Any],
        page_id: int = 100,
        app_id: int = 100,
    ) -> str:
        """
        Generate APEX-compatible SQL DDL from parsed form data.

        Args:
            parsed_json: Dictionary output from the parser service.
            page_id: APEX page ID (default 100).
            app_id: APEX application ID (default 100).

        Returns:
            SQL script string ready for execution in APEX SQL Workshop.

        Raises:
            ValueError: If generation fails.
        """
        try:
            generator = APEXPageGenerator(
                form_data=parsed_json,
                page_id=page_id,
                app_id=app_id,
            )
            return generator.generate()
        except Exception as exc:
            raise ValueError(f"Failed to generate APEX SQL: {exc}") from exc


# Singleton instance
_generator_service: "GeneratorService" = None  # type: ignore


def get_generator_service() -> GeneratorService:
    """Return a singleton GeneratorService instance."""
    global _generator_service
    if _generator_service is None:
        _generator_service = GeneratorService()
    return _generator_service
