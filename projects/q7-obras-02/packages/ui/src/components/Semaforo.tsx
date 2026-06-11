import React from 'react';
import { calcularSemaforo } from '@q7/shared';

interface SemaforoProps {
  previsto: number;
  actual: number;
  showLabel?: boolean;
}

const estilos = {
  verde: { bg: '#E6F7EE', fg: '#2E9E5B', label: 'Ok' },
  ambar: { bg: '#FDF3DC', fg: '#E5A50A', label: 'Alerta' },
  rojo: { bg: '#FCE8E8', fg: '#D64545', label: 'Excedido' },
};

export function Semaforo({ previsto, actual, showLabel = true }: SemaforoProps) {
  const color = calcularSemaforo(previsto, actual);
  const s = estilos[color];

  return (
    <span
      title={`${s.label}: ${actual} / ${previsto}`}
      aria-label={`Semaforo ${s.label}. Previsto ${previsto}, actual ${actual}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 600,
        color: s.fg,
      }}
    >
      <span style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: s.fg,
        display: 'inline-block',
      }} />
      {showLabel && s.label}
    </span>
  );
}
