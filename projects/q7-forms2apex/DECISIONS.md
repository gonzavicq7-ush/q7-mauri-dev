# DECISIONS.md

## 2026-05-16 — Arquitectura del parser Python
- Decisión: parser en Python puro (sin dependencias externas de Oracle, sin Docker si no hace falta)
- Motivo: portabilidad, facilidad de ejecución, rápido prototipado. El objetivo es generar JSON/metadata, no conectarnos a Oracle directamente
- Alternativa considerada: parser PL/SQL existente (ya funciona pero es rígido y anclado a Windows); se usa como referencia, no como base

## 2026-05-16 — Formato de salida interim: JSON estructurado
- Decisión: output intermedio en JSON, no en APEXLang directamente
- Motivo: APEXLang 26.1 aún no está disponible y su gramática no es estable. JSON permite iterar rápido y separar la fase de parsing de la fase de generación de specs
- Impacto: cuando APEXLang esté disponible, se добавить шаг de transformación JSON → .apx

## 2026-05-16 — Baseline: repo franklingjr/oracle-forms-migration
- Decisión: usar el repo brasileiro como referencia para entender qué metadata se puede extraer de un Object List Report
- Motivo: ya hay un trabajo considerable hecho; usar como spec de lo que se captura y cómo se estructura
- Contiene: 15+ tablas de staging, paquetes PL/SQL de parsing, lógica de triggers → funciones booleanas

## 2026-05-16 — Scope inicial: lógica de negocio + metadata de UI
- Decisión: el parser inicial captura lógica (triggers → funciones PL/SQL) y metadata de UI (bloques, items, propiedades, LOVs)
- Motivo: son las dos cosas que más valor dan para migrar rápido
- Excluido temporalmente: layout visual exacto (X/Y positioning) — no es confiable desde Object List Report

## 2026-05-16 — Ubicación del proyecto
- Decisión: `Mauri-dev/projects/q7-forms2apex/`
- Motivo: regla operativa general de Victor