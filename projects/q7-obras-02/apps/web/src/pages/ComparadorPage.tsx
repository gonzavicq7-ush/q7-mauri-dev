import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Tarjeta } from '@q7/ui';
import { Boton } from '@q7/ui';
import { BadgeEstado } from '@q7/ui';
import { Dinero } from '@q7/ui';
import { ModalConfirmar } from '@q7/ui';
import { tokens } from '@q7/ui/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Tipos ──

interface Columna {
  id: string;
  nombre: string;
  tipo: 'REFERENCIA' | 'PROPUESTA';
  proveedor: string | null;
  moneda: string;
  fecha_precio: string;
}

interface Celda {
  subtotal: number;
  items_count: number;
  no_cotizado: boolean;
  parcial: boolean;
  tooltip: string | null;
  es_mejor_precio: boolean;
}

interface Fila {
  rubro_id: string;
  rubro_codigo: string;
  rubro_nombre: string;
  orden: number;
  celdas: Record<string, Celda>;
  mejor_precio_col: string | null;
}

interface Totales {
  total_comparable: Record<string, number>;
  total_nominal: Record<string, number>;
  delta_vs_referencia: Record<string, number> | null;
}

interface ItemDrawer {
  id: string;
  descripcion: string;
  tarea_codigo: string | null;
  tarea_descripcion: string | null;
  tipo_recurso: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  incluye: string | null;
  excluye: string | null;
}

// ── Drawer de ítems ──

function DrawerItems({
  abierta,
  rubro,
  columnas,
  presupuestoActual,
  onClose,
  obraId,
}: {
  abierta: boolean;
  rubro: Fila | null;
  columnas: Columna[];
  presupuestoActual: string | null;
  onClose: () => void;
  obraId: string;
}) {
  const [items, setItems] = useState<Record<string, ItemDrawer[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (abierta && rubro && presupuestoActual) {
      setLoading(true);
      // Cargar items de la propuesta seleccionada
      fetch(`${API}/api/v1/obras/${obraId}/presupuestos/${presupuestoActual}/items/${rubro.rubro_id}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { setItems({ [presupuestoActual]: d }); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [abierta, rubro, presupuestoActual, obraId]);

  if (!abierta || !rubro) return null;

  const itemsActuales = items[presupuestoActual || ''] || [];

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '95vw',
      backgroundColor: tokens.color.superficie, boxShadow: '-4px 0 20px rgba(0,0,0,.15)',
      zIndex: 1001, display: 'flex', flexDirection: 'column', transform: 'translateX(0)',
      transition: 'transform .3s ease',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${tokens.color.borde}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: 'monospace', fontSize: '13px', color: tokens.color.primario, fontWeight: 600 }}>{rubro.rubro_codigo}</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '18px', color: tokens.color.texto }}>{rubro.rubro_nombre}</h3>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: tokens.color.textoSuave }}>×</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: tokens.color.textoSuave }}>Cargando ítems...</div>
        ) : itemsActuales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: tokens.color.textoSuave }}>No hay ítems para este rubro</div>
        ) : (
          <>
            {itemsActuales.map(item => (
              <div key={item.id} style={{ marginBottom: '16px', padding: '12px', background: tokens.color.fondo, borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.texto }}>{item.descripcion}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: tokens.color.texto }}>
                    <Dinero monto={item.subtotal} moneda="ARS" />
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: tokens.color.textoSuave, display: 'flex', gap: '8px' }}>
                  {item.tarea_codigo && <span style={{ fontFamily: 'monospace' }}>{item.tarea_codigo}</span>}
                  <BadgeEstado estado={item.tipo_recurso} type="default" />
                  <span>{item.unidad}</span>
                  <span>{parseFloat(item.cantidad).toLocaleString('es-AR')} × <Dinero monto={item.precio_unitario} moneda="ARS" /></span>
                </div>
                {item.incluye && <div style={{ marginTop: '4px', fontSize: '12px', color: tokens.color.ok }}>✓ {item.incluye}</div>}
                {item.excluye && <div style={{ marginTop: '2px', fontSize: '12px', color: tokens.color.peligro }}>✗ {item.excluye}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal Adoptar ──

function ModalAdoptarRubro({
  open,
  rubro,
  columna,
  onConfirmar,
  onCancelar,
  moneda,
}: {
  open: boolean;
  rubro: Fila | null;
  columna: Columna | null;
  onConfirmar: () => void;
  onCancelar: () => void;
  moneda: string;
}) {
  if (!rubro || !columna) return null;

  const celda = rubro.celdas[columna.id];
  if (!celda) return null;

  const impacto = celda.subtotal;

  return (
    <ModalConfirmar
      open={open}
      titulo={`Adoptar ${rubro.rubro_codigo} ${rubro.rubro_nombre}`}
      mensaje={`¿Confirmás la adopción de este rubro desde "${columna.nombre}" por <Dinero monto="${impacto}" moneda="${moneda}" />?`}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
      textoConfirmar="Adoptar"
      variante="primario"
    />
  );
}

// ── Página principal ──

export function ComparadorPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const propuestaIds = (searchParams.get('propuestas') || '').split(',').filter(Boolean);

  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<Fila | null>(null);
  const [propuestaDrawer, setPropuestaDrawer] = useState<string | null>(null);
  const [modalAdopcion, setModalAdopcion] = useState<{ open: boolean; rubro: Fila | null; columna: Columna | null }>({ open: false, rubro: null, columna: null });
  const [adoptando, setAdoptando] = useState(false);
  const [adoptadosPorFila, setAdoptadosPorFila] = useState<Set<string>>(new Set());

  const cargarComparador = useCallback(async () => {
    if (!obraId || propuestaIds.length < 2) {
      setError('Se requieren al menos 2 propuestas para comparar');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/comparador?propuestas=${propuestaIds.join(',')}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.mensaje || err.error?.codigo || 'Error al cargar comparador');
      }
      const data = await res.json();
      setColumnas(data.columnas || []);
      setFilas(data.filas || []);
      setTotales(data.totales || null);
    } catch (e: any) {
      setError(e.message || 'Error al cargar comparador');
    } finally {
      setLoading(false);
    }
  }, [obraId, propuestaIds.join(',')]);

  useEffect(() => {
    if (obraId) cargarComparador();
  }, [obraId, cargarComparador]);

  const handleClickCelda = (fila: Fila, columnaId: string) => {
    setRubroSeleccionado(fila);
    setPropuestaDrawer(columnaId);
    setDrawerAbierto(true);
  };

  const handleAdoptar = (rubro: Fila, columna: Columna) => {
    setModalAdopcion({ open: true, rubro, columna });
  };

  const confirmarAdopcion = async () => {
    if (!obraId || !modalAdopcion.rubro || !modalAdopcion.columna) return;
    setAdoptando(true);
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/adopciones`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubro_obra_id: modalAdopcion.rubro!.rubro_id,
          presupuesto_origen_id: modalAdopcion.columna!.id,
        }),
      });
      if (!res.ok) throw new Error('Error al adoptar');
      setAdoptadosPorFila(prev => new Set([...prev, `${modalAdopcion.rubro!.rubro_id}-${modalAdopcion.columna!.id}`]));
      setModalAdopcion({ open: false, rubro: null, columna: null });
      cargarComparador();
    } catch (e) {
      alert('Error al adoptar el rubro');
    } finally {
      setAdoptando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <span style={{ color: tokens.color.textoSuave }}>Comparando propuestas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: tokens.color.peligro, marginBottom: '16px' }}>{error}</p>
        <Boton onClick={() => navigate(`/obras/${obraId}/presupuestos`)}>Volver a presupuestos</Boton>
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: tokens.color.textoSuave }}>No hay rubros para comparar</p>
        <Boton onClick={() => navigate(`/obras/${obraId}/presupuestos`)}>Volver</Boton>
      </div>
    );
  }

  const tieneReferencia = columnas.some(c => c.tipo === 'REFERENCIA');

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: tokens.color.texto }}>Comparador de propuestas</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: tokens.color.textoSuave }}>
            {columnas.length} columnas · {filas.length} rubros · comparando por precio
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Boton variante="fantasma" onClick={() => navigate(`/obras/${obraId}/presupuestos`)}>← Volver</Boton>
          <Boton variante="secundario" onClick={() => window.open(`${API}/api/v1/obras/${obraId}/comparador/exportar?propuestas=${propuestaIds.join(',')}`, '_blank')}>
            📤 Exportar
          </Boton>
        </div>
      </div>

      {/* Tabla comparador */}
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr style={{ background: tokens.color.fondo }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', color: tokens.color.textoSuave, borderBottom: `2px solid ${tokens.color.borde}` }}>
                Rubro
              </th>
              {columnas.map(col => (
                <th key={col.id} style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', borderBottom: `2px solid ${col.tipo === 'REFERENCIA' ? tokens.color.primario : tokens.color.borde}`, minWidth: '160px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.texto }}>{col.nombre}</span>
                    <span style={{ fontSize: '11px', color: tokens.color.textoSuave }}>{col.proveedor}</span>
                    <BadgeEstado estado={col.tipo} type={col.tipo === 'REFERENCIA' ? 'info' : 'default'} />
                    {col.tipo === 'PROPUESTA' && totales?.delta_vs_referencia && totales.delta_vs_referencia[col.id] !== undefined && (
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        color: totales.delta_vs_referencia[col.id] <= 0 ? tokens.color.ok : tokens.color.peligro,
                      }}>
                        {totales.delta_vs_referencia[col.id] > 0 ? '+' : ''}{totales.delta_vs_referencia[col.id]}% vs ref.
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(fila => {
              const estaAdoptado = Array.from(adoptadosPorFila).some(k => k.startsWith(fila.rubro_id));

              return (
                <tr key={fila.rubro_id} style={{ borderBottom: `1px solid ${tokens.color.borde}` }}>
                  <td style={{ padding: '12px 16px', background: fila.orden % 2 === 0 ? tokens.color.fondo : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: tokens.color.primario, fontWeight: 600 }}>{fila.rubro_codigo}</span>
                      <span style={{ fontSize: '14px', color: tokens.color.texto }}>{fila.rubro_nombre}</span>
                    </div>
                  </td>
                  {columnas.map(col => {
                    const celda = fila.celdas[col.id];
                    if (!celda) {
                      // Columna sin datos (referencia no existe)
                      return <td key={col.id} style={{ padding: '12px 8px', textAlign: 'center' }}>—</td>;
                    }

                    if (celda.no_cotizado) {
                      // NO COTIZA — fondo gris rayado
                      return (
                        <td
                          key={col.id}
                          style={{
                            padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
                            background: `repeating-linear-gradient(45deg, #e8e8e8, #e8e8e8 4px, #f4f4f4 4px, #f4f4f4 8px)`,
                          }}
                          onClick={() => handleClickCelda(fila, col.id)}
                          title={celda.tooltip || 'No cotiza este rubro'}
                        >
                          <span style={{ fontSize: '12px', color: tokens.color.textoSuave, fontStyle: 'italic' }}>No cotiza</span>
                        </td>
                      );
                    }

                    // Celda normal
                    const esMejor = celda.es_mejor_precio;
                    const esParcial = celda.parcial;

                    return (
                      <td
                        key={col.id}
                        style={{
                          padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
                          background: estaAdoptado ? `${tokens.color.ok}10` : 'transparent',
                          border: esMejor ? `2px solid ${tokens.color.ok}` : esParcial ? `2px solid ${tokens.color.alerta}` : `1px solid ${tokens.color.borde}`,
                          borderRadius: esMejor || esParcial ? '8px' : '4px',
                        }}
                        onClick={() => handleClickCelda(fila, col.id)}
                        title={celda.tooltip || `${celda.items_count} ítems`}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: tokens.color.texto }}>
                            <Dinero monto={celda.subtotal.toString()} moneda={col.moneda} />
                          </span>
                          <span style={{ fontSize: '11px', color: tokens.color.textoSuave }}>{celda.items_count} ítems</span>
                          {esParcial && <BadgeEstado estado="Parcial" type="warning" />}
                          {esMejor && <BadgeEstado estado="Mejor precio" type="success" />}
                        </div>
                        {col.tipo === 'PROPUESTA' && !esParcial && !estaAdoptado && (
                          <button
                            onClick={e => { e.stopPropagation(); handleAdoptar(fila, col); }}
                            style={{
                              marginTop: '6px', padding: '4px 10px', borderRadius: '6px',
                              background: tokens.color.primario, color: '#fff', border: 'none',
                              fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                            }}
                          >
                            Adoptar
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Fila de totales */}
            <tr style={{ background: tokens.color.fondo, fontWeight: 700 }}>
              <td style={{ padding: '16px', borderTop: `2px solid ${tokens.color.borde}` }}>
                <span style={{ fontSize: '14px', color: tokens.color.texto }}>Total comparable</span>
                <div style={{ fontSize: '11px', color: tokens.color.textoSuave, marginTop: '2px' }}>
                  (solo rubros que todas cotizan completo)
                </div>
              </td>
              {columnas.map(col => (
                <td key={col.id} style={{ padding: '16px', textAlign: 'center', borderTop: `2px solid ${tokens.color.borde}` }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: col.tipo === 'REFERENCIA' ? tokens.color.primario : tokens.color.texto }}>
                    <Dinero monto={(totales?.total_comparable[col.id] || 0).toString()} moneda={col.moneda} />
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ padding: '8px 16px' }}>
                <span style={{ fontSize: '13px', color: tokens.color.textoSuave }}>Total nominal</span>
                <div style={{ fontSize: '11px', color: tokens.color.textoSuave }}>(engañoso si los alcances difieren)</div>
              </td>
              {columnas.map(col => (
                <td key={col.id} style={{ padding: '8px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '14px', color: tokens.color.textoSuave, textDecoration: 'line-through' }}>
                    <Dinero monto={(totales?.total_nominal[col.id] || 0).toString()} moneda={col.moneda} />
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <Tarjeta padding="16px" style={{ background: tokens.color.fondo }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: tokens.color.texto }}>Cómo leer esta tabla</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '16px', background: `repeating-linear-gradient(45deg, #e8e8e8, #e8e8e8 2px, #f4f4f4 2px, #f4f4f4 4px)`, borderRadius: '4px' }} />
            <span style={{ color: tokens.color.textoSuave }}>No cotiza — hueco de alcance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '16px', border: `2px solid ${tokens.color.alerta}`, borderRadius: '4px' }} />
            <span style={{ color: tokens.color.textoSuave }}>Parcial — no cubre todas las tareas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '16px', border: `2px solid ${tokens.color.ok}`, borderRadius: '4px' }} />
            <span style={{ color: tokens.color.textoSuave }}>Mejor precio completo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '16px', background: `${tokens.color.ok}15`, borderRadius: '4px' }} />
            <span style={{ color: tokens.color.textoSuave }}>Ya adoptado</span>
          </div>
        </div>
      </Tarjeta>

      {/* Drawer */}
      <DrawerItems
        abierta={drawerAbierto}
        rubro={rubroSeleccionado}
        columnas={columnas}
        presupuestoActual={propuestaDrawer}
        onClose={() => setDrawerAbierto(false)}
        obraId={obraId!}
      />

      {/* Modal adopción */}
      {modalAdopcion.rubro && modalAdopcion.columna && (
        <ModalConfirmar
          open={modalAdopcion.open}
          titulo={`Adoptar ${modalAdopcion.rubro.rubro_codigo} ${modalAdopcion.rubro.rubro_nombre}`}
          mensaje={`Vas a adoptar este rubro desde "${modalAdopcion.columna.nombre}". El presupuesto adoptado se actualizará con los ítems de esta propuesta. Podés re-adoptar más adelante si cambiás de opinión.`}
          onConfirmar={confirmarAdopcion}
          onCancelar={() => setModalAdopcion({ open: false, rubro: null, columna: null })}
          textoConfirmar={adoptando ? 'Adoptando...' : 'Adoptar'}
          variante="primario"
        />
      )}
    </div>
  );
}