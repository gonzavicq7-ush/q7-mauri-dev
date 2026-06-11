import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';
import { tokens } from '@q7/ui';

export function Shell() {
  const { user, obras, logout } = useAuth();
  const navigate = useNavigate();
  const [obraActiva, setObraActiva] = React.useState(obras[0]?.id || '');

  const style = {
    layout: { display: 'flex', minHeight: '100vh', background: tokens.color.fondo },
    sidebar: {
      width: '260px', background: tokens.color.superficie,
      borderRight: `1px solid ${tokens.color.borde}`,
      display: 'flex', flexDirection: 'column' as const,
    },
    main: { flex: 1, display: 'flex', flexDirection: 'column' as const },
    topbar: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', background: tokens.color.superficie,
      borderBottom: `1px solid ${tokens.color.borde}`,
    },
    content: { flex: 1, padding: '24px', maxWidth: tokens.contenedor, margin: '0 auto', width: '100%' },
    nav: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' },
    navItem: {
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
      borderRadius: '8px', fontSize: '14px', fontWeight: 500 as const,
      color: tokens.color.textoSuave, cursor: 'pointer', border: 'none', background: 'none',
      width: '100%', textAlign: 'left' as const,
    },
    navItemActive: { background: `${tokens.color.primario}15`, color: tokens.color.primario, fontWeight: 600 },
  };

  const navItems = [
    { label: 'Tablero', path: `/obras/${obraActiva}` },
    { label: 'Cómputo', path: `/obras/${obraActiva}/computo` },
    { label: 'Presupuestos', path: `/obras/${obraActiva}/presupuestos` },
    { label: 'Caja', path: `/obras/${obraActiva}/caja` },
    { label: 'Cambios', path: `/obras/${obraActiva}/cambios` },
    { label: 'Plazos', path: `/obras/${obraActiva}/plazos` },
    { label: 'Equipo', path: `/obras/${obraActiva}/equipo` },
  ];

  return (
    <div style={style.layout}>
      {/* Sidebar */}
      <div style={style.sidebar}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${tokens.color.borde}` }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: tokens.color.primario }}>q7-obras-02</div>
          <select
            value={obraActiva}
            onChange={e => setObraActiva(e.target.value)}
            style={{
              marginTop: '12px', width: '100%', padding: '8px', borderRadius: '8px',
              border: `1px solid ${tokens.color.borde}`, fontSize: '13px',
              background: tokens.color.fondo,
            }}
          >
            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </div>
        <div style={style.nav}>
          {navItems.map(item => {
            const active = window.location.pathname.includes(item.path.split('/')[3] || '') ||
              (item.label === 'Tablero' && window.location.pathname === `/obras/${obraActiva}`);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                style={{ ...style.navItem, ...(active ? style.navItemActive : {}) }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div style={style.main}>
        <div style={style.topbar}>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{obras.find(o => o.id === obraActiva)?.nombre || 'Obra'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: tokens.color.textoSuave }}>{user?.nombre}</span>
            <button onClick={() => { logout(); navigate('/login'); }}
              style={{ background: 'none', border: 'none', color: tokens.color.textoSuave, cursor: 'pointer', fontSize: '13px' }}>
              Salir
            </button>
          </div>
        </div>
        <div style={style.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
