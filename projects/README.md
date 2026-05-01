# projects

Repositorio común interno para incubación, organización y evolución de proyectos dentro de este entorno de trabajo.

## Objetivo

Este repositorio se usa como workspace compartido para:
- prototipos
- proyectos en construcción
- documentación de arquitectura
- bases de frontend / automatización / infraestructura
- iniciativas todavía no separadas a repositorios propios

## Política de uso

### 1. Repo común interno
Este repositorio es el espacio principal de trabajo interno.

Aquí pueden convivir varios proyectos bajo carpetas separadas.

### 2. Repo individual por proyecto maduro o productivo
Cuando un proyecto:
- pasa a cliente
- entra en producción
- requiere despliegue independiente
- necesita control de acceso propio
- o debe entregarse de forma aislada

entonces conviene separarlo a un repositorio propio.

### 3. Este repo no reemplaza repos finales
El objetivo de `projects` no es ser necesariamente el origen final de despliegue de todos los proyectos, sino servir como:
- laboratorio
- backlog activo
- espacio de construcción inicial
- repositorio interno de trabajo

## Estructura recomendada

Cada proyecto debe vivir en su propia carpeta dentro de este repositorio.

Ejemplo:

```text
projects/
├── web-cuadrante7/
├── automatizacion-n8n-formularios/
└── otro-proyecto/
```

## Convenciones sugeridas

- usar nombres de carpetas claros, cortos y estables
- evitar espacios en nombres de proyecto
- preferir kebab-case
- mantener cada proyecto autocontenido
- documentar arquitectura, decisiones y estado mínimo dentro de cada carpeta

## Flujo recomendado

1. crear proyecto nuevo dentro de `projects/`
2. incubar, documentar y validar
3. si el proyecto madura o pasa a cliente, evaluar separación a repo propio
4. dejar en este repo solo lo que tenga sentido como workspace interno

## Notas operativas

- si un proyecto ya tiene destino cliente o productivo desde el inicio, puede convenir que nazca directamente como repo propio
- evitar repos anidados (`.git` dentro de cada proyecto) cuando el objetivo sea mantener este repositorio común
- antes de separar un proyecto, revisar secretos, variables de entorno y artefactos internos

## Estado inicial

Actualmente este repo ya contiene:
- `web-cuadrante7/`

Y queda preparado para alojar futuros proyectos del mismo entorno.
