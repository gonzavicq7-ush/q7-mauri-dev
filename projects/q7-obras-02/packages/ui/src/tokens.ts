// Design tokens — fuente de verdad visual para ObraClara
// Basado en 00_ARQUITECTURA_COMUN.md §7.1

export const tokens = {
  color: {
    primario: '#1F6F78',
    primarioHover: '#18565D',
    fondo: '#F7F8F9',
    superficie: '#FFFFFF',
    texto: '#1C2B33',
    textoSuave: '#5B6B73',
    borde: '#E3E8EA',
    ok: '#2E9E5B',
    alerta: '#E5A50A',
    peligro: '#D64545',
    info: '#3B7DD8',
  },
  radius: '10px',
  sombra: '0 1px 3px rgba(16,24,40,.08)',
  tipografia: {
    familia: 'Inter, system-ui, -apple-system, sans-serif',
    pesos: {
      normal: 400,
      medio: 500,
      semibold: 600,
      bold: 700,
    },
    escala: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '20px',
      xl: '24px',
      '2xl': '32px',
    },
  },
  espaciado: {
    unidad: 4, // múltiplos de 4px
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },
  breakpoint: '768px',
  contenedor: '1200px',
} as const;

// CSS custom properties para inyectar en :root
export const cssVariables = `
  :root {
    --color-primario: ${tokens.color.primario};
    --color-primario-hover: ${tokens.color.primarioHover};
    --color-fondo: ${tokens.color.fondo};
    --color-superficie: ${tokens.color.superficie};
    --color-texto: ${tokens.color.texto};
    --color-texto-suave: ${tokens.color.textoSuave};
    --color-borde: ${tokens.color.borde};
    --ok: ${tokens.color.ok};
    --alerta: ${tokens.color.alerta};
    --peligro: ${tokens.color.peligro};
    --info: ${tokens.color.info};
    --radius: ${tokens.radius};
    --sombra: ${tokens.sombra};
    --font-familia: ${tokens.tipografia.familia};
  }
`;
