import React from 'react';

interface BarraProgresoProps {
  valor: number;
  max?: number;
  altura?: number;
  color?: string;
  fondo?: string;
}

export function BarraProgreso({
  valor, max = 100, altura = 8,
  color = '#1F6F78', fondo = '#E3E8EA',
}: BarraProgresoProps) {
  const pct = Math.min(Math.max((valor / max) * 100, 0), 100);

  return (
    <div style={{
      width: '100%', height: `${altura}px`,
      backgroundColor: fondo, borderRadius: `${altura / 2}px`,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        backgroundColor: color, borderRadius: `${altura / 2}px`,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}
