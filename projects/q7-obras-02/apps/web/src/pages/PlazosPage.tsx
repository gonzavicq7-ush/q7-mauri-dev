/**
 * M5: Plazos y Avance — pantalla principal
 * /obras/:obraId/plazos
 *
 * Pestañas: Cronograma (Gantt) · Tabla · Curva
 * Drawer de tarea con registro de avance, días perdidos y finalización.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Tarjeta } from '@q7/ui';
import { BadgeEstado } from '@q7/ui';
import { BarraProgreso } from '@q7/ui';
import { ModalConfirmar } from '@q7/ui';
import { EstadoVacio } from '@q7/ui';
import { Boton } from '@q7/ui';

// ── Tipos ────────────────────────────────────────────────────────────────────

type EstadoTarea = 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA';

interface BarraGantt {
  tareaId: string;
  codigo: string;
  descripcion: string;
  nivel: number;
  rubroCodigo: string;
  prevInicio: string | null;
  prevFin: string | null;
  avanceInicio: string | null;
  avanceFin: string | null;
  perdidosInicio: string | null;
  perdidosFin: string | null;
  finNuevo: string | null;
  finReal: string | null;
  hoy: string;
  estado: string;
  avancePct: number;
  diasPerdidos: number;
}

interface TareaPlazo {
  id: string;
  codigo: string;
  descripcion: string;
  nivel: number;
  unidad: string;
  esHoja: boolean;
  fechaInicio: string | null;
  diasHabilesPrev: number | null;
  fechaFinPrevista: string | null;
  diasPerdidos: number;
  fechaFinNueva: string | null;
  fechaFinReal: string | null;
  avancePct: number;
  estado: string;
  barra: BarraGantt | null;
  rollupAvancePct?: number;
}

interface RubroData {
  rubroObraId: string;
  rubroCodigo: string;
  rubroNombre: string;
  avancePct: number;
  diasPerdidos: number;
  finProyectado: string | null;
  tareas: TareaPlazo[];
  curva: {
    puntos: { fecha: string; prevista: number; real: number }[];
    inicioObra: string;
    finObra: string;
  };
}

interface ResumenGlobal {
  inicioObra: string | null;
  finPrevistoObra: string | null;
  finProyectadoObra: string | null;
  avanceGlobalPct: number;
  demoraDias: number;
  diasPerdidosTotales: number;
  tareasTotal: number;
  tareasFinalizadas: number;
  tareasEnCurso: number;
  tareasPendientes: number;
}

interface RegistroAvance {
  id: string;
  fecha: string;
  avancePct: number;
  nota: string | null;
  fotoUrl: string | null;
  registradoPor: { id: string; nombre: string; avatarUrl?: string | null };
}

interface TareaDrawer {
  rubro: RubroData;
  tarea: TareaPlazo;
  historial: RegistroAvance[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR');
}

function fmtPct(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

// ── Componente: Gantt ────────────────────────────────────────────────────────

function GanttChart({ rubros, inicioObra }: { rubros: RubroData[]; inicioObra: string | null }) {
  const hoy = new Date().toISOString().split('T')[0];
  const inicio = inicioObra || hoy;

  // Calcular rango temporal
  const todasFechas: string[] = [inicio, hoy];
  for (const r of rubros) {
    for (const t of r.tareas) {
      if (t.barra) {
        if (t.barra.prevInicio) todasFechas.push(t.barra.prevInicio);
        if (t.barra.prevFin) todasFechas.push(t.barra.prevFin);
        if (t.barra.finNuevo) todasFechas.push(t.barra.finNuevo);
        if (t.barra.finReal) todasFechas.push(t.barra.finReal);
      }
    }
  }
  const minFecha = new Date(Math.min(...todasFechas.map(f => new Date(f).getTime())));
  const maxFecha = new Date(Math.max(...todasFechas.map(f => new Date(f).getTime())));
  const diasTotales = Math.max(1, Math.ceil((maxFecha.getTime() - minFecha.getTime()) / 86400000));

  const offsetToX = (fecha: string) => {
    const d = new Date(fecha).getTime();
    return Math.max(0, Math.round(((d - minFecha.getTime()) / 86400000 / diasTotales) * 1000));
  };

  const anchoBarra = (inicio: string, fin: string) => {
    const d1 = new Date(inicio).getTime();
    const d2 = new Date(fin).getTime();
    return Math.max(1, Math.round(((d2 - d1) / 86400000 / diasTotales) * 1000));
  };

  const hoyX = offsetToX(hoy);

  return (
    <div style={{ overflowX: 'auto', padding: '8px 0' }}>
      {/* Línea de tiempo superior */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-borde)', marginBottom: 8, paddingBottom: 4, fontSize: 11, color: 'var(--color-texto-suave)' }}>
        <span style={{ width: 180, flexShrink: 0 }}></span>
        {generarTicks(minFecha, maxFecha).map((tick, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>{tick}</div>
        ))}
      </div>

      {rubros.map(rubro => (
        <div key={rubro.rubroObraId}>
          {/* Header de rubro */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', background: 'var(--color-fondo)', borderRadius: 6, marginBottom: 2, fontWeight: 600, fontSize: 13 }}>
            <span style={{ width: 60 }}>{rubro.rubroCodigo}</span>
            <span style={{ flex: 1 }}>{rubro.rubroNombre}</span>
            <BarraProgreso valor={rubro.avancePct} max={100} alto={6} />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-texto-suave)' }}>{fmtPct(rubro.avancePct)}</span>
          </div>

          {/* Tareas */}
          {rubro.tareas.filter(t => t.esHoja).map(tarea => {
            const barra = tarea.barra;
            if (!barra) return null;
            return (
              <div key={tarea.id} style={{ display: 'flex', alignItems: 'center', height: 32, fontSize: 12, borderBottom: '1px solid var(--color-borde)', paddingLeft: 8 }}>
                <span style={{ width: 60, flexShrink: 0, color: 'var(--color-texto-suave)' }}>{tarea.codigo}</span>
                <span style={{ width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tarea.descripcion}>{tarea.descripcion}</span>
                <div style={{ flex: 1, position: 'relative', height: 20, marginLeft: 8 }}>
                  {/* Línea_hoy */}
                  <div style={{ position: 'absolute', left: `${hoyX / 10}px`, top: 0, bottom: 0, width: 1, background: '#D64545', zIndex: 10, opacity: 0.7 }} />

                  {/* Barra prevista (gris) */}
                  {barra.prevInicio && barra.prevFin && (
                    <div style={{
                      position: 'absolute',
                      left: `${offsetToX(barra.prevInicio) / 10}px`,
                      width: `${anchoBarra(barra.prevInicio, barra.prevFin) / 10}px`,
                      top: 2, bottom: 2,
                      background: '#E3E8EA',
                      borderRadius: 3,
                    }} />
                  )}

                  {/* Barra de avance (primaria) */}
                  {barra.avanceInicio && barra.avanceFin && (
                    <div style={{
                      position: 'absolute',
                      left: `${offsetToX(barra.avanceInicio) / 10}px`,
                      width: `${Math.max(3, anchoBarra(barra.avanceInicio, barra.avanceFin) / 10)}px`,
                      top: 2, bottom: 2,
                      background: 'var(--color-primario)',
                      borderRadius: 3,
                    }} />
                  )}

                  {/* Extensión días perdidos (ámbar rayado) */}
                  {barra.perdidosInicio && barra.perdidosFin && barra.diasPerdidos > 0 && (
                    <div style={{
                      position: 'absolute',
                      left: `${offsetToX(barra.perdidosInicio) / 10}px`,
                      width: `${anchoBarra(barra.perdidosInicio, barra.perdidosFin) / 10}px`,
                      top: 2, bottom: 2,
                      background: 'repeating-linear-gradient(45deg, #E5A50A, #E5A50A 3px, #F7C94B 3px, #F7C94B 6px)',
                      borderRadius: 3,
                      opacity: 0.8,
                    }} />
                  )}

                  {/* Fin real (badge) */}
                  {barra.finReal && (
                    <div style={{
                      position: 'absolute',
                      left: `${offsetToX(barra.finReal) / 10}px`,
                      top: -2,
                      background: '#2E9E5B',
                      color: '#fff',
                      fontSize: 9,
                      padding: '1px 3px',
                      borderRadius: 3,
                    }}>
                      ✓
                    </div>
                  )}

                  {/* Avance % sobre la barra */}
                  {barra.avancePct > 0 && (
                    <div style={{
                      position: 'absolute',
                      left: `${(offsetToX(barra.avanceInicio || inicio) + anchoBarra(barra.avanceInicio || inicio, barra.avanceFin || inicio) / 20) / 10}px`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 9,
                      color: '#fff',
                      fontWeight: 700,
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    }}>
                      {fmtPct(barra.avancePct)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function generarTicks(inicio: Date, fin: Date): string[] {
  const ticks: string[] = [];
  const cur = new Date(inicio);
  cur.setDate(cur.getDate() + Math.floor((fin.getTime() - inicio.getTime()) / 86400000 / 6));
  while (cur <= fin) {
    ticks.push(fmtDate(cur.toISOString().split('T')[0]));
    cur.setDate(cur.getDate() + Math.floor((fin.getTime() - inicio.getTime()) / 86400000 / 6));
  }
  return ticks;
}

// ── Componente: Tabla ────────────────────────────────────────────────────────

function TablaPlazos({ rubros, onSelectTarea }: { rubros: RubroData[]; onSelectTarea: (r: RubroData, t: TareaPlazo) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--color-fondo)' }}>
            {['Código', 'Descripción', 'Inicio', 'Días prev.', 'Fin previsto', 'Días perdidos', 'Fin nuevo', 'Avance', 'Estado'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-texto-suave)', borderBottom: '2px solid var(--color-borde)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rubros.map(rubro => (
            <React.Fragment key={rubro.rubroObraId}>
              {/* Fila rubro */}
              <tr style={{ background: 'var(--color-fondo)', fontWeight: 600 }}>
                <td colSpan={2} style={{ padding: '6px 10px' }}>
                  <span style={{ background: 'var(--color-primario)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 11, marginRight: 6 }}>
                    {rubro.rubroCodigo}
                  </span>
                  {rubro.rubroNombre}
                </td>
                <td style={{ padding: '6px 10px' }}>—</td>
                <td style={{ padding: '6px 10px' }}>—</td>
                <td style={{ padding: '6px 10px' }}>—</td>
                <td style={{ padding: '6px 10px', color: rubro.diasPerdidos > 0 ? '#D64545' : 'inherit' }}>{rubro.diasPerdidos > 0 ? `+${rubro.diasPerdidos}` : '0'}</td>
                <td style={{ padding: '6px 10px' }}>{fmtDate(rubro.finProyectado)}</td>
                <td style={{ padding: '6px 10px' }}>
                  <BarraProgreso valor={rubro.avancePct} max={100} alto={6} />
                  <span style={{ fontSize: 11, color: 'var(--color-texto-suave)' }}>{fmtPct(rubro.avancePct)}</span>
                </td>
                <td style={{ padding: '6px 10px' }}>—</td>
              </tr>
              {/* Filas tareas hoja */}
              {rubro.tareas.filter(t => t.esHoja).map(tarea => (
                <tr
                  key={tarea.id}
                  onClick={() => onSelectTarea(rubro, tarea)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-borde)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-fondo)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '6px 10px', color: 'var(--color-texto-suave)' }}>{tarea.codigo}</td>
                  <td style={{ padding: '6px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tarea.descripcion}>{tarea.descripcion}</td>
                  <td style={{ padding: '6px 10px' }}>{fmtDate(tarea.fechaInicio)}</td>
                  <td style={{ padding: '6px 10px' }}>{tarea.diasHabilesPrev ?? '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{fmtDate(tarea.fechaFinPrevista)}</td>
                  <td style={{ padding: '6px 10px', color: tarea.diasPerdidos > 0 ? '#D64545' : tarea.diasPerdidos < 0 ? '#2E9E5B' : 'var(--color-texto-suave)' }}>
                    {tarea.diasPerdidos !== 0 ? `${tarea.diasPerdidos > 0 ? '+' : ''}${tarea.diasPerdidos}` : '—'}
                  </td>
                  <td style={{ padding: '6px 10px' }}>{fmtDate(tarea.fechaFinNueva)}</td>
                  <td style={{ padding: '6px 10px', minWidth: 100 }}>
                    <BarraProgreso valor={tarea.avancePct} max={100} alto={6} />
                    <span style={{ fontSize: 11, color: 'var(--color-texto-suave)' }}>{fmtPct(tarea.avancePct)}</span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <BadgeEstado estado={tarea.estado as any} />
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Componente: Curva S ──────────────────────────────────────────────────────

function CurvaPlazos({ curvaGlobal, ordenesCambioDias }: {
  curvaGlobal: { puntos: { fecha: string; prevista: number; real: number }[]; inicioObra: string; finObra: string };
  ordenesCambioDias: { numero: number; titulo: string; impactoDias: number; fecha: string | null }[];
}) {
  const puntos = curvaGlobal.puntos;
  if (puntos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-texto-suave)' }}>
        Cargá fechas de inicio en las tareas para ver la curva de avance.
      </div>
    );
  }

  const maxY = 100;
  const altoSvg = 300;
  const anchoSvg = 800;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = anchoSvg - padding.left - padding.right;
  const chartH = altoSvg - padding.top - padding.bottom;

  const escalaX = (i: number) => padding.left + (i / (puntos.length - 1 || 1)) * chartW;
  const escalaY = (v: number) => padding.top + chartH - (v / maxY) * chartH;

  // Interpolar puntos para crear líneas
  const pathPrevista = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${escalaX(i)} ${escalaY(p.prevista)}`).join(' ');
  const pathReal = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${escalaX(i)} ${escalaY(p.real)}`).join(' ');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${anchoSvg} ${altoSvg}`} style={{ width: '100%', minWidth: 400 }}>
        {/* Grid */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={padding.left} y1={escalaY(v)} x2={anchoSvg - padding.right} y2={escalaY(v)} stroke="var(--color-borde)" strokeWidth={1} strokeDasharray={v === 0 ? 'none' : '4,4'} />
            <text x={padding.left - 8} y={escalaY(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-texto-suave)">{v}%</text>
          </g>
        ))}

        {/* Línea prevista */}
        <path d={pathPrevista} fill="none" stroke="#9CA3AF" strokeWidth={2.5} strokeDasharray="6,3" />

        {/* Área real */}
        <path
          d={`M ${escalaX(0)} ${escalaY(0)} ${pathReal} L ${escalaX(puntos.length - 1)} ${escalaY(0)} Z`}
          fill="var(--color-primario)"
          fillOpacity={0.1}
        />
        <path d={pathReal} fill="none" stroke="var(--color-primario)" strokeWidth={2.5} />

        {/* Puntos real */}
        {puntos.map((p, i) => (
          <circle key={i} cx={escalaX(i)} cy={escalaY(p.real)} r={4} fill="var(--color-primario)" />
        ))}

        {/* Labels eje X */}
        {puntos.filter((_, i) => i % Math.max(1, Math.floor(puntos.length / 8)) === 0).map((p, i, arr) => {
          const idxOriginal = puntos.findIndex(pp => pp === p);
          return (
            <text key={i} x={escalaX(idxOriginal)} y={altoSvg - 8} textAnchor="middle" fontSize={10} fill="var(--color-texto-suave)">
              {fmtDate(p.fecha)}
            </text>
          );
        })}

        {/* Anotaciones de OC */}
        {ordenesCambioDias.filter(oc => oc.fecha).map((oc, i) => {
          const idx = puntos.findIndex(p => p.fecha >= (oc.fecha || ''));
          if (idx < 0) return null;
          return (
            <g key={oc.numero}>
              <line x1={escalaX(idx)} y1={padding.top} x2={escalaX(idx)} y2={altoSvg - padding.bottom} stroke="#E5A50A" strokeWidth={1} strokeDasharray="4,4" />
              <text x={escalaX(idx) + 4} y={padding.top + 12 + i * 14} fontSize={9} fill="#E5A50A">
                OC#{oc.numero} {oc.impactoDias > 0 ? '+' : ''}{oc.impactoDias}d
              </text>
            </g>
          );
        })}

        {/* Leyenda */}
        <g transform={`translate(${anchoSvg - 180}, ${padding.top})`}>
          <line x1={0} y1={0} x2={20} y2={0} stroke="#9CA3AF" strokeWidth={2.5} strokeDasharray="6,3" />
          <text x={26} y={4} fontSize={11} fill="var(--color-texto-suave)">Prevista</text>
          <line x1={0} y1={16} x2={20} y2={16} stroke="var(--color-primario)" strokeWidth={2.5} />
          <text x={26} y={20} fontSize={11} fill="var(--color-texto)">Real</text>
        </g>
      </svg>
    </div>
  );
}

// ── Drawer de tarea ───────────────────────────────────────────────────────────

function DrawerTarea({ tarea, rubro, historial, onClose, onRefresh }: {
  tarea: TareaPlazo;
  rubro: RubroData;
  historial: RegistroAvance[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { obraId } = useParams<{ obraId: string }>();
  const [tab, setTab] = useState<'avance' | 'dias' | 'historial'>('avance');
  const [avance, setAvance] = useState(tarea.avancePct);
  const [nota, setNota] = useState('');
  const [diasInput, setDiasInput] = useState(0);
  const [motivoDias, setMotivoDias] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegistrarAvance = async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/obras/${obraId}/tareas/${tarea.id}/avance`, {
        avance_pct: avance,
        nota: nota || undefined,
      });
      setSuccess('Avance registrado');
      onRefresh();
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCargarDias = async () => {
    if (!obraId || !motivoDias.trim()) {
      setError('El motivo es obligatorio');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/obras/${obraId}/tareas/${tarea.id}/dias-perdidos`, {
        dias: diasInput,
        motivo: motivoDias,
      });
      setSuccess(`${diasInput >= 0 ? '+' : ''}${diasInput} días ${diasInput >= 0 ? 'perdidos' : 'recuperados'}`);
      onRefresh();
      setDiasInput(0);
      setMotivoDias('');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizar = async () => {
    if (!obraId) return;
    if (avance < 100) {
      setError('No se puede finalizar con avance menor a 100%');
      return;
    }
    const hoy = new Date().toISOString().split('T')[0];
    setLoading(true);
    setError(null);
    try {
      await api.post(`/obras/${obraId}/tareas/${tarea.id}/finalizar`, {
        fecha_fin_real: hoy,
      });
      setSuccess('Tarea finalizada');
      onRefresh();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '100vw',
      background: 'var(--color-superficie)', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-borde)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'var(--color-primario)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{tarea.codigo}</span>
            <BadgeEstado estado={tarea.estado as any} />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-texto)' }}>{tarea.descripcion}</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-texto-suave)', padding: 4 }}>×</button>
      </div>

      {/* Plazos summary */}
      <div style={{ padding: '12px 20px', background: 'var(--color-fondo)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        <div><span style={{ color: 'var(--color-texto-suave)' }}>Inicio: </span><strong>{fmtDate(tarea.fechaInicio)}</strong></div>
        <div><span style={{ color: 'var(--color-texto-suave)' }}>Días prev.: </span><strong>{tarea.diasHabilesPrev ?? '—'}</strong></div>
        <div><span style={{ color: 'var(--color-texto-suave)' }}>Fin previsto: </span><strong>{fmtDate(tarea.fechaFinPrevista)}</strong></div>
        <div><span style={{ color: 'var(--color-texto-suave)' }}>Días perdidos: </span><strong style={{ color: tarea.diasPerdidos > 0 ? '#D64545' : 'inherit' }}>{tarea.diasPerdidos !== 0 ? `${tarea.diasPerdidos > 0 ? '+' : ''}${tarea.diasPerdidos}` : '—'}</strong></div>
        <div><span style={{ color: 'var(--color-texto-suave)' }}>Fin nuevo: </span><strong>{fmtDate(tarea.fechaFinNueva)}</strong></div>
        <div><span style={{ color: 'var(--color-texto-suave)' }}>Avance: </span><strong>{fmtPct(tarea.avancePct)}</strong></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-borde)' }}>
        {(['avance', 'dias', 'historial'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--color-primario)' : '2px solid transparent',
            color: tab === t ? 'var(--color-primario)' : 'var(--color-texto-suave)', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>
            {t === 'avance' ? 'Avance' : t === 'dias' ? 'Días perdidos' : 'Historial'}
          </button>
        ))}
      </div>

      {/* Contenido tab */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {error && <div style={{ background: '#FEE2E2', color: '#D64545', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ background: '#D1FAE5', color: '#2E9E5B', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{success}</div>}

        {tab === 'avance' && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              Avance: {fmtPct(avance)}
            </label>
            <input type="range" min={0} max={100} step={5} value={avance}
              onChange={e => setAvance(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primario)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-texto-suave)', marginBottom: 16 }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
            <textarea
              placeholder="Nota (obligatoria si corrigés a la baja)..."
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: 8, border: '1px solid var(--color-borde)', borderRadius: 6, fontSize: 13, resize: 'vertical', marginBottom: 12, fontFamily: 'inherit' }}
            />
            <Boton variant="primario" onClick={handleRegistrarAvance} loading={loading} style={{ width: '100%' }}>
              Registrar avance
            </Boton>

            {tarea.estado !== 'FINALIZADA' && (
              <Boton variant="secundario" onClick={handleFinalizar} loading={loading} style={{ width: '100%', marginTop: 8 }}
                disabled={avance < 100}>
                Finalizar tarea
              </Boton>
            )}
          </div>
        )}

        {tab === 'dias' && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              Días perdidos/recuperados (puede ser negativo)
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setDiasInput(d => d - 1)} style={{ width: 36, height: 36, border: '1px solid var(--color-borde)', borderRadius: 6, background: 'var(--color-fondo)', cursor: 'pointer', fontSize: 18 }}>−</button>
              <input type="number" value={diasInput} onChange={e => setDiasInput(Number(e.target.value))}
                style={{ flex: 1, textAlign: 'center', padding: 8, border: '1px solid var(--color-borde)', borderRadius: 6, fontSize: 16, fontWeight: 700 }}
              />
              <button onClick={() => setDiasInput(d => d + 1)} style={{ width: 36, height: 36, border: '1px solid var(--color-borde)', borderRadius: 6, background: 'var(--color-fondo)', cursor: 'pointer', fontSize: 18 }}>+</button>
            </div>
            <input
              type="text"
              placeholder="Motivo (obligatorio)..."
              value={motivoDias}
              onChange={e => setMotivoDias(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid var(--color-borde)', borderRadius: 6, fontSize: 13, marginBottom: 12 }}
            />
            <Boton variant="primario" onClick={handleCargarDias} loading={loading} disabled={!motivoDias.trim()} style={{ width: '100%' }}>
              {diasInput >= 0 ? 'Sumar días perdidos' : 'Registrar recupero'}
            </Boton>
          </div>
        )}

        {tab === 'historial' && (
          <div>
            {historial.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-texto-suave)', padding: 20 }}>Sin registros de avance aún.</p>
            ) : (
              historial.map(r => (
                <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-borde)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 15, color: 'var(--color-primario)' }}>{fmtPct(r.avancePct)}</strong>
                    <span style={{ fontSize: 11, color: 'var(--color-texto-suave)' }}>{fmtDate(r.fecha)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-texto-suave)', marginBottom: r.nota ? 4 : 0 }}>
                    {r.registradoPor.nombre}
                  </div>
                  {r.nota && <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>"{r.nota}"</p>}
                  {r.fotoUrl && (
                    <img src={r.fotoUrl} alt="foto avance" style={{ marginTop: 6, width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 6 }} />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function PlazosPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenGlobal | null>(null);
  const [rubros, setRubros] = useState<RubroData[]>([]);
  const [curvaGlobal, setCurvaGlobal] = useState<any>(null);
  const [ocsDias, setOcsDias] = useState<any[]>([]);
  const [tab, setTab] = useState<'gantt' | 'tabla' | 'curva'>('gantt');
  const [drawer, setDrawer] = useState<TareaDrawer | null>(null);
  const [historialLoading, setHistorialLoading] = useState(false);

  const cargarPlazos = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/obras/${obraId}/plazos`);
      setResumen(data.resumen);
      setRubros(data.rubros);
      setCurvaGlobal(data.curvaGlobal);
      setOcsDias(data.ordenesCambioDias || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => { cargarPlazos(); }, [cargarPlazos]);

  const handleSelectTarea = async (rubro: RubroData, tarea: TareaPlazo) => {
    if (!obraId) return;
    setDrawer({ rubro, tarea, historial: [] });
    setHistorialLoading(true);
    try {
      const data = await api.get(`/obras/${obraId}/tareas/${tarea.id}/historial-avance`);
      setDrawer(prev => prev ? { ...prev, historial: data.registros } : null);
    } catch {
      // silently fail
    } finally {
      setHistorialLoading(false);
    }
  };

  const cerrarDrawer = () => setDrawer(null);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <span style={{ color: 'var(--color-texto-suave)' }}>Cargando plazos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <EstadoVacio titulo="Error al cargar plazos" descripcion={error} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header de la página */}
      <div style={{ padding: '20px 24px 0' }}>
        <h1 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 700 }}>Plazos y Avance</h1>

        {/* Cabecera con resumen */}
        {resumen && (
          <Tarjeta style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Inicio obra</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtDate(resumen.inicioObra)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Fin previsto</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtDate(resumen.finPrevistoObra)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Fin proyectado</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: resumen.diasPerdidosTotales > 0 ? '#D64545' : 'inherit' }}>
                  {fmtDate(resumen.finProyectadoObra)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Avance global</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarraProgreso valor={resumen.avanceGlobalPct} max={100} alto={10} />
                  <span style={{ fontSize: 16, fontWeight: 700, minWidth: 48 }}>{fmtPct(resumen.avanceGlobalPct)}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Demora acumulada</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: resumen.demoraDias > 0 ? '#FEE2E2' : '#D1FAE5',
                  color: resumen.demoraDias > 0 ? '#D64545' : '#2E9E5B',
                  padding: '4px 10px', borderRadius: 20, fontWeight: 700, fontSize: 14,
                }}>
                  {resumen.demoraDias > 0 ? `⚠ ${resumen.demoraDias} días` : 'A tiempo'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Tareas</div>
                <div style={{ fontSize: 13, color: 'var(--color-texto)' }}>
                  {resumen.tareasFinalizadas} finalizadas · {resumen.tareasEnCurso} en curso · {resumen.tareasPendientes} pendientes
                </div>
              </div>
            </div>
          </Tarjeta>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '2px solid var(--color-borde)', marginBottom: 0 }}>
        {([
          { key: 'gantt', label: 'Cronograma' },
          { key: 'tabla', label: 'Tabla' },
          { key: 'curva', label: 'Curva' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--color-primario)' : '2px solid transparent',
            color: tab === t.key ? 'var(--color-primario)' : 'var(--color-texto-suave)',
            fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ padding: '16px 24px' }}>
        {tab === 'gantt' && <GanttChart rubros={rubros} inicioObra={resumen?.inicioObra || null} />}
        {tab === 'tabla' && <TablaPlazos rubros={rubros} onSelectTarea={handleSelectTarea} />}
        {tab === 'curva' && curvaGlobal && <CurvaPlazos curvaGlobal={curvaGlobal} ordenesCambioDias={ocsDias} />}
      </div>

      {/* Drawer */}
      {drawer && (
        <>
          <div onClick={cerrarDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
          <DrawerTarea
            tarea={drawer.tarea}
            rubro={drawer.rubro}
            historial={drawer.historial}
            onClose={cerrarDrawer}
            onRefresh={() => { cargarPlazos(); cerrarDrawer(); }}
          />
        </>
      )}
    </div>
  );
}