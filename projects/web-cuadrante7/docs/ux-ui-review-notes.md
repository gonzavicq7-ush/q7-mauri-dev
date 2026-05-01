# UX/UI Review Notes — web-cuadrante7

Fecha: 2026-04-27 UTC
Alcance: revisión de experiencia visual, accesibilidad, consistencia y conversión B2B.

## Mejoras aplicadas

1. **Accesibilidad global**
   - Se añadió un enlace de salto al contenido en `src/app/layout.tsx`.
   - Permite llegar rápido al contenido principal sin pasar por la navegación.

2. **Formulario de contacto más usable**
   - Se añadieron `required` a los campos críticos.
   - Se agregaron `autoComplete` en nombre, organización y email.
   - Se incorporó `aria-live` para anunciar estados del envío.
   - Se reforzó el foco visible del botón de envío.

3. **Campos de formulario con mejor apariencia y legibilidad**
   - Se ajustó `.input-surface` en `src/app/globals.css`.
   - Se unificó tamaño, padding, borde, placeholder y foco.
   - Se mejoró el contraste y la percepción de control interactivo.

4. **Claridad semántica de navegación**
   - Se renombró el `aria-label` del menú principal en `src/components/site-header.tsx`.
   - Queda más explícito para tecnologías de asistencia.

5. **Consistencia visual de hero pages**
   - Se refinó `src/components/page-hero.tsx`.
   - Se cambió el bloque de eyebrow por una badge visual más clara.
   - Se añadió un punto de énfasis y un fondo más diferenciado para páginas internas.
   - Se homogeneizó mejor la jerarquía visual entre secciones.

## Recomendaciones pendientes

1. **Menú móvil**
   - Añadir versión colapsable en pantallas pequeñas.
   - Hoy la navegación principal se oculta en `md` y depende demasiado del CTA.

2. **Validación visual del formulario**
   - Mostrar errores inline por campo.
   - Evitar depender solo del mensaje general del servidor.

3. **Jerarquía de CTAs**
   - Mantener un CTA primario por pantalla.
   - Revisar si en home conviene reducir la competencia entre “Agendar una reunión”, “Ver servicios” e “Ir a contacto”.

4. **Prueba social / confianza**
   - Incluir testimonios, logos o casos breves si existen.
   - En B2B esto impacta más que más texto descriptivo.

5. **Conversión de contacto**
   - Añadir expectativas de respuesta, canal alternativo o tiempos estimados.
   - Puede reducir fricción en leads fríos.

6. **Contenido de home**
   - Simplificar o compactar algunas secciones si el objetivo es conversión rápida.
   - La página transmite sobriedad, pero conviene evitar saturación de bloques similares.

## Criterio general

La base visual está bien alineada con una marca B2B sobria y técnica. Lo que más valía la pena tocar primero era accesibilidad, interacción del formulario y consistencia de campos. El siguiente paso de mayor impacto sería navegación móvil + validación por campo + prueba social.
