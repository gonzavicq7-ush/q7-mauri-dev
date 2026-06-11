import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui/tokens';
import { BadgeEstado, badgeType } from '@q7/ui';

interface Miembro {
  id: string;
  rol: string;
  estado: string;
  usuario?: { id: string; email: string; nombre: string; avatarUrl?: string };
  emailInvitado?: string;
}

export function EquipoPage() {
  const { obraId } = useParams();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('CONSTRUCTOR');
  const [loading, setLoading] = useState(false);
  const [showInvitar, setShowInvitar] = useState(false);

  const cargarMiembros = async () => {
    try { setMiembros(await api.get(`/obras/${obraId}/miembros`)); } catch {}
  };

  useEffect(() => { cargarMiembros(); }, [obraId]);

  const invitar = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post(`/obras/${obraId}/miembros`, { email: email.trim(), rol });
      setEmail(''); setShowInvitar(false);
      await cargarMiembros();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const revocar = async (id: string) => {
    if (!confirm('¿Estás seguro de revocar a este miembro?')) return;
    try { await api.delete(`/obras/${obraId}/miembros/${id}`); await cargarMiembros(); }
    catch (e: any) { alert(e.message); }
  };

  const reenviar = async (miembro: Miembro) => {
    try {
      await api.post(`/obras/${obraId}/miembros`, { email: miembro.emailInvitado || miembro.usuario?.email, rol: miembro.rol });
      alert('Invitación reenviada');
      await cargarMiembros();
    } catch (e: any) { alert(e.message); }
  };

  const rolBadge: Record<string, string> = {
    ADMIN_OBRA: 'Admin', COMITENTE: 'Comitente', PROFESIONAL: 'Pro', CONSTRUCTOR: 'Constructor', PROVEEDOR: 'Proveedor',
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Equipo</h1>
        <button onClick={() => setShowInvitar(!showInvitar)} style={{
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: tokens.color.primario, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>+ Invitar</button>
      </div>

      {showInvitar && (
        <div style={{ padding: '16px', marginBottom: '16px', background: '#FFFFFF', borderRadius: '10px', border: `1px solid ${tokens.color.borde}` }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
            <input style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px' }}
              type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <select style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', background: '#FFFFFF' }}
              value={rol} onChange={e => setRol(e.target.value)}>
              <option value="COMITENTE">Comitente</option>
              <option value="PROFESIONAL">Profesional</option>
              <option value="CONSTRUCTOR">Constructor</option>
              <option value="PROVEEDOR">Proveedor</option>
            </select>
            <button onClick={invitar} disabled={loading} style={{
              padding: '10px 16px', borderRadius: '10px', border: 'none',
              background: tokens.color.ok, color: '#FFFFFF', fontSize: '14px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}>Enviar</button>
          </div>
        </div>
      )}

      {/* Roles explicativos */}
      <div style={{ fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '16px', lineHeight: 1.6 }}>
        <strong>Admin:</strong> control total · <strong>Comitente:</strong> dueño de la obra · <strong>Profesional:</strong> arquitecto/ingeniero que supervisa · <strong>Constructor:</strong> solo ve sus propuestas y cobros · <strong>Proveedor:</strong> solo ve presupuestos propios
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {miembros.map(m => {
          const nombre = m.usuario?.nombre || m.emailInvitado || 'Pendiente';
          const emailDisplay = m.usuario?.email || m.emailInvitado || '';
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: '#FFFFFF', borderRadius: '10px',
              border: `1px solid ${tokens.color.borde}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: tokens.color.primario, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                  {(nombre[0] || '?').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{nombre}</div>
                  <div style={{ fontSize: '12px', color: tokens.color.textoSuave }}>{emailDisplay}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BadgeEstado type={badgeType(rolBadge, m.rol)}>{rolBadge[m.rol] || m.rol}</BadgeEstado>
                <BadgeEstado type={m.estado === 'ACTIVO' ? 'success' : 'warning'}>{m.estado}</BadgeEstado>
                {m.estado === 'PENDIENTE' && (
                  <button onClick={() => reenviar(m)} style={{ background: 'none', border: 'none', color: tokens.color.primario, fontSize: '12px', cursor: 'pointer' }}>
                    Reenviar
                  </button>
                )}
                {m.estado !== 'REVOCADO' && (
                  <button onClick={() => revocar(m.id)} style={{ background: 'none', border: 'none', color: tokens.color.peligro, fontSize: '12px', cursor: 'pointer' }}>
                    Revocar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
