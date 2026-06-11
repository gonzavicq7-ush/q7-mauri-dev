import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tarjeta } from '@q7/ui';
import { Boton } from '@q7/ui';
import { BadgeEstado } from '@q7/ui';
import { Dinero } from '@q7/ui';
import { EstadoVacio } from '@q7/ui';
import { tokens } from '@q7/ui';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AdopcionItem {
  id: string;
  descripcion: string;
  tipo_recurso: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  origen: string;
  origen_de: { id?: string; nombre: string };
}

interface RubroAdoptado {
  id: string;
  codigo: string;
  nombre: string;
  subtotal: string;
  items: AdopcionItem[];
}

interface Adopcion {
  id: string;
  rubro: string;
  presupuesto: string;
  presupuesto_id: string;
  fecha: string;
  decidido_por: string;
  nota: string | null;
}

interface Adoptado {
  id: string;
  total: string;
  moneda: string;
  estado: string;
  por_rubro: RubroAdoptado[];
  adopciones: Adopcion[];
  totales_por_recurso: Record<string, number>;
}

export function AdoptadoPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate = useNavigate();
  const [adoptado, setAdoptado] = useState<Adoptado | null>(null);
  const [loading, setLoading] = useState(true);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [referencia, setReferencia] = useState<any>(null);

  const cargarAdoptado = useCallback(async () => {
    if (!obraId) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/adoptado`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdoptado(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [obraId]);

  const cargarContexto = useCallback(async () => {
    if (!obraId) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/presupuestos`, { credentials: 'include' });
      const data: any[] = await res.json();
      setPresupuestos(data || []);
      const ref = data.find((p: any) => p.tipo === 'REFERENCIA');
      setReferencia(ref || null);
    } catch {}
  }, [obraId]);

  useEffect(() => {
    cargarAdoptado();
    cargarContexto();
  }, [cargarAdoptado, cargarContexto]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <span style={{ color: tokens.color.textoSuave }}>Cargando presupuesto adoptado...</span>
      </div>
    );
  }

  // Estado vacío
  if (!adoptado) {
    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: tokens.color.texto }}>Presupuesto adoptado</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: tokens.color.textoSuave }}>
            El presupuesto que rige la obra
          </p>
        </div>
        <EstadoVacio
          titulo="Todavía no adoptaste ningún rubro"
          descripcion="Compará las propuestas y elegí el mejor precio por rubro. El presupuesto adoptado se genera automáticamente al adoptar el primer rubro."
          cta={[
            { texto: 'Ir a presupuestos', onClick: () => navigate(`/obras/${obraId}/presupuestos`) },
          ]}
        />
      </div>
    );
  }

  // Calcular los 3 momentos
  const refTotal = referencia?.total ? parseFloat(referencia.total) : 0;
  const adoptadoTotal = parseFloat(adoptado.total);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: tokens.color.texto }}>Presupuesto adoptado</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: tokens.color.textoSuave }}>
            {adoptado.por_rubro.length} rubros adoptados · {adoptado.moneda}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Boton variante="fantasma" onClick={() => navigate(`/obras/${obraId}/presupuestos`)}>
            ← Volver a presupuestos
          </Boton>
        </div>
      </div>

      {/* Línea de los 3 momentos */}
      {referencia && (
        <Tarjeta padding="20px" style={{ marginBottom: '20px', background: `linear-gradient(135deg, ${tokens.color.fondo}, ${tokens.color.superficie})` }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: tokens.color.textoSuave, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📊 Línea de los 3 momentos
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ padding: '12px 16px', background: tokens.color.superficie, borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: tokens.color.textoSuave, marginBottom: '4px' }}>Referencia</div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: tokens.color.texto }}>
                <Dinero monto={referencia.total} moneda={referencia.moneda} />
              </span>
            </div>

            <span style={{ fontSize: '20px', color: tokens.color.textoSuave }}>→</span>

            <div style={{ padding: '12px 16px', background: tokens.color.superficie, borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: tokens.color.textoSuave, marginBottom: '4px' }}>Adoptado</div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: adoptadoTotal > refTotal ? tokens.color.peligro : tokens.color.ok }}>
                <Dinero monto={adoptado.total} moneda={adoptado.moneda} />
              </span>
            </div>

            {refTotal > 0 && (
              <div style={{
                padding: '6px 12px', borderRadius: '100px', fontSize: '13px', fontWeight: 600,
                background: adoptadoTotal > refTotal ? tokens.color.peligro + '15' : tokens.color.ok + '15',
                color: adoptadoTotal > refTotal ? tokens.color.peligro : tokens.color.ok,
              }}>
                {adoptadoTotal > refTotal ? '+' : ''}{Math.round(((adoptadoTotal - refTotal) / refTotal) * 100)}%
              </div>
            )}
          </div>
        </Tarjeta>
      )}

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Tabla principal */}
        <div style={{ flex: 1 }}>
          {adoptado.por_rubro.map(rubro => (
            <Tarjeta key={rubro.id} padding="none" style={{ marginBottom: '16px' }}>
              {/* Encabezado por rubro */}
              <div style={{
                padding: '12px 16px', borderBottom: `1px solid ${tokens.color.borde}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: `${tokens.color.ok}08`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: tokens.color.primario, fontWeight: 600 }}>
                    {rubro.codigo}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.texto }}>
                    {rubro.nombre}
                  </span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: tokens.color.texto }}>
                  <Dinero monto={rubro.subtotal} moneda={adoptado.moneda} />
                </span>
              </div>

              {/* Ítems del rubro */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: tokens.color.fondo }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: tokens.color.textoSuave }}>Descripción</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: tokens.color.textoSuave }}>Recurso</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: tokens.color.textoSuave }}>Unidad</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: tokens.color.textoSuave }}>Cantidad</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: tokens.color.textoSuave }}>P.Unitario</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: tokens.color.textoSuave }}>Subtotal</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: tokens.color.textoSuave }}>Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rubro.items.map((item, idx) => (
                      <tr key={item.id} style={{ borderTop: `1px solid ${tokens.color.borde}` }}>
                        <td style={{ padding: '8px 12px', color: tokens.color.texto }}>
                          {item.descripcion}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <BadgeEstado
                            estado={item.tipo_recurso}
                            type={item.tipo_recurso === 'MO' ? 'info' : 'default'}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: tokens.color.textoSuave }}>
                          {item.unidad}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: tokens.color.texto }}>
                          {parseFloat(item.cantidad).toLocaleString('es-AR')}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: tokens.color.texto }}>
                          <Dinero monto={item.precio_unitario} moneda={adoptado.moneda} />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: tokens.color.texto }}>
                          <Dinero monto={item.subtotal} moneda={adoptado.moneda} />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {item.origen_de.id ? (
                            <Link
                              to={`/obras/${obraId}/presupuestos#propuesta-${item.origen_de.id}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '12px', color: tokens.color.primario,
                                background: tokens.color.primario + '10',
                                padding: '2px 8px', borderRadius: '100px',
                                textDecoration: 'none',
                              }}
                            >
                              ← {item.origen_de.nombre}
                            </Link>
                          ) : (
                            <span style={{
                              fontSize: '12px', color: tokens.color.textoSuave,
                              background: tokens.color.fondo,
                              padding: '2px 8px', borderRadius: '100px',
                            }}>
                              {item.origen_de.nombre}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: tokens.color.fondo, fontWeight: 600 }}>
                      <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', color: tokens.color.texto }}>
                        Subtotal {rubro.codigo}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: tokens.color.texto }}>
                        <Dinero monto={rubro.subtotal} moneda={adoptado.moneda} />
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Tarjeta>
          ))}

          {/* Gran total */}
          <Tarjeta padding="16px" style={{ background: tokens.color.primario + '08', border: `1px solid ${tokens.color.primario}30` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '18px', fontWeight: 700, color: tokens.color.primario }}>
                  <Dinero monto={adoptado.total} moneda={adoptado.moneda} />
                </span>
                <span style={{ fontSize: '13px', color: tokens.color.textoSuave, marginLeft: '8px' }}>
                  Presupuesto adoptado
                </span>
              </div>
              <BadgeEstado estado={adoptado.estado} type="success" />
            </div>
          </Tarjeta>
        </div>

        {/* Panel lateral: historial de adopciones */}
        <div style={{ width: '300px', flexShrink: 0 }}>
          <Tarjeta padding="none">
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${tokens.color.borde}` }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: tokens.color.texto }}>
                Historial de adopciones
              </span>
            </div>
            <div style={{ maxHeight: '500px', overflow: 'auto' }}>
              {adoptado.adopciones.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: tokens.color.textoSuave, fontSize: '13px' }}>
                  Sin adopciones registradas
                </div>
              ) : (
                adoptado.adopciones.map(a => (
                  <div key={a.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${tokens.color.borde}` }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.texto, marginBottom: '4px' }}>
                      {a.rubro}
                    </div>
                    <div style={{ fontSize: '12px', color: tokens.color.textoSuave, marginBottom: '2px' }}>
                      De: <Link to={`/obras/${obraId}/presupuestos#propuesta-${a.presupuesto_id}`} style={{ color: tokens.color.primario }}>{a.presupuesto}</Link>
                    </div>
                    <div style={{ fontSize: '12px', color: tokens.color.textoSuave }}>
                      Por: {a.decidido_por} · {new Date(a.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                    {a.nota && <div style={{ fontSize: '12px', color: tokens.color.textoSuave, fontStyle: 'italic', marginTop: '4px' }}>{a.nota}</div>}
                  </div>
                ))
              )}
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}