# NEXT_STEPS.md

## Siguiente paso

**Inicializar el proyecto de código.**

1. Crear estructura de directorios:
   ```
   q7-obras-01/
   ├── src/
   │   ├── main.py          (FastAPI app)
   │   ├── models.py        (SQLAlchemy models)
   │   ├── routes/          (endpoints)
   │   ├── templates/       (Jinja2)
   │   └── static/          (si hiciera falta)
   ├── requirements.txt
   └── README.md
   ```

2. Instalar dependencias base: `fastapi`, `uvicorn`, `sqlalchemy`, `jinja2`

3. Crear el modelo de datos (SQLAlchemy) según SPEC.md

4. Implementar HU-1 (crear obra) como primer endpoint funcional

**Meta de la sesión actual:** Dejar corriendo un "Hola mundo" de FastAPI con la creación de obra funcionando contra SQLite.
