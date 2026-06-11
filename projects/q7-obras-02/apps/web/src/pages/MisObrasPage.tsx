import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui';
import { Tarjeta } from '@q7/ui';
import { BadgeEstado, badgeType } from '@q7/ui';

export function MisObrasPage() {
  const { obras, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { refreshUser(); }, []);

  const tipoBadge: Record<string, string> = { VIVIENDA: 'Vivienda', REFORMA: 'Reforma', COMERCIO: 'Comercio', CONDOMINIO: 'Condominio', OTRO: 'Otro' };

  if (obras.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Todavía no tenés obras</h2>
        <p style={{ color: tokens.color.textoSuave, marginBottom: '20px', fontSize: '14px' }}>Creá tu primera obra y empezá a gestionar los costos</p>
        <button onClick={() => navigate('/obras/nueva')} style={{
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>Nueva obra</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Mis obras</h1>
        <button onClick={() => navigate('/obras/nueva')} style={{
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>+ Nueva obra</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {obras.map(obra => (
          <Tarjeta key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{obra.nombre}</h3>
                <BadgeEstado type={badgeType(tipoBadge, obra.rol)}>{obra.rol}</BadgeEstado>
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '13px', color: tokens.color.textoSuave }}>—</div>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
