import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui';

export function NuevaObraPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [paso, setPaso] = useState(1);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('VIVIENDA');
  const [pais, setPais] = useState('AR');
  const [moneda, setMoneda] = useState('ARS');
  const [superficie, setSuperficie] = useState('');
  const [invitados, setInvitados] = useState([{ email: '', rol: 'CONSTRUCTOR' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const agregarInvitado = () => setInvitados([...invitados, { email: '', rol: 'CONSTRUCTOR' }]);
  const quitarInvitado = (i: number) => setInvitados(invitados.filter((_, idx) => idx !== i));
  const actualizarInvitado = (i: number, campo: string, valor: string) => {
    const copy = [...invitados];
    (copy[i] as any)[campo] = valor;
    setInvitados(copy);
  };

  const handleCrear = async () => {
    setError(''); setLoading(true);
    try {
      const obra = await api.post('/obras', {
        nombre, tipo, pais, moneda_base: moneda,
        superficie_m2: superficie ? Number(superficie) : undefined,
      });
      // Invitar miembros
      for (const inv of invitados) {
        if (inv.email.trim()) {
          try { await api.post(`/obras/${obra.id}/miembros`, { email: inv.email.trim(), rol: inv.rol }); }
          catch { /* skip si falla */ }
        }
      }
      await refreshUser();
      navigate(`/obras/${obra.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px' };
  const selectStyle: React.CSSProperties = { ...inputStyle, background: '#FFFFFF' };

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Nueva obra</h1>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <span style={{ fontWeight: paso === 1 ? 700 : 400, color: paso === 1 ? tokens.color.primario : tokens.color.textoSuave }}>1. Datos</span>
        <span style={{ color: tokens.color.borde }}>→</span>
        <span style={{ fontWeight: paso === 2 ? 700 : 400, color: paso === 2 ? tokens.color.primario : tokens.color.textoSuave }}>2. Equipo</span>
      </div>

      {error && <div style={{ padding: '10px', borderRadius: '8px', background: '#FCE8E8', color: '#D64545', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '24px', border: `1px solid ${tokens.color.borde}` }}>
        {paso === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: tokens.color.textoSuave, display: 'block', marginBottom: '4px' }}>Nombre de la obra</label>
              <input style={inputStyle} placeholder="Ej: Casa Quinta 200m²" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: tokens.color.textoSuave, display: 'block', marginBottom: '4px' }}>Tipo</label>
                <select style={selectStyle} value={tipo} onChange={e => setTipo(e.target.value)}>
                  <option value="VIVIENDA">Vivienda</option>
                  <option value="REFORMA">Reforma</option>
                  <option value="COMERCIO">Comercio</option>
                  <option value="CONDOMINIO">Condominio</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: tokens.color.textoSuave, display: 'block', marginBottom: '4px' }}>Moneda base</label>
                <select style={selectStyle} value={moneda} onChange={e => setMoneda(e.target.value)}>
                  <option value="ARS">ARS - Peso argentino</option>
                  <option value="USD">USD - Dólar</option>
                  <option value="PYG">PYG - Guaraní</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: tokens.color.textoSuave, display: 'block', marginBottom: '4px' }}>Superficie (m²) — opcional</label>
              <input style={inputStyle} type="number" placeholder="200" value={superficie} onChange={e => setSuperficie(e.target.value)} />
            </div>
            <button onClick={() => setPaso(2)} disabled={!nombre.trim()} style={{
              padding: '10px 20px', borderRadius: '10px', border: 'none', background: tokens.color.primario,
              color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: nombre.trim() ? 'pointer' : 'not-allowed',
              opacity: nombre.trim() ? 1 : 0.5, marginTop: '8px',
            }}>Siguiente</button>
          </div>
        )}

        {paso === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: tokens.color.textoSuave }}>¿Quién más participa? Podés invitar ahora o más tarde.</p>
            {invitados.map((inv, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '11px', color: tokens.color.textoSuave, display: 'block', marginBottom: '2px' }}>Email</label>
                  <input style={inputStyle} placeholder="Email" value={inv.email} onChange={e => actualizarInvitado(i, 'email', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: tokens.color.textoSuave, display: 'block', marginBottom: '2px' }}>Rol</label>
                  <select style={selectStyle} value={inv.rol} onChange={e => actualizarInvitado(i, 'rol', e.target.value)}>
                    <option value="COMITENTE">Comitente</option>
                    <option value="PROFESIONAL">Profesional</option>
                    <option value="CONSTRUCTOR">Constructor</option>
                    <option value="PROVEEDOR">Proveedor</option>
                  </select>
                </div>
                <button onClick={() => quitarInvitado(i)} style={{ background: 'none', border: 'none', color: tokens.color.peligro, fontSize: '13px', cursor: 'pointer', paddingBottom: '10px' }}>✕</button>
              </div>
            ))}
            <button onClick={agregarInvitado} style={{ background: 'none', border: `1px dashed ${tokens.color.borde}`, borderRadius: '8px', padding: '10px', fontSize: '13px', color: tokens.color.textoSuave, cursor: 'pointer' }}>+ Agregar persona</button>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setPaso(1)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${tokens.color.borde}`, background: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Volver</button>
              <button onClick={handleCrear} disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Creando...' : 'Crear obra'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
