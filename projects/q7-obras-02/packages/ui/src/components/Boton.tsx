import React from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

interface BotonProps {
  children: React.ReactNode;
  variante?: Variante;
  onClick?: () => void;
  disabled?: boolean;
  tipo?: 'button' | 'submit';
  className?: string;
}

const estilos: Record<Variante, React.CSSProperties> = {
  primario: {
    backgroundColor: '#1F6F78',
    color: '#FFFFFF',
    border: 'none',
  },
  secundario: {
    backgroundColor: '#FFFFFF',
    color: '#1C2B33',
    border: '1px solid #E3E8EA',
  },
  peligro: {
    backgroundColor: '#D64545',
    color: '#FFFFFF',
    border: 'none',
  },
  fantasma: {
    backgroundColor: 'transparent',
    color: '#1C2B33',
    border: 'none',
  },
};

export function Boton({ children, variante = 'primario', onClick, disabled, tipo = 'button', className }: BotonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
    lineHeight: '20px',
  };

  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{ ...base, ...estilos[variante] }}
    >
      {children}
    </button>
  );
}
