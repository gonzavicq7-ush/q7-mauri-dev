/**
 * M6: Tablero de obra — LA CARA DEL PRODUCTO
 * /obras/:obraId (ruta raíz de la obra)
 *
 * 6 bloques con error boundaries individuales.
 * Consume GET /api/v1/obras/:obraId/tablero
 * Recorte por rol server-side; frontend solo renderiza lo que llega.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui/tokens';
import { Tarjeta } from '@q7/ui';
import { Dinero } from '@q7/ui';
import { Semaforo } from '@q7/ui';
import { Boton } from '@q7/ui';
import { Avatar } from '@q7/ui';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CifrasMaestras {
  previsto: number;
  comprometido: number;
  pagado: number;
  proyeccion: number;
  semaforo: 'verde' | 'ambar' | 'rojo';
  delta_vs_objetivo?: number;
  _error?: string;
}

interface AccionItem {
  tipo: string;
  titulo: string;
  descripcion: string;
  link: string;
  urgencia: 'alta' | 'media' | 'baja';
}

interface AvanceData {
  pct_global: number;
  fin_previsto: string | null;
  fin_proyectado: string | null;
  dias_demora: number;
  curva_mini: { semana: string; pct: number }[];
  _error?: string;
}

interface DesvioItem {
  rubro: string;
  rubroId: string;
  previsto: number;
  ejecutado: number;
  desvio_pct: number | null;
  semaforo: 'verde' | 'ambar' | 'rojo';
}

interface ActividadItem {
  id: string;
  tipo: string;
  resumen_humano: string;
  fecha: string;
  fecha_relativa: string;
  avatar: string | null;
  usuario_nombre: string;
  foto_url: string | null;
}

interface TableroPayload {
  obra: { id: string; nombre: string; moneda: string };
  rol: string;
  cifras_maestras: CifrasMaestras;
  necesita_accion: AccionItem[];
  avance: AvanceData;
  desvios: DesvioItem[];
  actividad: ActividadItem[];
}

interface TableroState {
  data: TableroPayload | null;
  loading: boolean;
  error: string | null;
}

// ── Error Boundary genérico por bloque ───────────────────────────────────────

class BlockErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '16px',
          background: '#FCE8E8',
          borderRadius: '8px',
          color: '#D64545',
          fontSize: '13px',
        }}>
          ⚠️ No se pudo cargar "{this.props.name}". Intentá recargar.
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function fmtNumero(n: number): string {
  return n.toLocaleString('es-AR');
}

// Mini sparkline SVG
function Sparkline({ data }: { data: { semana: string; pct: number }[] }) {
  if (!data || data.length === 0) return null;
  const valores = data.map(d => d.pct);
  const min = 0;
  const max = 100;
  const w = 120;
  const h = 32;
  const paso = w / (valores.length - 1);

  const puntos = valores.map((v, i) => {
    const x = i * paso;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline
        points={puntos}
        fill="none"
        stroke={tokens.color.primario}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Bloque: Cifras Maestras ────────────────────────────────────────────────────

function BlockCifrasMaestras({ cifras, moneda }: { cifras: CifrasMaestras; moneda: string }) {
  const style = {
    wrapper: {
      background: tokens.color.superficie,
      borderRadius: '12px',
      padding: '24px',
      border: `1px solid ${tokens.color.borde}`,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '20px',
    },
    titulo: {
      fontSize: '13px',
      fontWeight: 600,
      color: tokens.color.textoSuave,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    },
    projeccionBox: {
      textAlign: 'right' as const,
    },
    labelProyeccion: {
      fontSize: '12px',
      color: tokens.color.textoSuave,
      marginBottom: '2px',
    },
    valorProyeccion: {
      fontSize: '28px',
      fontWeight: 700,
      color: tokens.color.primario,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px',
      marginTop: '16px',
    },
    cifra: {
      background: tokens.color.fondo,
      borderRadius: '8px',
      padding: '12px 16px',
    },
    cifraLabel: {
      fontSize: '11px',
      color: tokens.color.textoSuave,
      marginBottom: '4px',
    },
    cifraValor: {
      fontSize: '18px',
      fontWeight: 600,
      color: tokens.color.texto,
    },
    barraWrapper: {
      marginTop: '20px',
    },
    barraLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '12px',
      color: tokens.color.textoSuave,
      marginBottom: '8px',
    },
    barra: {
      height: '8px',
      borderRadius: '4px',
      background: '#E3E8EA',
      overflow: 'hidden',
      display: 'flex',
    },
    deltaBadge: {
      marginTop: '12px',
      fontSize: '12px',
      color: '#D64545',
    },
  };

  const semaforoColor = {
    verde: '#2E9E5B',
    ambar: '#E5A50A',
    rojo: '#D64545',
  }[cifras.semaforo];

  const pagadorPct = cifras.previsto > 0 ? Math.min((cifras.pagado / cifras.previsto) * 100, 100) : 0;
  const comprometidoPct = cifras.previsto > 0 ? Math.min((cifras.comprometido / cifras.previsto) * 100, 100) : 0;
  const restantPct = Math.max(0, 100 - pagadorPct - comprometidoPct);

  return (
    <div style={style.wrapper}>
      <div style={style.header}>
        <div>
          <div style={style.titulo}>Cifras maestras</div>
          <Semaforo previsto={cifras.previsto} actual={cifras.pagado} showLabel />
        </div>
        <div style={style.projeccionBox}>
          <div style={style.labelProyeccion}>Proyección final</div>
          <div
            style={style.valorProyeccion}
            aria-label={`Proyección final ${fmtNumero(cifras.proyeccion)} ${moneda}`}
          >
            <Dinero monto={cifras.proyeccion} moneda={moneda as any} />
          </div>
        </div>
      </div>

      <div style={style.grid}>
        <div style={style.cifra}>
          <div style={style.cifraLabel}>Previsto</div>
          <div style={style.cifraValor} aria-label={`Previsto ${fmtNumero(cifras.previsto)} ${moneda}`}>
            <Dinero monto={cifras.previsto} moneda={moneda as any} />
          </div>
        </div>
        <div style={style.cifra}>
          <div style={style.cifraLabel}>Comprometido</div>
          <div style={style.cifraValor} aria-label={`Comprometido ${fmtNumero(cifras.comprometido)} ${moneda}`}>
            <Dinero monto={cifras.comprometido} moneda={moneda as any} />
          </div>
        </div>
        <div style={style.cifra}>
          <div style={style.cifraLabel}>Pagado</div>
          <div style={style.cifraValor} aria-label={`Pagado ${fmtNumero(cifras.pagado)} ${moneda}`}>
            <Dinero monto={cifras.pagado} moneda={moneda as any} />
          </div>
        </div>
        <div style={style.cifra}>
          <div style={style.cifraLabel}>Semáforo</div>
          <div style={{ ...style.cifraValor, color: semaforoColor, textTransform: 'capitalize' }}>
            {cifras.semaforo}
          </div>
        </div>
      </div>

      <div style={style.barraWrapper}>
        <div style={style.barraLabel}>
          <span>Ejecución del presupuesto</span>
          <span>{Math.round(pagadorPct + comprometidoPct)}%</span>
        </div>
        <div style={style.barra} aria-label={`Ejecutado ${Math.round(pagadorPct + comprometidoPct)}%`}>
          <div style={{ width: `${pagadorPct}%`, background: '#2E9E5B', transition: 'width 0.3s' }} />
          <div style={{ width: `${comprometidoPct}%`, background: '#E5A50A', transition: 'width 0.3s' }} />
          {restantPct > 0 && <div style={{ flex: 1, background: '#E3E8EA' }} />}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', color: tokens.color.textoSuave }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2E9E5B', display: 'inline-block' }} />
            Pagado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E5A50A', display: 'inline-block' }} />
            Comprometido
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E3E8EA', display: 'inline-block' }} />
            Restante
          </span>
        </div>
      </div>

      {cifras.delta_vs_objetivo !== undefined && cifras.delta_vs_objetivo !== null && (
        <div style={style.deltaBadge}>
          {cifras.delta_vs_objetivo > 0
            ? `↑ +${fmtNumero(cifras.delta_vs_objetivo)} vs objetivo`
            : `↓ ${fmtNumero(cifras.delta_vs_objetivo)} vs objetivo`}
        </div>
      )}
    </div>
  );
}

// ── Bloque: Necesita tu acción ─────────────────────────────────────────────────

function BlockNecesitaAccion({ acciones, obraId }: { acciones: AccionItem[]; obraId: string }) {
  const navigate = useNavigate();

  if (!acciones || acciones.length === 0) return null;

  const style = {
    wrapper: {
      background: tokens.color.superficie,
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${tokens.color.borde}`,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px',
    },
    badge: {
      background: '#FCE8E8',
      color: '#D64545',
      borderRadius: '20px',
      padding: '2px 10px',
      fontSize: '12px',
      fontWeight: 600,
    },
    cards: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '12px',
    },
    card: {
      padding: '14px',
      borderRadius: '8px',
      border: '1px solid #E3E8EA',
      background: tokens.color.fondo,
      cursor: 'pointer',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    },
    cardTitulo: {
      fontSize: '13px',
      fontWeight: 600,
      color: tokens.color.texto,
      marginBottom: '4px',
    },
    cardDesc: {
      fontSize: '12px',
      color: tokens.color.textoSuave,
      marginBottom: '10px',
    },
    urgenciaAlta: { color: '#D64545' },
    urgenciaMedia: { color: '#E5A50A' },
    urgenciaBaja: { color: '#2E9E5B' },
  };

  const urgenciaStyle = (u: string) => ({
    alta: style.urgenciaAlta,
    media: style.urgenciaMedia,
    baja: style.urgenciaBaja,
  }[u as keyof typeof style] || style.urgenciaMedia);

  return (
    <div style={style.wrapper}>
      <div style={style.header}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Necesita tu acción</span>
        <span style={style.badge}>{acciones.length}</span>
      </div>
      <div style={style.cards}>
        {acciones.map((acc, idx) => (
          <div
            key={idx}
            style={style.card}
            onClick={() => navigate(acc.link)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(acc.link)}
          >
            <div style={style.cardTitulo}>{acc.titulo}</div>
            <div style={style.cardDesc}>{acc.descripcion}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...urgenciaStyle(acc.urgencia), fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                {acc.urgencia}
              </span>
              <span style={{ fontSize: '12px', color: tokens.color.primario, fontWeight: 500 }}>
                Ver →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bloque: Avance de obra ──────────────────────────────────────────────────────

function BlockAvance({ avance }: { avance: AvanceData }) {
  const style = {
    wrapper: {
      background: tokens.color.superficie,
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${tokens.color.borde}`,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
    },
    pctBig: {
      fontSize: '36px',
      fontWeight: 700,
      color: tokens.color.primario,
    },
    labelPct: {
      fontSize: '12px',
      color: tokens.color.textoSuave,
    },
    meta: {
      display: 'flex',
      gap: '16px',
      marginTop: '12px',
      fontSize: '13px',
    },
    metaItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '2px',
    },
    demoraBadge: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      marginTop: '4px',
    },
  };

  const demoraColor = avance.dias_demora > 0 ? '#D64545' : '#2E9E5B';
  const demoraBg = avance.dias_demora > 0 ? '#FCE8E8' : '#E6F7EE';

  return (
    <div style={style.wrapper}>
      <div style={style.header}>
        <div>
          <div style={style.pctBig} aria-label={`Avance global ${avance.pct_global}%`}>
            {avance.pct_global}%
          </div>
          <div style={style.labelPct}>Avance global</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Sparkline data={avance.curva_mini} />
          <div style={{ fontSize: '11px', color: tokens.color.textoSuave, marginTop: '4px' }}>últimas 8 semanas</div>
        </div>
      </div>

      <div style={style.meta}>
        <div style={style.metaItem}>
          <span style={{ color: tokens.color.textoSuave, fontSize: '11px' }}>Termina el (plan)</span>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{fmtFecha(avance.fin_previsto)}</span>
        </div>
        {avance.fin_proyectado && (
          <div style={style.metaItem}>
            <span style={{ color: tokens.color.textoSuave, fontSize: '11px' }}>Proyectado</span>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>{fmtFecha(avance.fin_proyectado)}</span>
          </div>
        )}
        <div style={style.metaItem}>
          <span style={{ color: tokens.color.textoSuave, fontSize: '11px' }}>Demora</span>
          <span
            style={{ ...style.demoraBadge, background: demoraBg, color: demoraColor }}
            aria-label={avance.dias_demora > 0 ? `${avance.dias_demora} días de demora` : 'En tiempo'}
          >
            {avance.dias_demora > 0 ? `+${avance.dias_demora} días` : 'En tiempo'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Bloque: Desvíos ────────────────────────────────────────────────────────────

function BlockDesvios({ desvios, obraId }: { desvios: DesvioItem[]; obraId: string }) {
  const navigate = useNavigate();

  if (!desvios || desvios.length === 0) return null;

  const style = {
    wrapper: {
      background: tokens.color.superficie,
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${tokens.color.borde}`,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
    },
    th: {
      textAlign: 'left' as const,
      fontSize: '11px',
      color: tokens.color.textoSuave,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      padding: '8px 0',
      borderBottom: `1px solid ${tokens.color.borde}`,
    },
    td: {
      fontSize: '13px',
      padding: '10px 0',
      borderBottom: `1px solid ${tokens.color.borde}`,
      color: tokens.color.texto,
    },
    verLink: {
      fontSize: '12px',
      color: tokens.color.primario,
      cursor: 'pointer',
      textDecoration: 'none',
    },
  };

  return (
    <div style={style.wrapper}>
      <div style={style.header}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Desvíos por rubro</span>
        <span
          style={style.verLink}
          onClick={() => navigate(`/obras/${obraId}/caja`)}
        >
          Ver caja completa →
        </span>
      </div>
      <table style={style.table}>
        <thead>
          <tr>
            <th style={style.th}>Rubro</th>
            <th style={{ ...style.th, textAlign: 'right' }}>Previsto</th>
            <th style={{ ...style.th, textAlign: 'right' }}>Ejecutado</th>
            <th style={{ ...style.th, textAlign: 'right' }}>Desvío</th>
            <th style={{ ...style.th, textAlign: 'center' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {desvios.map((d, idx) => (
            <tr key={idx}>
              <td style={{ ...style.td, fontWeight: 500 }}>{d.rubro}</td>
              <td style={{ ...style.td, textAlign: 'right' }}>
                <Dinero monto={d.previsto} moneda="ARS" />
              </td>
              <td style={{ ...style.td, textAlign: 'right' }}>
                <Dinero monto={d.ejecutado} moneda="ARS" />
              </td>
              <td
                style={{
                  ...style.td,
                  textAlign: 'right',
                  color: d.desvio_pct && Math.abs(d.desvio_pct) > 10 ? '#D64545' : tokens.color.texto,
                  fontWeight: d.desvio_pct && Math.abs(d.desvio_pct) > 10 ? 600 : 400,
                }}
                aria-label={`Desvío ${d.desvio_pct !== null ? Math.round(d.desvio_pct) : 0}%`}
              >
                {d.desvio_pct !== null ? `${d.desvio_pct > 0 ? '+' : ''}${Math.round(d.desvio_pct)}%` : '—'}
              </td>
              <td style={{ ...style.td, textAlign: 'center' }}>
                <Semaforo previsto={d.previsto} actual={d.ejecutado} showLabel={false} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Bloque: Actividad reciente ─────────────────────────────────────────────────

function BlockActividad({ actividad, obraId }: { actividad: ActividadItem[]; obraId: string }) {
  const navigate = useNavigate();

  if (!actividad || actividad.length === 0) return null;

  const style = {
    wrapper: {
      background: tokens.color.superficie,
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${tokens.color.borde}`,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
    },
    list: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0',
    },
    item: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '10px 0',
      borderBottom: `1px solid ${tokens.color.borde}`,
    },
    itemContent: {
      flex: 1,
    },
    itemResumen: {
      fontSize: '13px',
      color: tokens.color.texto,
      lineHeight: '1.4',
    },
    itemMeta: {
      display: 'flex',
      gap: '8px',
      marginTop: '4px',
      fontSize: '12px',
      color: tokens.color.textoSuave,
    },
    verLink: {
      fontSize: '12px',
      color: tokens.color.primario,
      cursor: 'pointer',
      textDecoration: 'none',
    },
  };

  // Icono por tipo de evento
  const iconoPorTipo: Record<string, string> = {
    'obra.creada': '🏗️',
    'miembro.invitado': '📧',
    'miembro.activado': '✅',
    'computo.tarea_creada': '📋',
    'presupuesto.creado': '📄',
    'presupuesto.adoptado_rubro': '🎯',
    'caja.compromiso_registrado': '💰',
    'caja.pago_registrado': '💸',
    'caja.desvio_detectado': '⚠️',
    'oc.creada': '📝',
    'oc.enviada': '📤',
    'oc.aprobada': '👍',
    'oc.rechazada': '👎',
    'plazos.avance_registrado': '📊',
    'plazos.tarea_finalizada': '🏁',
    'reporte.generado': '📈',
    'reporte.enviado': '📬',
  };

  return (
    <div style={style.wrapper}>
      <div style={style.header}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Actividad reciente</span>
        <span
          style={style.verLink}
          onClick={() => navigate(`/obras/${obraId}/actividad`)}
        >
          Ver todo →
        </span>
      </div>
      <div style={style.list}>
        {actividad.map((ev) => (
          <div key={ev.id} style={style.item}>
            <Avatar nombre={ev.usuario_nombre} url={ev.avatar} size="sm" />
            <div style={style.itemContent}>
              <div style={style.itemResumen}>
                <span style={{ marginRight: '6px' }}>{iconoPorTipo[ev.tipo] || '📌'}</span>
                {ev.resumen_humano}
              </div>
              <div style={style.itemMeta}>
                <span>{ev.usuario_nombre}</span>
                <span>·</span>
                <span>{ev.fecha_relativa}</span>
                {ev.foto_url && <span>· 📷</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function Skeleton({ height = 120 }: { height?: number }) {
  return (
    <div style={{
      height: `${height}px`,
      background: `linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '12px',
    }} />
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function TableroPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const [state, setState] = useState<TableroState>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!obraId) return;

    setState(s => ({ ...s, loading: true, error: null }));

    api.get(`/obras/${obraId}/tablero`)
      .then((data: TableroPayload) => {
        setState({ data, loading: false, error: null });
      })
      .catch((err: any) => {
        setState({ data: null, loading: false, error: err.message || 'Error al cargar el tablero' });
      });
  }, [obraId]);

  const style = {
    page: {
      maxWidth: '1200px',
      margin: '0 auto',
    },
    titulo: {
      fontSize: '20px',
      fontWeight: 700,
      color: tokens.color.texto,
      marginBottom: '24px',
    },
    blocksWrapper: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      marginBottom: '16px',
    },
    fullWidth: {
      marginBottom: '16px',
    },
    errorMsg: {
      padding: '20px',
      background: '#FCE8E8',
      borderRadius: '8px',
      color: '#D64545',
      fontSize: '14px',
    },
  };

  if (state.loading) {
    return (
      <div style={style.page}>
        <div style={style.titulo}>Tablero de obra</div>
        <Skeleton height={160} />
        <div style={{ height: '16px' }} />
        <div style={style.blocksWrapper}>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
        <Skeleton height={200} />
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={style.page}>
        <div style={style.titulo}>Tablero de obra</div>
        <div style={style.errorMsg}>⚠️ {state.error}</div>
      </div>
    );
  }

  const { data } = state;
  if (!data) return null;

  const moneda = data.obra.moneda;

  return (
    <div style={style.page}>
      <div style={style.titulo}>{data.obra.nombre}</div>

      {/* Bloque 1: Cifras maestras (full width) */}
      <div style={style.fullWidth}>
        <BlockErrorBoundary name="Cifras maestras">
          <BlockCifrasMaestras cifras={data.cifras_maestras} moneda={moneda} />
        </BlockErrorBoundary>
      </div>

      {/* Bloque 2: Necesita tu acción (full width) */}
      {data.necesita_accion.length > 0 && (
        <div style={style.fullWidth}>
          <BlockErrorBoundary name="Necesita tu acción">
            <BlockNecesitaAccion acciones={data.necesita_accion} obraId={obraId!} />
          </BlockErrorBoundary>
        </div>
      )}

      {/* Bloques 3 y 4: Avance + Desvíos */}
      <div style={style.blocksWrapper}>
        <BlockErrorBoundary name="Avance de obra">
          <BlockAvance avance={data.avance} />
        </BlockErrorBoundary>
        <BlockErrorBoundary name="Desvíos por rubro">
          <BlockDesvios desvios={data.desvios} obraId={obraId!} />
        </BlockErrorBoundary>
      </div>

      {/* Bloque 5: Actividad reciente (full width) */}
      <div style={style.fullWidth}>
        <BlockErrorBoundary name="Actividad reciente">
          <BlockActividad actividad={data.actividad} obraId={obraId!} />
        </BlockErrorBoundary>
      </div>

      {/* Footer: generar reporte */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Boton
          variante="secundario"
          onClick={() => {
            api.post(`/obras/${obraId}/reportes/generar`).then(() => {
              alert('Reporte generado');
            }).catch(() => {
              alert('Error al generar reporte');
            });
          }}
        >
          📊 Generar reporte semanal
        </Boton>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}