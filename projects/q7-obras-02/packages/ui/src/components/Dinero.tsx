import React from 'react';
import { type TipoMoneda, formatearDinero } from '@q7/shared';

interface DineroProps {
  monto: string | number;
  moneda?: TipoMoneda;
  size?: 'normal' | 'large';
}

export function Dinero({ monto, moneda = 'ARS', size = 'normal' }: DineroProps) {
  const fontSize = size === 'large' ? '24px' : 'inherit';
  const fontWeight = size === 'large' ? 700 : 600;

  return (
    <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize, fontWeight, whiteSpace: 'nowrap', color: '#1C2B33' }}>
      {formatearDinero(monto, moneda)}
    </span>
  );
}
