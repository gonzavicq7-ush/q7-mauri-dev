import React from 'react';

interface BadgeEstadoProps {
  estado: string;
  type: 'success' | 'warning' | 'danger' | 'info' | 'default';
  children?: React.ReactNode;
}

const colores: Record<string, { bg: string; fg: string }> = {
  success: { bg: '#E6F7EE', fg: '#2E9E5B' },
  warning: { bg: '#FDF3DC', fg: '#E5A50A' },
  danger: { bg: '#FCE8E8', fg: '#D64545' },
  info: { bg: '#E3EDF9', fg: '#3B7DD8' },
  default: { bg: '#F0F1F2', fg: '#5B6B73' },
};

export function BadgeEstado({ estado, type, children }: BadgeEstadoProps) {
  const c = colores[type] || colores.default;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 10px',
        borderRadius: '100px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children ?? estado}
    </span>
  );
}

export function badgeType(map: Record<string, string>, valor: string): BadgeEstadoProps['type'] {
  const v = map[valor] || valor.toUpperCase();
  if (['ACTIVO', 'OK', 'APROBADA', 'VIGENTE', 'FINALIZADA', 'BORRADOR'].includes(v)) return 'success';
  if (['PENDIENTE', 'EN_CURSO', 'PAUSADA'].includes(v)) return 'warning';
  if (['REVOCADO', 'RECHAZADA', 'ANULADO', 'CANCELADA', 'DESCARTADO', 'FALLIDO'].includes(v)) return 'danger';
  if (['INFO'].includes(v)) return 'info';
  return 'default';
}
