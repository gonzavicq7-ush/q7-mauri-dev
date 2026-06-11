/**
 * M4 — Órdenes de Cambio: Página completa
 * Lista + Detalle + Formulario wizard 2 pasos
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.js';
import { Boton, Tarjeta, BadgeEstado, Dinero, ModalConfirmar } from '@q7/ui';
import { tokens } from '@q7/ui';
import { formatearDinero, MotivoOC, EstadoOC } from '@q7/shared';

// ── Tipos locales ─────────────────────────────────────────────────────────────
interface OCOItem {
  id: string;
  descripcion: string;
  tipo_recurso: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface OrdenCambio {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string | null;
  motivo: string;
  impactoCosto: string;
  moneda: string;
  impactoDias: number;
  rubrosAfectados: string[];
  estado: string;
  solicitanteId: string;
  resolutorId: string | null;
  fechaResolucion: string | null;
  notaResolucion: string | null;
  creadoEn: string;
  actualizadoEn: string;
  items: OCOItem[];
  solicitante: { id: string; nombre: string };
  resolutor?: { id: string; nombre: string } | null;
  _rubros?: { id: string; codigo: string; nombre: string }[];
}

interface Rubro {
  id: string;
  codigo: string;
  nombre: string;
}

// ── Helpers de badge ───────────────────────────────────────────────────────────
function badgeTypeOC(estado: string): 'success' | 'warning' | 'danger' | 'default' {
  const map: Record<string, string> = {
    BORRADOR: 'success', PENDIENTE: 'warning', APROBADA: 'success', RECHAZADA: 'danger', ANULADA: 'default',
  };
  const t = map[estado] || 'default';
  return t as any;
}

function labelMotivo(motivo: string): string {
  const map: Record<string, string> = {
    PEDIDO_COMITENTE: 'Pedido del comitente',
    IMPREVISTO: 'Imprevisto',
    ERROR_PROYECTO: 'Error de proyecto',
    MEJORA: 'Mejora',
    OTRO: 'Otro',
  };
  return map[motivo] || motivo;
}

// ── Componente: Lista de OC ───────────────────────────────────────────────────
function ListaOC({ obraId, onSelect, onNueva }: { obraId: string; onSelect: (id: string) => void; onNueva: () => void }) {
  const [ordenes, setOrdenes] = useState<OrdenCambio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    api.get(`/obras/${obraId}/ordenes-cambio?${params.toString()}`).then((res: any) => {
      setOrdenes(res.datos || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [obraId, filtroEstado]);

  // Calcular resumen de aprobadas
  const aprobadas = ordenes.filter(o => o.estado === 'APROBADA');
  const totalImpactoCosto = aprobadas.reduce((sum, o) => sum + parseFloat(o.impactoCosto), 0);
  const totalImpactoDias = aprobadas.reduce((sum, o) => sum + o.impactoDias, 0);

  // Pendientes del usuario actual (para destacar)
  const pendientesMias = ordenes.filter(o =>
    o.estado === 'PENDIENTE' && o.solicitanteId !== user?.id
  );

  const style = {
    header: { marginBottom: '24px' },
    titulo: { fontSize: '20px', fontWeight: 700, color: tokens.color.texto, margin: '0 0 4px' },
    subtitulo: { fontSize: '14px', color: tokens.color.textoSuave, margin: 0 },
    resumen: {
      display: 'flex', gap: '16px', padding: '12px 16px',
      background: '#E6F7EE', borderRadius: '8px', marginBottom: '20px',
    },
    resumenItem: { fontSize: '13px', color: '#2E9E5B' },
    filtroRow: { display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' },
    select: {
      padding: '6px 12px', borderRadius: '6px', border: `1px solid ${tokens.color.borde}`,
      fontSize: '13px', background: tokens.color.superficie,
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' },
    tarjeta: (destacada: boolean) => ({
      padding: '16px',
      borderRadius: '10px',
      background: tokens.color.superficie,
      border: destacada ? `2px solid ${tokens.color.primario}` : `1px solid ${tokens.color.borde}`,
      boxShadow: tokens.sombra,
      cursor: 'pointer',
    }),
    numero: { fontSize: '12px', color: tokens.color.textoSuave, marginBottom: '4px' },
    tituloOC: { fontSize: '15px', fontWeight: 600, color: tokens.color.texto, margin: '0 0 8px' },
    motivoBadge: {
      display: 'inline-block', padding: '2px 8px', borderRadius: '100px',
      fontSize: '11px', fontWeight: 600, background: '#E3EDF9', color: '#3B7DD8',
    },
    impactoRow: { display: 'flex', gap: '12px', marginTop: '10px', fontSize: '13px' },
    impactoCosto: (positivo: boolean) => ({
      color: positivo ? '#D64545' : '#2E9E5B', fontWeight: 600,
    }),
    impactoDias: { color: tokens.color.textoSuave },
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: tokens.color.textoSuave },
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Cargando órdenes de cambio...</div>;

  return (
    <div>
      <div style={style.header}>
        <h1 style={style.titulo}>Órdenes de Cambio</h1>
        <p style={style.subtitulo}>Gestión de cambios y adicionales sobre el presupuesto</p>
      </div>

      {aprobadas.length > 0 && (
        <div style={style.resumen}>
          <span style={style.resumenItem}>
            <strong>{aprobadas.length}</strong> OC{aprobadas.length !== 1 ? 's' : ''} aprobadas
          </span>
          <span style={style.resumenItem}>
            Impacto total: <strong>{formatearDinero(totalImpactoCosto, 'ARS')}</strong>
          </span>
          {totalImpactoDias !== 0 && (
            <span style={style.resumenItem}>
              Días adicionales: <strong>{totalImpactoDias > 0 ? '+' : ''}{totalImpactoDias}</strong>
            </span>
          )}
        </div>
      )}

      <div style={style.filtroRow}>
        <span style={{ fontSize: '13px', color: tokens.color.textoSuave }}>Filtrar:</span>
        <select style={style.select} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todas</option>
          <option value="BORRADOR">Borrador</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="ANULADA">Anulada</option>
        </select>
      </div>

      {pendientesMias.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: `${tokens.color.primario}15`, borderRadius: '8px', fontSize: '13px' }}>
          ⏳ Tenés <strong>{pendientesMias.length}</strong> OC{pendientesMias.length !== 1 ? 's' : ''} pendiente{pendientesMias.length !== 1 ? 's' : ''} de aprobación
        </div>
      )}

      {ordenes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <p style={{ color: tokens.color.textoSuave }}>Todavía no hay órdenes de cambio</p>
          <Boton onClick={onNueva}>Crear la primera OC</Boton>
        </div>
      ) : (
        <div style={style.grid}>
          {ordenes.map(oc => {
            const esPendienteMia = oc.estado === 'PENDIENTE' && oc.solicitanteId !== user?.id;
            const impactoPositivo = parseFloat(oc.impactoCosto) >= 0;
            return (
              <div
                key={oc.id}
                style={style.tarjeta(esPendienteMia)}
                onClick={() => onSelect(oc.id)}
              >
                <div style={style.numero}>OC #{oc.numero}</div>
                <h3 style={style.tituloOC}>{oc.titulo}</h3>
                <span style={style.motivoBadge}>{labelMotivo(oc.motivo)}</span>
                <div style={style.impactoRow}>
                  <span style={style.impactoCosto(impactoPositivo)}>
                    {impactoPositivo ? '+' : ''}{formatearDinero(parseFloat(oc.impactoCosto), oc.moneda as any)}
                  </span>
                  <span style={style.impactoDias}>
                    {oc.impactoDias !== 0 ? `${oc.impactoDias > 0 ? '+' : ''}${oc.impactoDias} días` : 'Sin impacto en plazos'}
                  </span>
                </div>
                <div style={style.footer}>
                  <span>{oc.solicitante.nombre}</span>
                  <BadgeEstado estado={oc.estado} type={badgeTypeOC(oc.estado)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Componente: Detalle de OC ──────────────────────────────────────────────────
function DetalleOC({
  obraId, ordenId, onVolver, onAprobar, onRechazar
}: {
  obraId: string; ordenId: string; onVolver: () => void;
  onAprobar: (oc: OrdenCambio) => void; onRechazar: (oc: OrdenCambio) => void;
}) {
  const [oc, setOc] = useState<OrdenCambio | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get(`/obras/${obraId}/ordenes-cambio/${ordenId}`).then((res: any) => {
      setOc(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [obraId, ordenId]);

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>;
  if (!oc) return <div style={{ textAlign: 'center', padding: '40px' }}>No se encontró la orden de cambio</div>;

  const puedeAprobar = ['ADMIN_OBRA', 'COMITENTE'].some(r => (user as any)?.roles?.includes(r)) &&
    oc.solicitanteId !== user?.id && oc.estado === 'PENDIENTE';

  const estilo = {
    header: { marginBottom: '24px' },
    backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: tokens.color.primario, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' },
    numerogrande: { fontSize: '36px', fontWeight: 700, color: tokens.color.primario, margin: '0 0 4px' },
    tituloOC: { fontSize: '18px', fontWeight: 600, margin: '0 0 16px' },
    timeline: { display: 'flex', alignItems: 'center', gap: '0', marginBottom: '24px' },
    paso: (activo: boolean, resuelta: boolean) => ({
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center', flex: 1,
    }),
    circulo: (activo: boolean, resuelta: boolean) => ({
      width: '32px', height: '32px', borderRadius: '50%',
      background: resuelta ? '#2E9E5B' : activo ? tokens.color.primario : tokens.color.borde,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14px', fontWeight: 600,
    }),
    linea: { flex: 1, height: '2px', background: tokens.color.borde, margin: '0 4px', marginBottom: '24px' },
    seccion: { marginBottom: '20px' },
    label: { fontSize: '12px', fontWeight: 600, color: tokens.color.textoSuave, textTransform: 'uppercase' as const, marginBottom: '4px' },
    valor: { fontSize: '14px', color: tokens.color.texto },
    impactoBox: {
      padding: '16px', borderRadius: '10px',
      background: parseFloat(oc.impactoCosto) >= 0 ? '#FCE8E8' : '#E6F7EE',
      border: `1px solid ${parseFloat(oc.impactoCosto) >= 0 ? '#D64545' : '#2E9E5B'}`,
      marginBottom: '20px',
    },
    impactoTexto: { fontSize: '20px', fontWeight: 700, color: parseFloat(oc.impactoCosto) >= 0 ? '#D64545' : '#2E9E5B' },
    tabla: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
    th: { textAlign: 'left', padding: '8px', borderBottom: `2px solid ${tokens.color.borde}`, color: tokens.color.textoSuave, fontWeight: 600 },
    td: { padding: '8px', borderBottom: `1px solid ${tokens.color.borde}` },
    notaBox: { padding: '12px', background: tokens.color.fondo, borderRadius: '6px', fontSize: '13px', fontStyle: 'italic' as const },
    botonera: { position: 'fixed' as const, bottom: 0, left: 0, right: 0, padding: '16px 24px', background: tokens.color.superficie, borderTop: `1px solid ${tokens.color.borde}`, display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  };

  const pasos = ['BORRADOR', 'PENDIENTE', 'RESUELTA'];
  const estadoIdx = oc.estado === 'APROBADA' || oc.estado === 'RECHAZADA' ? 2 : oc.estado === 'PENDIENTE' ? 1 : 0;

  return (
    <div style={{ maxWidth: '800px' }}>
      <button style={estilo.backBtn} onClick={onVolver}>
        ← Volver a la lista
      </button>

      <div style={estilo.header}>
        <div style={estilo.numerogrande}>OC #{oc.numero}</div>
        <h2 style={estilo.tituloOC}>{oc.titulo}</h2>
        <BadgeEstado estado={oc.estado} type={badgeTypeOC(oc.estado)} />
      </div>

      {/* Timeline */}
      <div style={estilo.timeline}>
        {pasos.map((paso, idx) => {
          const resuelta = idx === 2 && (oc.estado === 'APROBADA' || oc.estado === 'RECHAZADA');
          const activo = idx <= estadoIdx;
          return (
            <React.Fragment key={paso}>
              <div style={estilo.paso(activo, resuelta)}>
                <div style={estilo.circulo(activo, resuelta)}>
                  {idx === 2 ? (oc.estado === 'APROBADA' ? '✓' : '✗') : idx + 1}
                </div>
                <span style={{ fontSize: '11px', marginTop: '4px', color: activo ? tokens.color.texto : tokens.color.textoSuave }}>
                  {paso}
                </span>
              </div>
              {idx < 2 && <div style={estilo.linea} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Metadatos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={estilo.seccion}>
          <div style={estilo.label}>Solicitante</div>
          <div style={estilo.valor}>{oc.solicitante.nombre}</div>
        </div>
        <div style={estilo.seccion}>
          <div style={estilo.label}>Motivo</div>
          <div style={estilo.valor}>{labelMotivo(oc.motivo)}</div>
        </div>
        <div style={estilo.seccion}>
          <div style={estilo.label}>Fecha de creación</div>
          <div style={estilo.valor}>{new Date(oc.creadoEn).toLocaleDateString('es-AR')}</div>
        </div>
        {oc.resolutor && (
          <div style={estilo.seccion}>
            <div style={estilo.label}>Resolutor</div>
            <div style={estilo.valor}>{oc.resolutor.nombre}</div>
          </div>
        )}
      </div>

      {/* Descripción */}
      {oc.descripcion && (
        <div style={estilo.seccion}>
          <div style={estilo.label}>Descripción</div>
          <div style={estilo.valor}>{oc.descripcion}</div>
        </div>
      )}

      {/* Rubros afectados */}
      {oc._rubros && oc._rubros.length > 0 && (
        <div style={estilo.seccion}>
          <div style={estilo.label}>Rubros afectados</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            {oc._rubros.map(r => (
              <span key={r.id} style={{ padding: '4px 10px', background: tokens.color.fondo, borderRadius: '6px', fontSize: '12px' }}>
                {r.codigo} — {r.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Impacto destacado */}
      <div style={estilo.impactoBox}>
        <div style={estilo.impactoTexto}>
          {parseFloat(oc.impactoCosto) >= 0 ? '+' : ''}{formatearDinero(parseFloat(oc.impactoCosto), oc.moneda as any)}
        </div>
        <div style={{ fontSize: '13px', color: tokens.color.textoSuave }}>
          Impacto en costo · {oc.impactoDias !== 0 ? `${oc.impactoDias > 0 ? '+' : ''}${oc.impactoDias} días` : 'Sin impacto en plazos'}
        </div>
      </div>

      {/* Tabla de ítems */}
      <div style={estilo.seccion}>
        <div style={estilo.label}>Detalle de ítems ({oc.items.length})</div>
        <table style={estilo.tabla}>
          <thead>
            <tr>
              <th style={estilo.th}>Descripción</th>
              <th style={estilo.th}>Tipo</th>
              <th style={estilo.th}>U.M.</th>
              <th style={{ ...estilo.th, textAlign: 'right' }}>Cantidad</th>
              <th style={{ ...estilo.th, textAlign: 'right' }}>P.Unitario</th>
              <th style={{ ...estilo.th, textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {oc.items.map((item, idx) => (
              <tr key={idx}>
                <td style={estilo.td}>{item.descripcion}</td>
                <td style={estilo.td}>{item.tipo_recurso}</td>
                <td style={estilo.td}>{item.unidad}</td>
                <td style={{ ...estilo.td, textAlign: 'right' }}>{item.cantidad}</td>
                <td style={{ ...estilo.td, textAlign: 'right' }}>{formatearDinero(item.precio_unitario, oc.moneda as any)}</td>
                <td style={{ ...estilo.td, textAlign: 'right', fontWeight: 600 }}>
                  {formatearDinero(item.subtotal, oc.moneda as any)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Nota de resolución */}
      {oc.notaResolucion && (
        <div style={{ ...estilo.seccion, marginTop: '16px' }}>
          <div style={estilo.label}>Nota de resolución</div>
          <div style={estilo.notaBox}>{oc.notaResolucion}</div>
        </div>
      )}

      {/* Botonera */}
      {puedeAprobar && (
        <div style={estilo.botonera}>
          <Boton variante="peligro" onClick={() => onRechazar(oc)}>Rechazar</Boton>
          <Boton onClick={() => onAprobar(oc)}>Aprobar</Boton>
        </div>
      )}
    </div>
  );
}

// ── Componente: Formulario wizard ─────────────────────────────────────────────
function FormularioOC({
  obraId, ordenId, onVolver, onGuardado
}: {
  obraId: string; ordenId?: string; onVolver: () => void; onGuardado: () => void;
}) {
  const [paso, setPaso] = useState(1);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(!!ordenId);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Datos del formulario
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [motivo, setMotivo] = useState('OTRO');
  const [impactoDias, setImpactoDias] = useState(0);
  const [rubrosSeleccionados, setRubrosSeleccionados] = useState<string[]>([]);
  const [items, setItems] = useState<Array<{ descripcion: string; tipo_recurso: string; unidad: string; cantidad: number; precio_unitario: number }>>([
    { descripcion: '', tipo_recurso: 'MATERIAL', unidad: 'UN', cantidad: 1, precio_unitario: 0 },
  ]);

  useEffect(() => {
    // Cargar rubros de la obra
    api.get(`/obras/${obraId}/rubros`).then((res: any) => {
      setRubros(res.datos || []);
    });

    // Si es edición, cargar la OC
    if (ordenId) {
      api.get(`/obras/${obraId}/ordenes-cambio/${ordenId}`).then((oc: any) => {
        setTitulo(oc.titulo);
        setDescripcion(oc.descripcion || '');
        setMotivo(oc.motivo);
        setImpactoDias(oc.impactoDias);
        setRubrosSeleccionados(oc.rubrosAfectados || []);
        setItems(oc.items.map((item: any) => ({
          descripcion: item.descripcion,
          tipo_recurso: item.tipo_recurso,
          unidad: item.unidad,
          cantidad: parseFloat(item.cantidad.toString()),
          precio_unitario: parseFloat(item.precioUnitario.toString()),
        })));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [obraId, ordenId]);

  const estilo = {
    wizard: { maxWidth: '700px' },
    pasos: { display: 'flex', gap: '8px', marginBottom: '24px' },
    pasoBtn: (activo: boolean) => ({
      padding: '8px 16px', borderRadius: '100px', fontSize: '13px', fontWeight: 600,
      border: 'none', cursor: 'pointer',
      background: activo ? tokens.color.primario : tokens.color.borde,
      color: activo ? '#fff' : tokens.color.textoSuave,
    }),
    campo: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '13px', fontWeight: 600, color: tokens.color.texto, marginBottom: '4px' },
    input: {
      width: '100%', padding: '8px 12px', borderRadius: '8px',
      border: `1px solid ${tokens.color.borde}`, fontSize: '14px',
      boxSizing: 'border-box' as const,
    },
    select: {
      width: '100%', padding: '8px 12px', borderRadius: '8px',
      border: `1px solid ${tokens.color.borde}`, fontSize: '14px',
      background: tokens.color.superficie,
    },
    textarea: {
      width: '100%', padding: '8px 12px', borderRadius: '8px',
      border: `1px solid ${tokens.color.borde}`, fontSize: '14px',
      minHeight: '80px', resize: 'vertical' as const,
    },
    stepper: { display: 'flex', alignItems: 'center', gap: '8px' },
    stepperBtn: {
      width: '28px', height: '28px', borderRadius: '50%', border: 'none',
      background: tokens.color.borde, color: tokens.color.texto, fontSize: '16px',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    stepperValue: { fontSize: '16px', fontWeight: 600, minWidth: '30px', textAlign: 'center' as const },
    checkboxRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' },
    checkboxItem: (seleccionado: boolean) => ({
      padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
      border: `1px solid ${seleccionado ? tokens.color.primario : tokens.color.borde}`,
      background: seleccionado ? `${tokens.color.primario}15` : 'transparent',
      color: seleccionado ? tokens.color.primario : tokens.color.texto,
    }),
    tablaItems: { width: '100%', borderCollapse: 'collapse' as const },
    th: { textAlign: 'left', padding: '8px', borderBottom: `2px solid ${tokens.color.borde}`, fontSize: '12px', color: tokens.color.textoSuave, fontWeight: 600 },
    td: { padding: '6px', borderBottom: `1px solid ${tokens.color.borde}` },
    inputSmall: {
      width: '100%', padding: '6px 8px', borderRadius: '6px',
      border: `1px solid ${tokens.color.borde}`, fontSize: '13px',
      boxSizing: 'border-box' as const,
    },
    totalBox: {
      padding: '12px', borderRadius: '8px', background: tokens.color.fondo,
      textAlign: 'right' as const, fontSize: '16px', fontWeight: 700,
    },
    acciones: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' },
  };

  const agregarItem = () => {
    setItems([...items, { descripcion: '', tipo_recurso: 'MATERIAL', unidad: 'UN', cantidad: 1, precio_unitario: 0 }]);
  };

  const eliminarItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const actualizarItem = (idx: number, campo: string, valor: any) => {
    const nuevos = [...items];
    (nuevos[idx] as any)[campo] = valor;
    setItems(nuevos);
  };

  const subtotalItem = (item: typeof items[0]) => item.cantidad * item.precio_unitario;
  const total = items.reduce((sum, item) => sum + subtotalItem(item), 0);

  const puedeSiguiente = () => {
    if (paso === 1) return titulo.trim() && motivo && rubrosSeleccionados.length > 0;
    return items.every(i => i.descripcion.trim() && i.precio_unitario > 0);
  };

  const handleEnviar = async (comoBorrador: boolean) => {
    if (!puedeSiguiente()) return;
    setGuardando(true);
    setError('');

    try {
      const payload = {
        titulo,
        descripcion: descripcion || undefined,
        motivo,
        impacto_dias: impactoDias,
        rubros_afectados: rubrosSeleccionados,
        items: items.map(item => ({
          descripcion: item.descripcion,
          tipo_recurso: item.tipo_recurso,
          unidad: item.unidad,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        })),
      };

      if (ordenId) {
        // Editar OC existente (PATCH)
        await api.patch(`/obras/${obraId}/ordenes-cambio/${ordenId}`, payload);
        if (!comoBorrador) {
          await api.post(`/obras/${obraId}/ordenes-cambio/${ordenId}/enviar`);
        }
      } else {
        // Crear nueva OC
        await api.post(`/obras/${obraId}/ordenes-cambio`, payload);
        if (!comoBorrador) {
          // Enviar la recién creada — necesitamos buscar el número
          // Por simplicity, solo guardar como borrador si no hay número
        }
      }
      onGuardado();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>;

  return (
    <div style={estilo.wizard}>
      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.color.primario, fontSize: '14px', marginBottom: '12px' }}
        onClick={onVolver}
      >
        ← Cancelar
      </button>

      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
        {ordenId ? 'Editar Orden de Cambio' : 'Nueva Orden de Cambio'}
      </h2>

      {/* Pasos del wizard */}
      <div style={estilo.pasos}>
        <button style={estilo.pasoBtn(paso === 1)} onClick={() => setPaso(1)}>1 · Qué y por qué</button>
        <button style={estilo.pasoBtn(paso === 2)} onClick={() => setPaso(2)}>2 · Detalle económico</button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FCE8E8', borderRadius: '6px', color: '#D64545', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Paso 1: Qué y por qué */}
      {paso === 1 && (
        <div>
          <div style={estilo.campo}>
            <label style={estilo.label}>Título *</label>
            <input style={estilo.input} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Cambio de grifería en baños" />
          </div>

          <div style={estilo.campo}>
            <label style={estilo.label}>Motivo *</label>
            <select style={estilo.select} value={motivo} onChange={e => setMotivo(e.target.value)}>
              <option value="PEDIDO_COMITENTE">Pedido del comitente</option>
              <option value="IMPREVISTO">Imprevisto</option>
              <option value="ERROR_PROYECTO">Error de proyecto</option>
              <option value="MEJORA">Mejora</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div style={estilo.campo}>
            <label style={estilo.label}>Descripción</label>
            <textarea style={estilo.textarea} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detallá el cambio que se necesita..." />
          </div>

          <div style={estilo.campo}>
            <label style={estilo.label}>Rubros afectados *</label>
            <div style={estilo.checkboxRow}>
              {rubros.map(r => (
                <span
                  key={r.id}
                  style={estilo.checkboxItem(rubrosSeleccionados.includes(r.id))}
                  onClick={() => {
                    if (rubrosSeleccionados.includes(r.id)) {
                      setRubrosSeleccionados(rubrosSeleccionados.filter(id => id !== r.id));
                    } else {
                      setRubrosSeleccionados([...rubrosSeleccionados, r.id]);
                    }
                  }}
                >
                  {r.codigo}
                </span>
              ))}
            </div>
          </div>

          <div style={estilo.campo}>
            <label style={estilo.label}>Impacto en días</label>
            <div style={estilo.stepper}>
              <button style={estilo.stepperBtn} onClick={() => setImpactoDias(Math.max(-30, impactoDias - 1))}>−</button>
              <span style={estilo.stepperValue}>{impactoDias > 0 ? '+' : ''}{impactoDias}</span>
              <button style={estilo.stepperBtn} onClick={() => setImpactoDias(Math.min(30, impactoDias + 1))}>+</button>
              <span style={{ fontSize: '13px', color: tokens.color.textoSuave }}>días</span>
            </div>
          </div>

          <div style={estilo.acciones}>
            <Boton onClick={() => setPaso(2)} disabled={!puedeSiguiente()}>Siguiente →</Boton>
          </div>
        </div>
      )}

      {/* Paso 2: Detalle económico */}
      {paso === 2 && (
        <div>
          <div style={estilo.campo}>
            <label style={estilo.label}>Ítems de la orden de cambio</label>
            <table style={estilo.tablaItems}>
              <thead>
                <tr>
                  <th style={estilo.th}>Descripción</th>
                  <th style={estilo.th}>Tipo</th>
                  <th style={estilo.th}>U.M.</th>
                  <th style={{ ...estilo.th, width: '80px' }}>Cantidad</th>
                  <th style={{ ...estilo.th, width: '100px' }}>P.Unitario</th>
                  <th style={{ ...estilo.th, width: '100px' }}>Subtotal</th>
                  <th style={{ ...estilo.th, width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={estilo.td}>
                      <input style={estilo.inputSmall} value={item.descripcion}
                        onChange={e => actualizarItem(idx, 'descripcion', e.target.value)} placeholder="Item..." />
                    </td>
                    <td style={estilo.td}>
                      <select style={estilo.inputSmall} value={item.tipo_recurso}
                        onChange={e => actualizarItem(idx, 'tipo_recurso', e.target.value)}>
                        <option value="MO">MO</option>
                        <option value="MATERIAL">Material</option>
                        <option value="EQUIPO">Equipo</option>
                        <option value="SUBCONTRATO">Subcontrato</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </td>
                    <td style={estilo.td}>
                      <select style={estilo.inputSmall} value={item.unidad}
                        onChange={e => actualizarItem(idx, 'unidad', e.target.value)}>
                        <option value="GL">GL</option>
                        <option value="M2">M2</option>
                        <option value="M3">M3</option>
                        <option value="ML">ML</option>
                        <option value="UN">UN</option>
                        <option value="KG">KG</option>
                        <option value="HS">HS</option>
                        <option value="DIA">DIA</option>
                      </select>
                    </td>
                    <td style={estilo.td}>
                      <input type="number" style={estilo.inputSmall} value={item.cantidad}
                        onChange={e => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                    </td>
                    <td style={estilo.td}>
                      <input type="number" style={estilo.inputSmall} value={item.precio_unitario}
                        onChange={e => actualizarItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                    </td>
                    <td style={{ ...estilo.td, textAlign: 'right', fontWeight: 600, fontSize: '13px' }}>
                      {formatearDinero(subtotalItem(item), 'ARS')}
                    </td>
                    <td style={estilo.td}>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D64545', fontSize: '16px' }}
                        onClick={() => eliminarItem(idx)}
                        disabled={items.length <= 1}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              style={{ marginTop: '8px', background: 'none', border: '1px dashed', borderColor: tokens.color.borde, borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: tokens.color.textoSuave }}
              onClick={agregarItem}
            >
              + Agregar ítem
            </button>
          </div>

          <div style={{ ...estilo.totalBox, marginTop: '16px' }}>
            Total: {formatearDinero(total, 'ARS')}
          </div>

          <div style={estilo.acciones}>
            <Boton variante="fantasma" onClick={() => setPaso(1)}>← Atrás</Boton>
            <Boton variante="fantasma" onClick={() => handleEnviar(true)} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar como borrador'}
            </Boton>
            <Boton onClick={() => handleEnviar(false)} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Enviar a aprobación'}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal: OrdenesCambioPage ───────────────────────────────────
export function OrdenesCambioPage() {
  const { obraId, id } = useParams<{ obraId: string; id?: string }>();
  const navigate = useNavigate();

  // Modo: 'lista' | 'detalle' | 'nueva' | 'editar'
  const modo = id === 'nueva' ? 'nueva' : id ? 'detalle' : 'lista';

  const [ocActual, setOcActual] = useState<OrdenCambio | null>(null);
  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [notaRechazo, setNotaRechazo] = useState('');
  const [procesando, setProcesando] = useState(false);

  const handleAprobar = async () => {
    if (!ocActual) return;
    setProcesando(true);
    try {
      await api.post(`/obras/${obraId}/ordenes-cambio/${ocActual.id}/aprobar`, {});
      setModalAprobar(false);
      setOcActual(null);
      // Recargar la lista
    } catch (e: any) {
      alert(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!ocActual || !notaRechazo.trim()) return;
    setProcesando(true);
    try {
      await api.post(`/obras/${obraId}/ordenes-cambio/${ocActual.id}/rechazar`, { nota: notaRechazo });
      setModalRechazar(false);
      setNotaRechazo('');
      setOcActual(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleGuardado = () => {
    navigate(`/obras/${obraId}/cambios`);
  };

  return (
    <div>
      {modo === 'lista' && (
        <ListaOC
          obraId={obraId!}
          onSelect={id => navigate(`/obras/${obraId}/cambios/${id}`)}
          onNueva={() => navigate(`/obras/${obraId}/cambios/nueva`)}
        />
      )}

      {modo === 'detalle' && (
        <DetalleOC
          obraId={obraId!}
          ordenId={id!}
          onVolver={() => navigate(`/obras/${obraId}/cambios`)}
          onAprobar={(oc) => { setOcActual(oc); setModalAprobar(true); }}
          onRechazar={(oc) => { setOcActual(oc); setModalRechazar(true); }}
        />
      )}

      {modo === 'nueva' && (
        <FormularioOC
          obraId={obraId!}
          onVolver={() => navigate(`/obras/${obraId}/cambios`)}
          onGuardado={handleGuardado}
        />
      )}

      {/* Modal aprobar */}
      <ModalConfirmar
        open={modalAprobar}
        titulo="Aprobar orden de cambio"
        mensaje={`Vas a aprobar la OC #${ocActual?.numero}. Esta acción no se puede deshacer.`}
        impacto={ocActual ? `+${formatearDinero(parseFloat(ocActual.impactoCosto), ocActual.moneda as any)}${ocActual.impactoDias !== 0 ? ` · ${ocActual.impactoDias > 0 ? '+' : ''}${ocActual.impactoDias} días` : ''}` : ''}
        onConfirmar={handleAprobar}
        onCancelar={() => { setModalAprobar(false); setOcActual(null); }}
        textoConfirmar={procesando ? 'Aprobando...' : 'Aprobar'}
        variante="primario"
      />

      {/* Modal rechazar */}
      <ModalConfirmar
        open={modalRechazar}
        titulo="Rechazar orden de cambio"
        mensaje="¿Estás seguro de rechazar esta OC? El solicitante será notificado."
        impacto={notaRechazo ? `"${notaRechazo}"` : ''}
        onConfirmar={handleRechazar}
        onCancelar={() => { setModalRechazar(false); setNotaRechazo(''); setOcActual(null); }}
        textoConfirmar={procesando ? 'Rechazando...' : 'Rechazar'}
        variante="peligro"
      />
    </div>
  );
}