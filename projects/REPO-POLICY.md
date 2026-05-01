# REPO-POLICY.md

## Política de gestión del repositorio común `projects`

## Principio general

`projects` es el repositorio común interno de trabajo.

Se usa para:
- incubación
- desarrollo inicial
- organización interna
- prototipos
- proyectos todavía no escindidos a repositorios propios

## Cuándo mantener un proyecto dentro de `projects`

Mantenerlo aquí cuando:
- aún está en definición o construcción
- sigue cambiando mucho
- todavía no tiene destino productivo claro
- forma parte del trabajo interno del entorno
- conviene compartir contexto con otros proyectos del workspace

## Cuándo separarlo a un repo propio

Separarlo cuando:
- pasa a cliente
- entra en producción
- requiere CI/CD propio
- necesita historial y permisos aislados
- debe entregarse o desplegarse de forma independiente
- conviene evitar exposición del resto de los proyectos

## Criterios de separación

Antes de sacar un proyecto de `projects`, revisar:
- si contiene secretos o referencias sensibles
- si el README y documentación están actualizados
- si la estructura está limpia
- si hay dependencias internas no deseadas
- si necesita variables de entorno propias

## Regla sobre Git

- `projects/` mantiene un único repositorio Git común
- evitar repos Git anidados en subcarpetas mientras el proyecto siga aquí
- si un proyecto se independiza, recién ahí pasa a tener su propio repo

## Recomendaciones para futuros proyectos

- crear cada proyecto en su carpeta desde el inicio
- incluir README mínimo
- incluir notas de arquitectura o decisiones si el proyecto lo justifica
- mantener estructura clara entre docs, código, infra y automatización
- evitar mezclar archivos globales del workspace con archivos específicos del proyecto

## Recomendación final

Usar `projects` como espacio de trabajo interno compartido y tratar la escisión a repos propios como una transición natural cuando un proyecto madura.
