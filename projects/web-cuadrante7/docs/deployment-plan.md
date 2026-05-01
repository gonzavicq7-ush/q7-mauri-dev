# deployment-plan.md

## Despliegue recomendado

### Base
- dominio: `cuadrante7.com`
- DNS y protección perimetral en Cloudflare
- frontend desplegado en Vercel
- HTTPS obligatorio

## Controles mínimos

- redirección HTTP a HTTPS
- WAF habilitado
- cabeceras de seguridad
- secretos solo como variables de entorno
- validación de formularios
- rate limit si se exponen endpoints

## Pendientes

- definir stack final frontend
- definir proveedor de correo o notificaciones
- decidir integración inicial con n8n
