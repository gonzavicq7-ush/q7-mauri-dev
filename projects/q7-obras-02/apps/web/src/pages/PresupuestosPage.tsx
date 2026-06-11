import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tarjeta } from '@q7/ui';
import { Boton } from '@q7/ui';
import { BadgeEstado } from '@q7/ui';
import { Dinero } from '@q7/ui';
import { Semaforo } from '@q7/ui';
import { EstadoVacio } from '@q7/ui';
import { ModalConfirmar } from '@q7/ui';
import { BarraProgreso } from '@q7/ui';
import { tokens } from '@q7/ui';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Tipos ──

interface PresupuestoItem {
  id: string;
  codigo: string;
  nombre: string;
  items: any[];
  subtotal: string;
}

interface Presupuesto {
  id: string;
  tipo: 'REFERENCIA' | 'PROPUESTA' | 'ADOPTADO';
  nombre: string;
  proveedor_nombre: string | null;
  moneda: string;
  fecha_precio: string;
  estado: string;
  observaciones: string | null;
  contratista: string | null;
  total: string;
  items_count: number;
  cobertura_pct: number | null;
  dias_antiguedad: number;
}

interface RubroItem {
  id: string;
  tarea_id: string | null;
  tarea_codigo: string | null;
  tarea_descripcion: string | null;
  descripcion: string;
  tipo_recurso: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  incluye: string | null;
  excluye: string | null;
  no_cotizado: boolean;
  origen: string;
}

// ── Modal crear presupuesto ──

function ModalCrearPresupuesto({
  open,
  onClose,
  onCreado,
  obraId,
  tipoDefault,
}: {
  open: boolean;
  onClose: () => void;
  onCreado: () => void;
  obraId: string;
  tipoDefault?: 'REFERENCIA' | 'PROPUESTA';
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState(tipoDefault || 'PROPUESTA');
  const [moneda, setMoneda] = useState('ARS');
  const [fechaPrecio, setFechaPrecio] = useState(new Date().toISOString().split('T')[0]);
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await fetch(`${API}/api/v1/obras/${obraId}/presupuestos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), tipo, moneda, fecha_precio: fechaPrecio, proveedor_nombre: proveedorNombre.trim() || undefined, observaciones: observaciones.trim() || undefined }),
      });
      onCreado();
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div style={{ backgroundColor: tokens.color.superficie, borderRadius: tokens.radius, boxShadow: '0 4px 20px rgba(0,0,0,.15)', maxWidth: '480px', width: '90%', padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '18px', color: tokens.color.texto }}>
          {tipo === 'REFERENCIA' ? 'Nueva estimación de referencia' : 'Nueva propuesta'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>Nombre *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          {tipo === 'PROPUESTA' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>Proveedor / Contratista</label>
              <input type="text" value={proveedorNombre} onChange={e => setProveedorNombre(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px' }}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="PYG">PYG</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>Fecha de precio *</label>
              <input type="date" value={fechaPrecio} onChange={e => setFechaPrecio(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Boton variante="fantasma" type="button" onClick={onClose}>Cancelar</Boton>
            <Boton variante="primario" type="submit" disabled={guardando || !nombre.trim()}>{guardando ? 'Creando...' : 'Crear'}</Boton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal ver detalle ──

function DetallePresupuesto({
  presupuestoId,
  obraId,
  onClose,
}: {
  presupuestoId: string;
  obraId: string;
  onClose: () => void;
}) {
  const [detalle, setDetalle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/obras/${obraId}/presupuestos/${presupuestoId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setDetalle(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [obraId, presupuestoId]);

  if (!presupuestoId) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div style={{ backgroundColor: tokens.color.superficie, borderRadius: tokens.radius, boxShadow: '0 4px 20px rgba(0,0,0,.15)', maxWidth: '900px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${tokens.color.borde}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: tokens.color.texto }}>
              {loading ? 'Cargando...' : detalle?.nombre || 'Detalle'}
            </h3>
            {!loading && detalle && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '13px', color: tokens.color.textoSuave }}>{detalle.moneda}</span>
                <span style={{ fontSize: '13px', color: tokens.color.textoSuave }}>{detalle.fecha_precio}</span>
                {detalle.dias_antiguedad > 60 && (
                  <BadgeEstado estado={`${detalle.dias_antiguedad} días`} type="warning" />
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to={`/obras/${obraId}/presupuestos/${presupuestoId}`}>
              <Boton variante="secundario">Editar</Boton>
            </Link>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: tokens.color.textoSuave }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: tokens.color.textoSuave }}>Cargando...</div>
          ) : detalle ? (
            <>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: tokens.color.texto }}>
                    <Dinero monto={detalle.total} moneda={detalle.moneda} />
                  </span>
                  <span style={{ fontSize: '14px', color: tokens.color.textoSuave, marginLeft: '8px' }}>
                    {detalle.items_count} ítems
                  </span>
                </div>
              </div>

              {detalle.por_rubro?.map((rubro: any) => (
                <div key={rubro.id} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: tokens.color.fondo, borderRadius: '8px', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: tokens.color.primario, fontWeight: 600 }}>{rubro.codigo}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.texto }}>{rubro.nombre}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 600, color: tokens.color.texto }}><Dinero monto={rubro.subtotal} moneda={detalle.moneda} /></span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: tokens.color.fondo }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', color: tokens.color.textoSuave }}>Código</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', color: tokens.color.textoSuave }}>Descripción</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', color: tokens.color.textoSuave }}>Recurso</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', color: tokens.color.textoSuave }}>Unidad</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', color: tokens.color.textoSuave }}>Cantidad</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', color: tokens.color.textoSuave }}>P.Unitario</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', color: tokens.color.textoSuave }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubro.items.map((item: any) => (
                        <tr key={item.id} style={{ borderTop: `1px solid ${tokens.color.borde}` }}>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: tokens.color.textoSuave }}>{item.tarea_codigo || '—'}</td>
                          <td style={{ padding: '6px 10px', color: tokens.color.texto }}>{item.descripcion}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <BadgeEstado estado={item.tipo_recurso} type={item.tipo_recurso === 'MO' ? 'info' : item.tipo_recurso === 'MATERIAL' ? 'default' : 'warning'} />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: tokens.color.textoSuave }}>{item.unidad}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: tokens.color.texto }}>{parseFloat(item.cantidad).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: tokens.color.texto }}><Dinero monto={item.precio_unitario} moneda={detalle.moneda} /></td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: tokens.color.texto }}><Dinero monto={item.subtotal} moneda={detalle.moneda} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {detalle.totales_por_recurso && (
                <div style={{ marginTop: '20px', padding: '16px', background: tokens.color.fondo, borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: tokens.color.texto }}>Totales por tipo de recurso</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {Object.entries(detalle.totales_por_recurso).map(([tipo, monto]) => (
                      <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BadgeEstado estado={tipo} type="default" />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.texto }}><Dinero monto={monto as string} moneda={detalle.moneda} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: tokens.color.textoSuave }}>No se pudo cargar el detalle</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──

export function PresupuestosPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate = useNavigate();
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [modalCrear, setModalCrear] = useState<{ open: boolean; tipo?: 'REFERENCIA' | 'PROPUESTA' }>({ open: false });
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const cargarPresupuestos = useCallback(async () => {
    if (!obraId) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/presupuestos`, { credentials: 'include' });
      const data = await res.json();
      setPresupuestos(Array.isArray(data) ? data : []);
    } catch {} finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    if (obraId) cargarPresupuestos();
  }, [obraId, cargarPresupuestos]);

  const referencia = presupuestos.find(p => p.tipo === 'REFERENCIA');
  const propuestas = presupuestos.filter(p => p.tipo === 'PROPUESTA' && p.estado !== 'DESCARTADO');
  const adoptado = presupuestos.find(p => p.tipo === 'ADOPTADO');

  const toggleSeleccion = (id: string) => {
    setSeleccionadas(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length < 4 ? [...prev, id] : prev);
  };

  const handleComparar = () => {
    if (seleccionadas.length < 2) return;
    navigate(`/obras/${obraId}/presupuestos/comparar?propuestas=${seleccionadas.join(',')}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <span style={{ color: tokens.color.textoSuave }}>Cargando presupuestos...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: tokens.color.texto }}>Presupuestos</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: tokens.color.textoSuave }}>
            Los tres momentos: estimación, propuestas y adoptado
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Boton variante="fantasma" onClick={() => setModalCrear({ open: true, tipo: 'REFERENCIA' })} disabled={!!referencia}>
            + Referencia
          </Boton>
          <Boton variante="primario" onClick={() => setModalCrear({ open: true, tipo: 'PROPUESTA' })}>
            + Propuesta
          </Boton>
        </div>
      </div>

      {/* ── 1. REFERENCIA ── */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.textoSuave, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          📐 Mi estimación (Referencia)
        </h3>
        {referencia ? (
          <Tarjeta padding="16px">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 600, color: tokens.color.texto }}>{referencia.nombre}</span>
                  <BadgeEstado estado={referencia.estado} type="success" />
                  {referencia.dias_antiguedad > 60 && (
                    <BadgeEstado estado={`${referencia.dias_antiguedad} días`} type="warning" />
                  )}
                </div>
                <div style={{ fontSize: '13px', color: tokens.color.textoSuave }}>
                  {referencia.moneda} · {referencia.fecha_precio} · {referencia.items_count} ítems
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: tokens.color.texto }}>
                  <Dinero monto={referencia.total} moneda={referencia.moneda} />
                </div>
                <button
                  onClick={() => setDetalleId(referencia.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: tokens.color.primario, textDecoration: 'underline' }}
                >
                  Ver detalle →
                </button>
              </div>
            </div>
          </Tarjeta>
        ) : (
          <Tarjeta padding="20px">
            <EstadoVacio
              titulo="Todavía no cargaste la estimación de referencia"
              descripcion="Es tu punto de partida: cuánto estimás que va a costar la obra."
              cta={[{ texto: 'Crear referencia', onClick: () => setModalCrear({ open: true, tipo: 'REFERENCIA' }) }]}
            />
          </Tarjeta>
        )}
      </div>

      {/* ── 2. PROPUESTAS ── */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.textoSuave, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          📋 Propuestas recibidas
          {propuestas.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '12px', color: tokens.color.textoSuave }}>({propuestas.length})</span>
          )}
        </h3>

        {propuestas.length === 0 ? (
          <Tarjeta padding="20px">
            <EstadoVacio
              titulo="No hay propuestas todavía"
              descripcion="Invitá a constructores o proveedores para que coticen."
              cta={[{ texto: 'Crear primera propuesta', onClick: () => setModalCrear({ open: true, tipo: 'PROPUESTA' }) }]}
            />
          </Tarjeta>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {propuestas.map(p => (
              <Tarjeta key={p.id} padding="16px" style={{ border: seleccionadas.includes(p.id) ? `2px solid ${tokens.color.primario}` : `1px solid ${tokens.color.borde}`, cursor: 'pointer' }}>
                <div onClick={() => toggleSeleccion(p.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={seleccionadas.includes(p.id)}
                      onChange={() => toggleSeleccion(p.id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <span style={{ fontSize: '16px', fontWeight: 600, color: tokens.color.texto }}>{p.nombre}</span>
                    <BadgeEstado estado={p.estado} type={p.estado === 'ADOPTADO_PARCIAL' ? 'warning' : p.estado === 'ADOPTADO_TOTAL' ? 'success' : 'default'} />
                  </div>
                  <div style={{ fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '8px' }}>
                    {p.proveedor_nombre || p.contratista || 'Sin proveedor'} · {p.fecha_precio}
                    {p.cobertura_pct !== null && (
                      <span style={{ marginLeft: '8px' }}>
                        <BarraProgreso valor={p.cobertura_pct} />
                        <span style={{ fontSize: '11px', color: tokens.color.textoSuave }}> {p.cobertura_pct}% cobertura</span>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: tokens.color.texto }}>
                      <Dinero monto={p.total} moneda={p.moneda} />
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={e => { e.stopPropagation(); setDetalleId(p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: tokens.color.primario, textDecoration: 'underline' }}>Ver</button>
                      <Link to={`/obras/${obraId}/presupuestos/${p.id}`} onClick={e => e.stopPropagation()} style={{ fontSize: '13px', color: tokens.color.primario, textDecoration: 'underline' }}>Editar</Link>
                    </div>
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>
        )}

        {seleccionadas.length >= 2 && (
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
            <Boton variante="primario" onClick={handleComparar}>
              Comparar {seleccionadas.length} propuestas →
            </Boton>
          </div>
        )}
      </div>

      {/* ── 3. ADOPTADO ── */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: tokens.color.textoSuave, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          ✅ Presupuesto adoptado
        </h3>
        {adoptado ? (
          <Tarjeta padding="16px" style={{ background: `${tokens.color.primario}08`, border: `1px solid ${tokens.color.primario}30` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: tokens.color.texto }}>{adoptado.nombre}</span>
                  <BadgeEstado estado={adoptado.estado} type="success" />
                </div>
                <div style={{ fontSize: '13px', color: tokens.color.textoSuave }}>
                  {adoptado.moneda} · {adoptado.items_count} ítems adoptados
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: tokens.color.primario }}>
                  <Dinero monto={adoptado.total} moneda={adoptado.moneda} />
                </div>
                <Link to={`/obras/${obraId}/presupuestos/adoptado`} style={{ fontSize: '13px', color: tokens.color.primario, textDecoration: 'underline' }}>
                  Ver detalle →
                </Link>
              </div>
            </div>
          </Tarjeta>
        ) : (
          <Tarjeta padding="20px">
            <EstadoVacio
              titulo="Todavía no adoptaste ningún presupuesto"
              descripcion="Compará las propuestas y adoptá los rubros que prefieras."
              cta={propuestas.length >= 2 ? [{ texto: 'Ir al comparador', onClick: () => navigate(`/obras/${obraId}/presupuestos/comparar?propuestas=${propuestas.map(p => p.id).join(',')}`) }] : []}
            />
          </Tarjeta>
        )}
      </div>

      {/* Modals */}
      <ModalCrearPresupuesto
        open={modalCrear.open}
        onClose={() => setModalCrear({ open: false })}
        onCreado={() => { cargarPresupuestos(); setModalCrear({ open: false }); }}
        obraId={obraId!}
        tipoDefault={modalCrear.tipo}
      />

      {detalleId && (
        <DetallePresupuesto
          presupuestoId={detalleId}
          obraId={obraId!}
          onClose={() => setDetalleId(null)}
        />
      )}
    </div>
  );
}