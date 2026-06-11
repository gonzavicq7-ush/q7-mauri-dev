import React, { useState } from 'react';
import { Boton } from './Boton';

interface ModalConfirmarProps {
  open: boolean;
  titulo: string;
  mensaje: string;
  impacto?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  textoConfirmar?: string;
  variante?: 'primario' | 'peligro';
}

export function ModalConfirmar({
  open, titulo, mensaje, impacto, onConfirmar, onCancelar,
  textoConfirmar = 'Confirmar', variante = 'primario',
}: ModalConfirmarProps) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,.15)',
        maxWidth: '440px', width: '90%', padding: '24px',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#1C2B33' }}>{titulo}</h3>
        <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#5B6B73', lineHeight: 1.5 }}>{mensaje}</p>
        {impacto && (
          <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#D64545' }}>{impacto}</p>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
          <Boton variante={variante} onClick={onConfirmar}>{textoConfirmar}</Boton>
        </div>
      </div>
    </div>
  );
}
