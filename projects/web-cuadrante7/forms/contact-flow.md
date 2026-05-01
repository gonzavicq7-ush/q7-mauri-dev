# contact-flow.md

## Flujo sugerido de contacto

1. usuario completa formulario en la web
2. frontend envía datos a endpoint controlado
3. endpoint valida datos y aplica protección anti-spam
4. se notifica por correo o sistema interno
5. opcionalmente se dispara flujo en n8n
6. el lead se clasifica por línea de servicio

## Líneas de clasificación sugeridas

- Oracle APEX
- Infraestructura
- Automatización / IA

## Regla

No exponer directamente n8n como backend público principal sin controles adicionales.
