import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui/tokens';

export function InvitacionPage() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'cargando' | 'exito' | 'error' | 'expirada' | 'ya_procesada'>('cargando');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!token) return;
    api.post(`/invitaciones/${token}/aceptar`)
      .then(() => setEstado('exito'))
      .catch(err => {
        if (err.message.includes('expirada') || err.message.includes('expirado')) setEstado('expirada');
        else if (err.message.includes('ya fue aceptada') || err.message.includes('procesada')) setEstado('ya_procesada');
        else { setEstado('error'); setMensaje(err.message); }
      });
  }, [token]);

  const cardStyle: React.CSSProperties = {
    maxWidth: '440px', margin: '80px auto', padding: '32px',
    background: '#FFFFFF', borderRadius: '10px', textAlign: 'center',
    boxShadow: '0 1px 3px rgba(16,24,40,.08)', border: '1px solid #E3E8EA',
  };

  return (
    <div style={{ background: tokens.color.fondo, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={cardStyle}>
        {estado === 'cargando' && <div style={{ fontSize: '16px', color: tokens.color.textoSuave }}>Aceptando invitación...</div>}
        {estado === 'exito' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>¡Invitación aceptada!</h2>
            <p style={{ color: tokens.color.textoSuave, fontSize: '14px', marginBottom: '20px' }}>Ya sos miembro de la obra. Entrá para ver los detalles.</p>
            <button onClick={() => navigate('/obras')} style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>Ir a mis obras</button>
          </>
        )}
        {estado === 'expirada' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏰</div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Invitación expirada</h2>
            <p style={{ color: tokens.color.textoSuave, fontSize: '14px', marginBottom: '20px' }}>Las invitaciones vencen a los 14 días. Pedile al administrador que te reinvite.</p>
            <button onClick={() => navigate('/login')} style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>Volver al login</button>
          </>
        )}
        {estado === 'ya_procesada' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Invitación ya aceptada</h2>
            <p style={{ color: tokens.color.textoSuave, fontSize: '14px', marginBottom: '20px' }}>Esta invitación ya está activa. Entrá a tus obras.</p>
            <button onClick={() => navigate('/obras')} style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>Ir a mis obras</button>
          </>
        )}
        {estado === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Error</h2>
            <p style={{ color: tokens.color.textoSuave, fontSize: '14px', marginBottom: '20px' }}>{mensaje || 'No se pudo aceptar la invitación'}</p>
            <button onClick={() => navigate('/login')} style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>Volver al login</button>
          </>
        )}
      </div>
    </div>
  );
}
