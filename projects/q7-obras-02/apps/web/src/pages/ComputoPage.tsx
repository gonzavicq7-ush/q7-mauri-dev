import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tarjeta } from '@q7/ui';
import { Boton } from '@q7/ui';
import { BadgeEstado, badgeType } from '@q7/ui';
import { EstadoVacio } from '@q7/ui';
import { ModalConfirmar } from '@q7/ui';
import { tokens } from '@q7/ui/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Tipos ──

interface Rubro {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  origen: string;
  total_cantidad: number;
  tareas_count: number;
  _count?: { tareas: number };
}

interface Tarea {
  id: string;
  codigo: string;
  descripcion: string;
  nivel: number;
  unidad: string;
  cantidad: string | null;
  orden: number;
  estado: string;
  hijos: Tarea[];
  enUso?: boolean;
}

// ── Modal Agregar Rubro ──

function ModalAgregarRubro({
  open,
  onClose,
  onAgregar,
  rubrosYaAgregados,
}: {
  open: boolean;
  onClose: () => void;
  onAgregar: (data: { codigo?: string; nombre: string; esPersonalizado: boolean }) => void;
  rubrosYaAgregados: string[];
}) {
  const [tab, setTab] = useState<'catalogo' | 'personalizado'>('catalogo');
  const [nombrePers, setNombrePers] = useState('');
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [catalogo, setCatalogo] = useState<{ codigo: string; nombre: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetch(`${API}/api/v1/catalogo/rubros`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => setCatalogo(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const toggleSeleccion = (codigo: string) => {
    setSeleccionados(prev =>
      prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]
    );
  };

  const handleAgregar = () => {
    if (tab === 'catalogo') {
      seleccionados.forEach(codigo => {
        onAgregar({ codigo, nombre: '', esPersonalizado: false });
      });
    } else {
      if (!nombrePers.trim()) return;
      onAgregar({ nombre: nombrePers.trim(), esPersonalizado: true });
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{
        backgroundColor: tokens.color.superficie, borderRadius: tokens.radius,
        boxShadow: '0 4px 20px rgba(0,0,0,.15)',
        maxWidth: '560px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${tokens.color.borde}` }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: tokens.color.texto }}>Agregar rubro</h3>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${tokens.color.borde}` }}>
          <button
            onClick={() => setTab('catalogo')}
            style={{
              flex: 1, padding: '12px', border: 'none', background: 'none',
              fontSize: '14px', fontWeight: tab === 'catalogo' ? 600 : 400,
              color: tab === 'catalogo' ? tokens.color.primario : tokens.color.textoSuave,
              borderBottom: tab === 'catalogo' ? `2px solid ${tokens.color.primario}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            Del catálogo
          </button>
          <button
            onClick={() => setTab('personalizado')}
            style={{
              flex: 1, padding: '12px', border: 'none', background: 'none',
              fontSize: '14px', fontWeight: tab === 'personalizado' ? 600 : 400,
              color: tab === 'personalizado' ? tokens.color.primario : tokens.color.textoSuave,
              borderBottom: tab === 'personalizado' ? `2px solid ${tokens.color.primario}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            Personalizado
          </button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {tab === 'catalogo' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {catalogo.map(r => {
                const yaAgregado = rubrosYaAgregados.includes(r.codigo);
                return (
                  <div
                    key={r.codigo}
                    onClick={() => !yaAgregado && toggleSeleccion(r.codigo)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '8px',
                      background: yaAgregado ? tokens.color.fondo : seleccionados.includes(r.codigo) ? tokens.color.primario + '10' : 'none',
                      cursor: yaAgregado ? 'default' : 'pointer',
                      border: `1px solid ${tokens.color.borde}`,
                      opacity: yaAgregado ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(r.codigo)}
                      disabled={yaAgregado}
                      onChange={() => toggleSeleccion(r.codigo)}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: tokens.color.primario, fontWeight: 600 }}>
                      {r.codigo}
                    </span>
                    <span style={{ fontSize: '14px', color: tokens.color.texto }}>{r.nombre}</span>
                    {yaAgregado && (
                      <span style={{ marginLeft: 'auto', fontSize: '12px', color: tokens.color.textoSuave }}>
                        Ya agregado
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '6px' }}>
                Nombre del rubro
              </label>
              <input
                type="text"
                value={nombrePers}
                onChange={e => setNombrePers(e.target.value)}
                placeholder="Ej: Estructura metálica"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: `1px solid ${tokens.color.borde}`, fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${tokens.color.borde}`, display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Boton variante="fantasma" onClick={onClose}>Cancelar</Boton>
          <Boton
            variante="primario"
            onClick={handleAgregar}
            disabled={tab === 'catalogo' ? seleccionados.length === 0 : !nombrePers.trim()}
          >
            {tab === 'catalogo' ? `Agregar ${seleccionados.length} seleccionado${seleccionados.length !== 1 ? 's' : ''}` : 'Agregar'}
          </Boton>
        </div>
      </div>
    </div>
  );
}

// ── Wizard Importación ──

function WizardImportacion({
  open,
  onClose,
  obraId,
  onImportado,
}: {
  open: boolean;
  onClose: () => void;
  obraId: string;
  onImportado: () => void;
}) {
  const [paso, setPaso] = useState(1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [filasDetectadas, setFilasDetectadas] = useState<any[]>([]);
  const [resultado, setResultado] = useState<{ creados: { rubro: number; tarea: number }; advertencias: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePaso1 = async () => {
    if (!archivo) return;
    setLoading(true);

    // Parsear Excel simple (CSV fallback)
    const text = await archivo.text();
    const lineas = text.split('\n').filter(l => l.trim());
    const headers = lineas[0].split(/[,;\t]/).map(h => h.trim().toUpperCase());

    const filas = lineas.slice(1).map(l => {
      const cols = l.split(/[,;\t]/).map(c => c.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
      return obj;
    });

    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/computo/importar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas }),
      });
      const data = await res.json();
      setFilasDetectadas(data.filas_detectadas || []);
      setPaso(2);
    } catch {
      alert('Error al procesar archivo');
    } finally {
      setLoading(false);
    }
  };

  const handlePaso2 = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/computo/importar/confirmar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas_mapeadas: filasDetectadas }),
      });
      const data = await res.json();
      setResultado(data);
      setPaso(3);
    } catch {
      alert('Error al importar');
    } finally {
      setLoading(false);
    }
  };

  const handleCerrar = () => {
    setPaso(1);
    setArchivo(null);
    setFilasDetectadas([]);
    setResultado(null);
    onClose();
    onImportado();
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{
        backgroundColor: tokens.color.superficie, borderRadius: tokens.radius,
        boxShadow: '0 4px 20px rgba(0,0,0,.15)',
        maxWidth: '640px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${tokens.color.borde}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: tokens.color.texto }}>Importar desde Excel</h3>
          <button onClick={handleCerrar} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: tokens.color.textoSuave }}>×</button>
        </div>

        {/* Pasos */}
        <div style={{ display: 'flex', padding: '0 24px', borderBottom: `1px solid ${tokens.color.borde}` }}>
          {[1, 2, 3].map(p => (
            <div key={p} style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600,
                background: paso >= p ? tokens.color.primario : tokens.color.borde,
                color: paso >= p ? '#fff' : tokens.color.textoSuave,
              }}>
                {p}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px', color: paso >= p ? tokens.color.primario : tokens.color.textoSuave }}>
                {p === 1 ? 'Subir archivo' : p === 2 ? 'Revisar datos' : 'Resultado'}
              </div>
            </div>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {paso === 1 && (
            <div>
              <p style={{ fontSize: '14px', color: tokens.color.textoSuave, marginBottom: '16px' }}>
                Descargá la{' '}
                <a href="#" onClick={e => { e.preventDefault(); alert('En producción esto descarga la plantilla'); }}
                  style={{ color: tokens.color.primario }}>
                  plantilla oficial
                </a>{' '}
                y completala con tus datos.
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={e => setArchivo(e.target.files?.[0] || null)}
                style={{ marginBottom: '16px' }}
              />
              {archivo && (
                <div style={{ padding: '12px', background: tokens.color.fondo, borderRadius: '8px', fontSize: '14px' }}>
                  📄 {archivo.name}
                </div>
              )}
            </div>
          )}

          {paso === 2 && (
            <div>
              <p style={{ fontSize: '14px', color: tokens.color.textoSuave, marginBottom: '12px' }}>
                Se detectaron {filasDetectadas.length} filas. Revisá las advertencias.
              </p>
              <div style={{ maxHeight: '300px', overflow: 'auto', border: `1px solid ${tokens.color.borde}`, borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: tokens.color.fondo }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Rubro</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tarea</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Nivel</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Unidad</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasDetectadas.map((f, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${tokens.color.borde}` }}>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: tokens.color.primario }}>
                            {f.codigo_rubro || '?'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{f.tarea || f.descripcion}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{f.nivel}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{f.unidad}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{f.cantidad ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filasDetectadas.some(f => f.advertencia?.length > 0) && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#FDF3DC', borderRadius: '8px', fontSize: '13px' }}>
                  ⚠️ Hay advertencias que podés revisar antes de importar.
                </div>
              )}
            </div>
          )}

          {paso === 3 && resultado && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <h4 style={{ margin: '0 0 8px', fontSize: '18px', color: tokens.color.texto }}>
                Importación completada
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: '14px', color: tokens.color.textoSuave }}>
                Se crearon {resultado.creados.rubro} rubros y {resultado.creados.tarea} tareas
              </p>
              {resultado.advertencias.length > 0 && (
                <div style={{ textAlign: 'left', padding: '12px', background: '#FDF3DC', borderRadius: '8px', fontSize: '13px' }}>
                  <strong>Advertencias:</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                    {resultado.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${tokens.color.borde}`, display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {paso > 1 && (
            <Boton variante="fantasma" onClick={() => setPaso(p => p - 1)} disabled={loading}>
              Volver
            </Boton>
          )}
          {paso < 3 ? (
            <Boton variante="primario" onClick={paso === 1 ? handlePaso1 : handlePaso2} disabled={loading || (paso === 1 && !archivo)}>
              {loading ? 'Procesando...' : paso === 1 ? 'Detectar filas' : 'Importar'}
            </Boton>
          ) : (
            <Boton variante="primario" onClick={handleCerrar}>Cerrar</Boton>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Eliminar ──

function ModalEliminar({
  open,
  titulo,
  mensaje,
  onConfirmar,
  onCancelar,
}: {
  open: boolean;
  titulo: string;
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <ModalConfirmar
      open={open}
      titulo={titulo}
      mensaje={mensaje}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
      textoConfirmar="Eliminar"
      variante="peligro"
    />
  );
}

// ── Tarea Item ──

function TareaItem({
  tarea,
  nivel,
  onEdit,
  onDelete,
  onAgregarHija,
  obraId,
  refresh,
}: {
  tarea: Tarea;
  nivel: number;
  onEdit: (t: Tarea) => void;
  onDelete: (id: string) => void;
  onAgregarHija: (padreId: string) => void;
  obraId: string;
  refresh: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [descripcion, setDescripcion] = useState(tarea.descripcion);
  const [cantidad, setCantidad] = useState(tarea.cantidad || '');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await fetch(`${API}/api/v1/obras/${obraId}/tareas/${tarea.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion,
          cantidad: cantidad ? parseFloat(cantidad) : null,
        }),
      });
      setEditando(false);
      refresh();
    } finally {
      setGuardando(false);
    }
  };

  const indent = nivel * 20;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', marginLeft: `${indent}px`,
        borderRadius: '8px', border: `1px solid ${tokens.color.borde}`,
        marginBottom: '4px', background: tokens.color.superficie,
      }}>
        {nivel > 1 && (
          <span style={{ fontSize: '11px', color: tokens.color.textoSuave, fontFamily: 'monospace' }}>
            ↳
          </span>
        )}
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: tokens.color.primario, minWidth: '50px' }}>
          {tarea.codigo}
        </span>

        {editando ? (
          <>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: `1px solid ${tokens.color.borde}`, fontSize: '13px' }}
            />
            <input
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="Cant."
              style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: `1px solid ${tokens.color.borde}`, fontSize: '13px' }}
            />
            <Boton onClick={guardar} disabled={guardando} variante="primario">
              {guardando ? '...' : 'Guardar'}
            </Boton>
            <Boton onClick={() => setEditando(false)} variante="fantasma">
              Cancelar
            </Boton>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: '14px', color: tokens.color.texto }}>{tarea.descripcion}</span>
            <BadgeEstado
              estado={tarea.unidad}
              type={badgeType({}, tarea.unidad)}
            />
            {tarea.cantidad && (
              <span style={{ fontSize: '13px', color: tokens.color.textoSuave }}>
                {tarea.cantidad} {tarea.unidad}
              </span>
            )}
            <div style={{ display: 'flex', gap: '4px' }}>
              {nivel < 3 && (
                <button
                  onClick={() => onAgregarHija(tarea.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: tokens.color.primario }}
                  title="Agregar subtarea"
                >
                  + subtarea
                </button>
              )}
              <button
                onClick={() => setEditando(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: tokens.color.textoSuave }}
              >
                editar
              </button>
              {!tarea.enUso && (
                <button
                  onClick={() => onDelete(tarea.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: tokens.color.peligro }}
                >
                  eliminar
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {tarea.hijos?.map(hija => (
        <TareaItem
          key={hija.id}
          tarea={hija}
          nivel={nivel + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAgregarHija={onAgregarHija}
          obraId={obraId}
          refresh={refresh}
        />
      ))}
    </div>
  );
}

// ── Modal Agregar Tarea ──

function ModalAgregarTarea({
  open,
  onClose,
  rubroObraId,
  padreId,
  obraId,
  nivel,
  onAgregado,
}: {
  open: boolean;
  onClose: () => void;
  rubroObraId: string;
  padreId: string | null;
  obraId: string;
  nivel: number;
  onAgregado: () => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [unidad, setUnidad] = useState('UN');
  const [cantidad, setCantidad] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) return;

    setGuardando(true);
    try {
      await fetch(`${API}/api/v1/obras/${obraId}/tareas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubro_obra_id: rubroObraId,
          padre_id: padreId,
          descripcion: descripcion.trim(),
          nivel,
          unidad,
          cantidad: cantidad ? parseFloat(cantidad) : undefined,
        }),
      });
      setDescripcion('');
      onAgregado();
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{
        backgroundColor: tokens.color.superficie, borderRadius: tokens.radius,
        boxShadow: '0 4px 20px rgba(0,0,0,.15)',
        maxWidth: '440px', width: '90%', padding: '24px',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: tokens.color.texto }}>
          {padreId ? 'Agregar subtarea' : 'Agregar tarea'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>
              Descripción
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>
                Unidad
              </label>
              <select
                value={unidad}
                onChange={e => setUnidad(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px' }}
              >
                {['GL', 'M2', 'M3', 'ML', 'UN', 'KG', 'HS', 'DIA'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', color: tokens.color.textoSuave, marginBottom: '4px' }}>
                Cantidad
              </label>
              <input
                type="number"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                step="0.01"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Boton variante="fantasma" type="button" onClick={onClose}>Cancelar</Boton>
            <Boton variante="primario" type="submit" disabled={guardando || !descripcion.trim()}>
              {guardando ? 'Guardando...' : 'Agregar'}
            </Boton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página Principal ──

export function ComputoPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalRubro, setModalRubro] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [modalTarea, setModalTarea] = useState<{ open: boolean; padreId: string | null; nivel: number }>({ open: false, padreId: null, nivel: 1 });
  const [modalEliminar, setModalEliminar] = useState<{ open: boolean; id: string; tipo: 'rubro' | 'tarea' }>({ open: false, id: '', tipo: 'tarea' });

  const cargarRubros = useCallback(async () => {
    if (!obraId) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/rubros`, { credentials: 'include' });
      const data = await res.json();
      setRubros(Array.isArray(data) ? data : []);
      if (data.length > 0 && !rubroSeleccionado) {
        setRubroSeleccionado(data[0].id);
      }
    } catch {}
  }, [obraId, rubroSeleccionado]);

  const cargarTareas = useCallback(async () => {
    if (!obraId || !rubroSeleccionado) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/tareas?rubroId=${rubroSeleccionado}`, { credentials: 'include' });
      const data = await res.json();
      setTareas(Array.isArray(data) ? data : []);
    } catch {}
  }, [obraId, rubroSeleccionado]);

  useEffect(() => {
    if (obraId) {
      setLoading(true);
      Promise.all([cargarRubros()]).finally(() => setLoading(false));
    }
  }, [obraId]);

  useEffect(() => {
    if (rubroSeleccionado) {
      cargarTareas();
    }
  }, [rubroSeleccionado, cargarTareas]);

  const handleAgregarRubro = async (data: { codigo?: string; nombre: string; esPersonalizado: boolean }) => {
    if (!obraId) return;
    try {
      await fetch(`${API}/api/v1/obras/${obraId}/rubros`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.codigo ? { codigo: data.codigo } : { nombre: data.nombre }),
      });
      cargarRubros();
    } catch {}
  };

  const handleEliminarRubro = async () => {
    if (!obraId || !modalEliminar.id) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/rubros/${modalEliminar.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error?.message || 'No se pudo eliminar'}`);
      }
      setModalEliminar({ ...modalEliminar, open: false });
      if (rubroSeleccionado === modalEliminar.id) setRubroSeleccionado(null);
      cargarRubros();
    } catch {}
  };

  const handleEliminarTarea = async () => {
    if (!obraId || !modalEliminar.id) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/tareas/${modalEliminar.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error?.message || 'No se pudo eliminar'}`);
      }
      setModalEliminar({ ...modalEliminar, open: false });
      cargarTareas();
    } catch {}
  };

  const handleExportar = async () => {
    if (!obraId) return;
    try {
      const res = await fetch(`${API}/api/v1/obras/${obraId}/computo/exportar`, { credentials: 'include' });
      const data = await res.json();
      // Generar CSV y descargar
      const csv = [data.headers.join(','), ...data.filas.map((f: string[]) => f.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `computo-${obraId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const rubroActual = rubros.find(r => r.id === rubroSeleccionado);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <span style={{ color: tokens.color.textoSuave }}>Cargando cómputo...</span>
      </div>
    );
  }

  // Estado vacío
  if (rubros.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: tokens.color.texto }}>Cómputo</h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: tokens.color.textoSuave }}>
              Estructurá los rubros y tareas de tu obra
            </p>
          </div>
        </div>
        <EstadoVacio
          titulo="Todavía no cargaste el cómputo"
          descripcion="Empezá desde el catálogo, importá un Excel o copiá desde otra obra."
          cta={[
            { texto: 'Empezar del catálogo', onClick: () => setModalRubro(true) },
            { texto: 'Importar Excel', onClick: () => setWizardOpen(true) },
          ]}
        />
        <ModalAgregarRubro
          open={modalRubro}
          onClose={() => setModalRubro(false)}
          onAgregar={handleAgregarRubro}
          rubrosYaAgregados={[]}
        />
        <WizardImportacion
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          obraId={obraId!}
          onImportado={() => { cargarRubros(); setWizardOpen(false); }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: tokens.color.texto }}>Cómputo</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: tokens.color.textoSuave }}>
            {rubros.length} rubros · {tareas.length} tareas
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Boton variante="secundario" onClick={() => setWizardOpen(true)}>
            📥 Importar Excel
          </Boton>
          <Boton variante="secundario" onClick={handleExportar}>
            📤 Exportar
          </Boton>
          <Boton variante="primario" onClick={() => setModalRubro(true)}>
            + Agregar rubro
          </Boton>
        </div>
      </div>

      {/* Layout dos paneles */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Panel izquierdo: lista de rubros */}
        <div style={{ width: '280px', flexShrink: 0 }}>
          <Tarjeta padding="none">
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${tokens.color.borde}` }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: tokens.color.texto }}>Rubros</span>
            </div>
            {rubros.map(r => (
              <div
                key={r.id}
                onClick={() => setRubroSeleccionado(r.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${tokens.color.borde}`,
                  cursor: 'pointer',
                  background: r.id === rubroSeleccionado ? `${tokens.color.primario}10` : 'none',
                  borderLeft: r.id === rubroSeleccionado ? `3px solid ${tokens.color.primario}` : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: tokens.color.primario, fontWeight: 600 }}>
                    {r.codigo}
                  </span>
                  <span style={{ fontSize: '14px', color: tokens.color.texto, flex: 1 }}>{r.nombre}</span>
                </div>
                <div style={{ fontSize: '12px', color: tokens.color.textoSuave, marginTop: '2px' }}>
                  {r.tareas_count || r._count?.tareas || 0} tareas
                  {r.total_cantidad > 0 && ` · ${r.total_cantidad.toLocaleString('es-AR')}`}
                </div>
              </div>
            ))}
          </Tarjeta>
        </div>

        {/* Panel derecho: árbol de tareas */}
        <div style={{ flex: 1 }}>
          {rubroActual ? (
            <Tarjeta padding="none">
              <div style={{ padding: '16px', borderBottom: `1px solid ${tokens.color.borde}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: tokens.color.primario, fontWeight: 600 }}>
                    {rubroActual.codigo}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: tokens.color.texto, marginLeft: '8px' }}>
                    {rubroActual.nombre}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Boton
                    variante="fantasma"
                    onClick={() => setModalTarea({ open: true, padreId: null, nivel: 1 })}
                  >
                    + Tarea
                  </Boton>
                  <Boton
                    variante="peligro"
                    onClick={() => setModalEliminar({ open: true, id: rubroActual.id, tipo: 'rubro' })}
                  >
                    Eliminar rubro
                  </Boton>
                </div>
              </div>

              <div style={{ padding: '16px' }}>
                {tareas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: tokens.color.textoSuave }}>
                    <p style={{ margin: '0 0 12px' }}>No hay tareas en este rubro</p>
                    <Boton variante="primario" onClick={() => setModalTarea({ open: true, padreId: null, nivel: 1 })}>
                      Agregar la primera tarea
                    </Boton>
                  </div>
                ) : (
                  <div>
                    {tareas.map(t => (
                      <TareaItem
                        key={t.id}
                        tarea={t}
                        nivel={1}
                        onEdit={() => {}}
                        onDelete={(id) => setModalEliminar({ open: true, id, tipo: 'tarea' })}
                        onAgregarHija={(padreId) => setModalTarea({ open: true, padreId, nivel: 2 })}
                        obraId={obraId!}
                        refresh={cargarTareas}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <div style={{ textAlign: 'center', padding: '32px', color: tokens.color.textoSuave }}>
                Seleccioná un rubro para ver sus tareas
              </div>
            </Tarjeta>
          )}
        </div>
      </div>

      {/* Modals */}
      <ModalAgregarRubro
        open={modalRubro}
        onClose={() => setModalRubro(false)}
        onAgregar={handleAgregarRubro}
        rubrosYaAgregados={rubros.map(r => r.codigo)}
      />

      <WizardImportacion
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        obraId={obraId!}
        onImportado={() => { cargarRubros(); }}
      />

      {modalTarea.open && (
        <ModalAgregarTarea
          open={modalTarea.open}
          onClose={() => setModalTarea({ ...modalTarea, open: false })}
          rubroObraId={rubroSeleccionado!}
          padreId={modalTarea.padreId}
          obraId={obraId!}
          nivel={modalTarea.nivel}
          onAgregado={cargarTareas}
        />
      )}

      <ModalEliminar
        open={modalEliminar.open}
        titulo={modalEliminar.tipo === 'rubro' ? 'Eliminar rubro' : 'Eliminar tarea'}
        mensaje={modalEliminar.tipo === 'rubro'
          ? '¿Estás seguro de eliminar este rubro? Las tareas asociadas también se eliminarán.'
          : '¿Estás seguro de eliminar esta tarea?'}
        onConfirmar={modalEliminar.tipo === 'rubro' ? handleEliminarRubro : handleEliminarTarea}
        onCancelar={() => setModalEliminar({ ...modalEliminar, open: false })}
      />
    </div>
  );
}