# ARCHITECTURE.md

## Arquitectura recomendada

### Objetivo

Construir una web corporativa moderna para `cuadrante7.com` con foco en rapidez de implementación, seguridad y facilidad de mantenimiento.

## Enfoque recomendado

- frontend moderno con contenido mayormente estático
- backend mínimo solo para formularios o integraciones puntuales
- despliegue simple con CDN, HTTPS y protección perimetral
- automatización desacoplada mediante n8n detrás de endpoints controlados

## Stack sugerido

- **Frontend:** Next.js
- **Hosting:** Vercel
- **DNS / WAF / SSL:** Cloudflare
- **Formularios:** endpoint serverless controlado
- **Automatización:** n8n como backend de procesos, no expuesto directamente como pieza pública principal
- **Analítica:** Plausible o Umami

## Principios técnicos

- priorizar simplicidad y mantenibilidad
- evitar backend pesado innecesario al inicio
- no exponer secretos en frontend
- no conectar servicios externos sin validación
- separar contenido, frontend, automatización e infraestructura

## Estructura del proyecto

- `docs/`: decisiones, sitemap, estrategia de contenido y seguridad
- `frontend/`: código de la web
- `automation/`: flujos o referencias para automatización futura
- `infra/`: notas y plantillas para despliegue
- `forms/`: definición funcional y técnica de formularios

## Evolución esperada

### Fase 1
- sitio institucional
- servicios
- contacto
- SEO base
- despliegue seguro

### Fase 2
- casos de uso
- automatización de leads
- contenidos por vertical

### Fase 3
- blog o recursos
- integraciones más avanzadas
- optimización comercial y operativa
