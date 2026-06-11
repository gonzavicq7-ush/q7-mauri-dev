import React from 'react';
import { Boton } from './Boton';

interface EstadoVacioProps {
  titulo: string;
  descripcion?: string;
  cta?: { texto: string; onClick?: () => void }[];
}

export function EstadoVacio({ titulo, descripcion, cta }: EstadoVacioProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '50%',
        backgroundColor: '#F0F1F2', display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: '16px', fontSize: '32px',
      }}>
        📋
      </div>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#1C2B33' }}>{titulo}</h3>
      {descripcion && <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#5B6B73' }}>{descripcion}</p>}
      {cta && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {cta.map((b, i) => (
            <Boton key={i} onClick={b.onClick}>{b.texto}</Boton>
          ))}
        </div>
      )}
    </div>
  );
}
