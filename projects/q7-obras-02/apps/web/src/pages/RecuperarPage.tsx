import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui/tokens';

export function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/auth/recuperar', { email });
    setEnviado(true);
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: '400px', margin: '80px auto', padding: '32px',
    background: '#FFFFFF', borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(16,24,40,.08)', border: '1px solid #E3E8EA',
  };

  return (
    <div style={{ background: tokens.color.fondo, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={cardStyle}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: tokens.color.primario, marginBottom: '8px' }}>Recuperar contraseña</div>
        {enviado ? (
          <div style={{ fontSize: '14px', color: tokens.color.textoSuave }}>
            Si el email existe, te enviamos un enlace de recuperación. Revisá tu bandeja.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', marginBottom: '12px' }}
              type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <button type="submit" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Recuperar
            </button>
          </form>
        )}
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px' }}>
          <Link to="/login" style={{ color: tokens.color.primario, textDecoration: 'none' }}>Volver al login</Link>
        </div>
      </div>
    </div>
  );
}
