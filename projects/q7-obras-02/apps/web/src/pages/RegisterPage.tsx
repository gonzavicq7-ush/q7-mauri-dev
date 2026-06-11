import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';
import { tokens } from '@q7/ui/tokens';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await register(email, nombre, password); navigate('/obras'); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: '400px', margin: '80px auto', padding: '32px',
    background: '#FFFFFF', borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(16,24,40,.08)', border: '1px solid #E3E8EA',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: `1px solid ${tokens.color.borde}`, fontSize: '14px', marginBottom: '12px',
  };

  return (
    <div style={{ background: tokens.color.fondo, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: tokens.color.primario }}>q7-obras-02</div>
          <div style={{ fontSize: '14px', color: tokens.color.textoSuave, marginTop: '4px' }}>Creá tu cuenta gratis</div>
        </div>
        {error && <div style={{ padding: '10px', borderRadius: '8px', background: '#FCE8E8', color: '#D64545', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input style={inputStyle} type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required />
          <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={inputStyle} type="password" placeholder="Contraseña (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
            background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Creando...' : 'Crear cuenta'}</button>
        </form>
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: tokens.color.textoSuave }}>
          ¿Ya tenés cuenta? <Link to="/login" style={{ color: tokens.color.primario, textDecoration: 'none' }}>Entrar</Link>
        </div>
      </div>
    </div>
  );
}
