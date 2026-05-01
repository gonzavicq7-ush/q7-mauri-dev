# Cuadrante7 Frontend

Frontend institucional v1 de Cuadrante7, construido con Next.js, TypeScript y Tailwind CSS.

## Objetivo

Dejar una base sólida, sobria y mantenible para la presencia web inicial de Cuadrante7, con foco en:

- consistencia visual y técnica
- estructura multipágina simple
- copy B2B claro
- preparación para una próxima iteración con formulario funcional y contenido ampliado

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Estructura principal

```text
src/
  app/
    page.tsx
    servicios/page.tsx
    nosotros/page.tsx
    contacto/page.tsx
  components/
    page-hero.tsx
    site-header.tsx
    site-footer.tsx
  content/
    site.ts
```

## Estado actual

- Home y páginas internas maquetadas
- Navegación y CTA consistentes
- Metadatos base definidos
- Formulario de contacto aún sin backend ni automatización

## Próximos pasos sugeridos

1. Conectar formulario con validación y envío real.
2. Incorporar favicon/og-image de marca definitivos.
3. Añadir casos, diferenciales o referencias si aplica.
4. Definir dominio final y ajustar `metadataBase`.
