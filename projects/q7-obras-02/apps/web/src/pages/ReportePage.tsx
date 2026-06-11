/**
 * M6: Vista web del reporte semanal
 * /obras/:obraId/reportes/:reporteId
 *
 * Documento limpio, imprimible, con fotos de la semana.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui';
import { Dinero } from '@q7/ui';
import { Semaforo } from '@q7/ui';
import { Boton } from '@q7/ui';
import { Tarjeta } from '@q7/ui';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ContenidoReporte {
  semana: { desde: string; hasta: string };
  resumen_ejecutivo: string;
  cifras: {
    previsto: number;
    comprometido: number;
    pagado: number;
    proyeccion: number;
    delta_semana_pagado: number;
  };
  avance: {
    pct_actual: number;
    pct_semana_anterior: number;
    tareas_finalizadas: string[];
    fotos: string[];
  };
  desvios: { rubro: string; previsto: number; ejecutado: number; pct: number }[];
  cambios: { aprobadas: string[]; pendientes: string[] };
  proxima_semana: { tarea: string; fecha_inicio: string }[];
  pendientes_accion: { tipo: string; titulo: string; descripcion: string; link: string }[];
}

interface ReporteResponse {
  id: string;
  obra_id: string;
  semana_inicio: string;
  generado_en: string;
  enviado: boolean;
  contenido: ContenidoReporte;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateFull(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Componente principal ───────────────────────────────────────────────────────

export function ReportePage() {
  const { obraId, reporteId } = useParams<{ obraId: string; reporteId: string }>();
  const [reporte, setReporte] = useState<ReporteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!obraId || !reporteId) return;
    setLoading(true);
    api.get(`/obras/${obraId}/reportes/${reporteId}`)
      .then((data: ReporteResponse) => {
        setReporte(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Error al cargar el reporte');
        setLoading(false);
      });
  }, [obraId, reporteId]);

  const style = {
    page: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '24px',
    },
    printBtn: {
      position: 'fixed' as const,
      top: '20px',
      right: '20px',
      zIndex: 100,
    },
    doc: {
      background: '#FFFFFF',
      borderRadius: '12px',
      border: `1px solid ${tokens.color.borde}`,
      overflow: 'hidden',
    },
    header: {
      background: tokens.color.primario,
      color: '#FFFFFF',
      padding: '32px',
    },
    headerTitulo: {
      fontSize: '24px',
      fontWeight: 700,
      marginBottom: '8px',
    },
    headerMeta: {
      fontSize: '14px',
      opacity: 0.9,
    },
    section: {
      padding: '28px 32px',
      borderBottom: `1px solid ${tokens.color.borde}`,
    },
    sectionTitle: {
      fontSize: '12px',
      fontWeight: 600,
      color: tokens.color.textoSuave,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      marginBottom: '16px',
    },
    resumenEjecutivo: {
      fontSize: '16px',
      lineHeight: 1.6,
      color: tokens.color.texto,
      background: tokens.color.fondo,
      padding: '20px',
      borderRadius: '8px',
      borderLeft: `4px solid ${tokens.color.primario}`,
    },
    cifrasGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px',
    },
    cifraCard: {
      textAlign: 'center' as const,
      padding: '16px',
      background: tokens.color.fondo,
      borderRadius: '8px',
    },
    cifraValor: {
      fontSize: '22px',
      fontWeight: 700,
      color: tokens.color.texto,
    },
    cifraLabel: {
      fontSize: '11px',
      color: tokens.color.textoSuave,
      marginTop: '4px',
    },
    avanceBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
    },
    avancePct: {
      fontSize: '48px',
      fontWeight: 700,
      color: tokens.color.primario,
    },
    barra: {
      flex: 1,
      height: '12px',
      background: '#E3E8EA',
      borderRadius: '6px',
      overflow: 'hidden',
    },
    progresoBar: {
      height: '100%',
      background: tokens.color.primario,
      borderRadius: '6px',
      transition: 'width 0.3s',
    },
    fotosGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '12px',
    },
    foto: {
      width: '100%',
      aspectRatio: '16/9',
      objectFit: 'cover' as const,
      borderRadius: '8px',
      border: `1px solid ${tokens.color.borde}`,
    },
    lista: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px',
    },
    listaItem: {
      fontSize: '13px',
      color: tokens.color.texto,
      padding: '8px 12px',
      background: tokens.color.fondo,
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    desviosTable: {
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
    },
    badgeAprobada: {
      background: '#E6F7EE',
      color: '#2E9E5B',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
    },
    badgePendiente: {
      background: '#FDF3DC',
      color: '#E5A50A',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
    },
    enviadoBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
    },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <span>Cargando reporte...</span>
      </div>
    );
  }

  if (error || !reporte) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: '#D64545', marginBottom: '16px' }}>⚠️ {error || 'Reporte no encontrado'}</div>
        <Boton variante="secundario" onClick={() => navigate(`/obras/${obraId}`)}>Volver al tablero</Boton>
      </div>
    );
  }

  const c = reporte.contenido;
  const moneda = 'ARS'; // default, se podría obtener de la obra

  return (
    <div style={style.page}>
      {/* Botón imprimir */}
      <div style={style.printBtn}>
        <Boton variante="secundario" onClick={() => window.print()}>
          🖨️ Imprimir
        </Boton>
      </div>

      {/* Volver */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => navigate(`/obras/${obraId}`)}
          style={{
            background: 'none',
            border: 'none',
            color: tokens.color.primario,
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Volver al tablero
        </button>
      </div>

      {/* Documento */}
      <div style={style.doc}>
        {/* Header */}
        <div style={style.header}>
          <div style={style.headerTitulo}>Reporte Semanal</div>
          <div style={style.headerMeta}>
            Semana del {fmtFecha(c.semana.desde)} al {fmtFecha(c.semana.hasta)}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {reporte.enviado ? (
              <span style={{ ...style.enviadoBadge, background: 'rgba(255,255,255,0.2)' }}>
                ✓ Enviado por email
              </span>
            ) : (
              <span style={{ ...style.enviadoBadge, background: 'rgba(255,255,255,0.1)' }}>
                📝 Solo generado
              </span>
            )}
            <span style={{ fontSize: '12px', opacity: 0.8 }}>
              Generado el {fmtDateFull(reporte.generado_en)}
            </span>
          </div>
        </div>

        {/* Resumen ejecutivo */}
        <div style={style.section}>
          <div style={style.sectionTitle}>Resumen ejecutivo</div>
          <div style={style.resumenEjecutivo}>{c.resumen_ejecutivo}</div>
        </div>

        {/* Cifras */}
        <div style={style.section}>
          <div style={style.sectionTitle}>Cifras de la semana</div>
          <div style={style.cifrasGrid}>
            <div style={style.cifraCard}>
              <div style={style.cifraValor} aria-label={`Previsto ${c.cifras.previsto}`}>
                <Dinero monto={c.cifras.previsto} moneda={moneda as any} />
              </div>
              <div style={style.cifraLabel}>Previsto</div>
            </div>
            <div style={style.cifraCard}>
              <div style={style.cifraValor} aria-label={`Comprometido ${c.cifras.comprometido}`}>
                <Dinero monto={c.cifras.comprometido} moneda={moneda as any} />
              </div>
              <div style={style.cifraLabel}>Comprometido</div>
            </div>
            <div style={style.cifraCard}>
              <div style={style.cifraValor} aria-label={`Pagado ${c.cifras.pagado}`}>
                <Dinero monto={c.cifras.pagado} moneda={moneda as any} />
              </div>
              <div style={style.cifraLabel}>Pagado</div>
            </div>
            <div style={style.cifraCard}>
              <div style={{ ...style.cifraValor, color: tokens.color.primario }} aria-label={`Proyección ${c.cifras.proyeccion}`}>
                <Dinero monto={c.cifras.proyeccion} moneda={moneda as any} />
              </div>
              <div style={style.cifraLabel}>Proyección final</div>
            </div>
          </div>
        </div>

        {/* Avance */}
        <div style={style.section}>
          <div style={style.sectionTitle}>Avance de obra</div>
          <div style={style.avanceBar}>
            <div style={style.avancePct} aria-label={`Avance ${c.avance.pct_actual}%`}>
              {c.avance.pct_actual}%
            </div>
            <div style={style.barra}>
              <div style={{ ...style.progresoBar, width: `${c.avance.pct_actual}%` }} />
            </div>
          </div>
          {c.avance.pct_semana_anterior > 0 && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: tokens.color.textoSuave }}>
              Semana anterior: {c.avance.pct_semana_anterior}% · Variación: {c.avance.pct_actual - c.avance.pct_semana_anterior > 0 ? '+' : ''}{c.avance.pct_actual - c.avance.pct_semana_anterior}%
            </div>
          )}
          {c.avance.tareas_finalizadas.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: tokens.color.textoSuave, marginBottom: '8px' }}>Tareas finalizadas esta semana:</div>
              <div style={style.lista}>
                {c.avance.tareas_finalizadas.map((t, i) => (
                  <div key={i} style={style.listaItem}>
                    <span>🏁</span> {t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fotos */}
        {c.avance.fotos.length > 0 && (
          <div style={style.section}>
            <div style={style.sectionTitle}>Fotos de la semana ({c.avance.fotos.length})</div>
            <div style={style.fotosGrid}>
              {c.avance.fotos.map((url, i) => (
                <img key={i} src={url} alt={`Foto ${i + 1}`} style={style.foto} />
              ))}
            </div>
          </div>
        )}

        {/* Desvíos */}
        {c.desvios.length > 0 && (
          <div style={style.section}>
            <div style={style.sectionTitle}>Desvíos detectados</div>
            <table style={style.desviosTable}>
              <thead>
                <tr>
                  <th style={style.th}>Rubro</th>
                  <th style={{ ...style.th, textAlign: 'right' }}>Previsto</th>
                  <th style={{ ...style.th, textAlign: 'right' }}>Ejecutado</th>
                  <th style={{ ...style.th, textAlign: 'right' }}>Desvío</th>
                </tr>
              </thead>
              <tbody>
                {c.desvios.map((d, i) => (
                  <tr key={i}>
                    <td style={{ ...style.td, fontWeight: 500 }}>{d.rubro}</td>
                    <td style={{ ...style.td, textAlign: 'right' }}>
                      <Dinero monto={d.previsto} moneda={moneda as any} />
                    </td>
                    <td style={{ ...style.td, textAlign: 'right' }}>
                      <Dinero monto={d.ejecutado} moneda={moneda as any} />
                    </td>
                    <td style={{ ...style.td, textAlign: 'right', color: '#D64545', fontWeight: 600 }}>
                      {d.pct > 0 ? '+' : ''}{Math.round(d.pct)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Órdenes de cambio */}
        <div style={style.section}>
          <div style={style.sectionTitle}>Órdenes de cambio</div>
          {c.cambios.aprobadas.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: tokens.color.textoSuave, marginBottom: '8px' }}>Aprobadas:</div>
              <div style={style.lista}>
                {c.cambios.aprobadas.map((item, i) => (
                  <div key={i} style={style.listaItem}>
                    <span style={style.badgeAprobada}>✓ Aprobada</span> {item}
                  </div>
                ))}
              </div>
            </div>
          )}
          {c.cambios.pendientes.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: tokens.color.textoSuave, marginBottom: '8px' }}>Pendientes de aprobación:</div>
              <div style={style.lista}>
                {c.cambios.pendientes.map((item, i) => (
                  <div key={i} style={style.listaItem}>
                    <span style={style.badgePendiente}>⏳ Pendiente</span> {item}
                  </div>
                ))}
              </div>
            </div>
          )}
          {c.cambios.aprobadas.length === 0 && c.cambios.pendientes.length === 0 && (
            <div style={{ color: tokens.color.textoSuave, fontSize: '13px' }}>Sin órdenes de cambio esta semana.</div>
          )}
        </div>

        {/* Próxima semana */}
        {c.proxima_semana.length > 0 && (
          <div style={style.section}>
            <div style={style.sectionTitle}>Próxima semana</div>
            <div style={style.lista}>
              {c.proxima_semana.map((item, i) => (
                <div key={i} style={style.listaItem}>
                  <span>📅</span> {item.tarea}
                  {item.fecha_inicio && <span style={{ marginLeft: 'auto', color: tokens.color.textoSuave, fontSize: '12px' }}>{fmtFecha(item.fecha_inicio)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pendientes de acción */}
        {c.pendientes_accion.length > 0 && (
          <div style={style.section}>
            <div style={style.sectionTitle}>Pendientes de acción</div>
            <div style={style.lista}>
              {c.pendientes_accion.map((item, i) => (
                <div key={i} style={style.listaItem}>
                  <span>⚠️</span> {item.titulo}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botón enviar */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        {!reporte.enviado && (
          <Boton
            variante="primario"
            onClick={() => {
              api.post(`/obras/${obraId}/reportes/${reporteId}/enviar`).then(() => {
                setReporte(r => r ? { ...r, enviado: true } : r);
              }).catch(() => {
                alert('Error al enviar el reporte');
              });
            }}
          >
            📧 Enviar por email a miembros
          </Boton>
        )}
        {reporte.enviado && (
          <span style={{ color: tokens.color.textoSuave, fontSize: '13px' }}>
            ✓ Este reporte ya fue enviado a todos los miembros de la obra.
          </span>
        )}
      </div>

      {/* CSS para imprimir */}
      <style>{`
        @media print {
          body { background: white; }
          button { display: none !important; }
          div[style*="position: fixed"] { display: none !important; }
          .print-show { display: block !important; }
        }
      `}</style>
    </div>
  );
}