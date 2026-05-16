# PROJECT_STATE.md

## Proyecto: q7-forms2apex
- **Workspace:** Mauri-dev
- **Estado:** diseño y prototipado inicial
- **Objetivo:** automatizar la migración de Oracle Forms 6i/9i a Oracle APEX, extrayendo lógica de negocio desde Object List Reports y generando specs declarativas compatibles con APEXLang
- **Última actualización:** 2026-05-16
- **Responsable/s:** Mauri + Victor

## Resumen ejecutivo
_q7-forms2apex_ es un proyecto de ingeniería de migración Oracle Forms → APEX. Combina el parser PL/SQL del repo brasileiro (franklingjr/oracle-forms-migration) como referencia metodológica, con desarrollo propio de un parser en Python que genera salida compatible con APEXLang.

## Recursos existentes en el workspace
- Repo brasileiro clonado: `/mauri-dev/projects/oracle-forms-migration/`
- Object List Reports de demo: `sch0001.txt`, `sch0002.txt`
- Paquetes PL/SQL generados de referencia: `.proposed_plsql.sql`, `.oracle_apex_plsql_calls.sql`
- CSVs de valores estáticos: LOVs y radio groups exportados

## Stack técnico (a definir)
- Parser: Python
- Output: APEXLang (.apx) cuando esté disponible; JSON intermediario para prototipado
- DB: Oracle (misma versión que las apps Forms de Victor)
- APEX target: versión disponible en el entorno de Victor