/**
 * M3: Caja de obra — pantalla principal
 * /obras/:obraId/caja
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { tokens } from '@q7/ui';
import { Tarjeta } from '@q7/ui';
import { Dinero } from '@q7/ui';
import { Semaforo } from '@q7/ui';
import { BadgeEstado } from '@q7/ui';
import { BarraProgreso } from '@q7/ui';
import { ModalConfirmar } from '@q7/ui';
import { EstadoVacio } from '@q7/ui';

type TipoMovimiento = 'COMPROMISO' | 'PAGO';

interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  fecha: string;
  proveedorNombre: string;
  descripcion: string | null;
  moneda: string;
  importe: string;
  medioPago: string | null;
  estado: string;
  rubroObra: { id: string; codigo: string; nombre: string };
  tarea: { id: string; codigo: string; descripcion: string } | null;
  compromiso: { id: string; descripcion: string; importe: string } | null;
}

interface ResumenRubro {
  rubroId: string;
  rubroCodigo: string;
  rubroNombre: string;
  previsto: number;
  comprometido: number;
  pagado: number;
  ejecutado: number;
  proyeccion: number;
  desvioPct: number | null;
  semaforo: 'verde' | 'ambar' | 'rojo';
}

interface ResumenGlobal {
  previsto: number;
  comprometido: number;
  pagado: number;
  ejecutado: number;
  proyeccion: number;
  desvioPct: number | null;
  semaforo: 'verde' | 'ambar' | 'rojo';
  porRubro: ResumenRubro[];
}

interface RubroObra {
  id: string;
  codigo: string;
  nombre: string;
}

interface CompromisoAbierto {
  id: string;
  descripcion: string | null;
  importe: string;
  saldo: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR');
}

function fmtPct(n: number | null): string {
  if (n === null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// ── Componente: Drawer (mobile-friendly) ──────────────────────────────────────

function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
      }} />
      {/* Panel */}
      <div style={{
        position: 'relative', width: 'min(480px, 100vw)', height: '100%',
        background: tokens.color.superficie, boxShadow: '-4px 0 20px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: `1px solid ${tokens.color.borde}`,
        }}>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: tokens.color.textoSuave, padding: '4px 8px',
          }}>✕</button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Componente: SelectorRubro (combobox simple) ───────────────────────────────

function SelectorRubro({ value, onChange, rubros }: {
  value: string; onChange: (id: string) => void; rubros: RubroObra[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = rubros.find(r => r.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 12px', textAlign: 'left',
          border: `1px solid ${tokens.color.borde}`, borderRadius: '8px',
          background: tokens.color.superficie, fontSize: '14px',
          color: selected ? tokens.color.texto : tokens.color.textoSuave,
          cursor: 'pointer',
        }}
      >
        {selected ? `${selected.codigo} — ${selected.nombre}` : 'Seleccionar rubro…'}
      </button>
      {open && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: tokens.color.superficie, border: `1px solid ${tokens.color.borde}`,
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          zIndex: 600, listStyle: 'none', margin: 0, padding: '4px 0', maxHeight: '240px', overflowY: 'auto',
        }}>
          {rubros.map(r => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => { onChange(r.id); setOpen(false); }}
                style={{
                  width: '100%', padding: '10px 12px', textAlign: 'left',
                  background: r.id === value ? `${tokens.color.primario}12` : 'none',
                  border: 'none', cursor: 'pointer', fontSize: '14px',
                  color: tokens.color.texto,
                }}
              >
                <span style={{ fontWeight: 600 }}>{r.codigo}</span>
                {' '}{r.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Componente: AutocompletarProveedor ────────────────────────────────────────

function AutocompletarProveedor({ value, onChange, sugerencias }: {
  value: string; onChange: (v: string) => void; sugerencias: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtradas = sugerencias.filter(s =>
    s.toLowerCase().includes(value.toLowerCase()) && s !== value
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Nombre del proveedor o contratista"
        style={{
          width: '100%', padding: '10px 12px',
          border: `1px solid ${tokens.color.borde}`, borderRadius: '8px',
          fontSize: '14px', background: tokens.color.superficie,
          color: tokens.color.texto,
        }}
      />
      {open && filtradas.length > 0 && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: tokens.color.superficie, border: `1px solid ${tokens.color.borde}`,
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          zIndex: 600, listStyle: 'none', margin: 0, padding: '4px 0', maxHeight: '160px', overflowY: 'auto',
        }}>
          {filtradas.slice(0, 8).map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  width: '100%', padding: '8px 12px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '13px', color: tokens.color.texto,
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Componente: Formulario Registrar Movimiento ────────────────────────────────

function FormularioMovimiento({
  obraId, rubros, sugerenciasProveedor, onSuccess,
}: {
  obraId: string; rubros: RubroObra[];
  sugerenciasProveedor: string[];
  onSuccess: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimiento>('COMPROMISO');
  const [rubroId, setRubroId] = useState('');
  const [tareaId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [proveedor, setProveedor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [moneda] = useState('ARS');
  const [importe, setImporte] = useState('');
  const [medioPago, setMedioPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'OTRO' | ''>('');
  const [compromisoId, setCompromisoId] = useState('');
  const [compromisosAbiertos, setCompromisosAbiertos] = useState<CompromisoAbierto[]>([]);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar compromisos abiertos cuando cambia el rubro (solo si es PAGO)
  useEffect(() => {
    if (tipo === 'PAGO' && rubroId) {
      api.get(`/obras/${obraId}/caja/compromisos-abiertos?rubroId=${rubroId}`)
        .then(r => setCompromisosAbiertos(r.datos || []))
        .catch(() => setCompromisosAbiertos([]));
    } else {
      setCompromisosAbiertos([]);
      setCompromisoId('');
    }
  }, [tipo, rubroId, obraId]);

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('La foto no puede superar los 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setFotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    if (!proveedor.trim()) { setError('El proveedor es obligatorio'); return; }
    if (!importe || parseFloat(importe) <= 0) { setError('El importe debe ser mayor a 0'); return; }
    if (!rubroId) { setError('Seleccioná un rubro'); return; }

    setLoading(true);
    try {
      await api.post(`/obras/${obraId}/movimientos`, {
        tipo,
        rubro_obra_id: rubroId,
        tarea_id: tareaId || undefined,
        fecha,
        proveedor_nombre: proveedor,
        descripcion: descripcion || undefined,
        moneda,
        importe: parseFloat(importe),
        compromiso_id: compromisoId || undefined,
        medio_pago: medioPago || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toggle Compromiso / Pago */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['COMPROMISO', 'PAGO'] as TipoMovimiento[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              border: `2px solid ${tipo === t ? tokens.color.primario : tokens.color.borde}`,
              background: tipo === t ? `${tokens.color.primario}15` : tokens.color.superficie,
              color: tipo === t ? tokens.color.primario : tokens.color.textoSuave,
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            {t === 'COMPROMISO' ? '📋 Compromiso' : '💸 Pago'}
          </button>
        ))}
      </div>

      {/* Rubro */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
          Rubro *
        </label>
        <SelectorRubro value={rubroId} onChange={setRubroId} rubros={rubros} />
      </div>

      {/* Proveedor */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
          Proveedor / Contratista *
        </label>
        <AutocompletarProveedor value={proveedor} onChange={setProveedor} sugerencias={sugerenciasProveedor} />
      </div>

      {/* Importe */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
          Importe (ARS) *
        </label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={importe}
          onChange={e => setImporte(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          style={{
            width: '100%', padding: '10px 12px',
            border: `1px solid ${tokens.color.borde}`, borderRadius: '8px',
            fontSize: '16px', background: tokens.color.superficie,
            color: tokens.color.texto,
          }}
        />
      </div>

      {/* Fecha */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
          Fecha *
        </label>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px',
            border: `1px solid ${tokens.color.borde}`, borderRadius: '8px',
            fontSize: '14px', background: tokens.color.superficie,
            color: tokens.color.texto,
          }}
        />
      </div>

      {/* Descripción */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
          Descripción
        </label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="Detalle del compromiso o pago…"
          rows={2}
          style={{
            width: '100%', padding: '10px 12px',
            border: `1px solid ${tokens.color.borde}`, borderRadius: '8px',
            fontSize: '14px', background: tokens.color.superficie,
            color: tokens.color.texto, resize: 'vertical',
          }}
        />
      </div>

      {/* Medio de pago (solo PAGO) */}
      {tipo === 'PAGO' && (
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
            Medio de pago
          </label>
          <select
            value={medioPago}
            onChange={e => setMedioPago(e.target.value as any)}
            style={{
              width: '100%', padding: '10px 12px',
              border: `1px solid ${tokens.color.borde}`, borderRadius: '8px',
              fontSize: '14px', background: tokens.color.superficie,
              color: tokens.color.texto,
            }}
          >
            <option value="">Seleccionar…</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
      )}

      {/* ¿Salda un compromiso? (solo PAGO) */}
      {tipo === 'PAGO' && compromisosAbiertos.length > 0 && (
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
            ¿Salda un compromiso?
          </label>
          <select
            value={compromisoId}
            onChange={e => setCompromisoId(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              border: `1px solid ${tokens.color.borde}`, borderRadius: '8px',
              fontSize: '14px', background: tokens.color.superficie,
              color: tokens.color.texto,
            }}
          >
            <option value="">Ninguno — pago independiente</option>
            {compromisosAbiertos.map(c => (
              <option key={c.id} value={c.id}>
                {c.descripcion || 'Sin descripción'} — Saldo: ${c.saldo.toLocaleString('es-AR')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Foto comprobante */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: tokens.color.texto }}>
          Comprobante (foto)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFoto}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%', padding: '12px',
            border: `2px dashed ${tokens.color.borde}`, borderRadius: '10px',
            background: tokens.color.fondo, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontSize: '14px', color: tokens.color.textoSuave,
          }}
        >
          📷 {fotoUrl ? 'Foto agregada' : 'Agregar foto del comprobante'}
        </button>
        {fotoUrl && (
          <div style={{ marginTop: '8px', textAlign: 'center' as const }}>
            <img src={fotoUrl} alt="Comprobante" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px' }} />
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: tokens.color.peligro, fontSize: '13px', margin: 0 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '14px', borderRadius: '10px', border: 'none',
          background: loading ? tokens.color.textoSuave : tokens.color.primario,
          color: '#FFFFFF', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Registrando…' : tipo === 'COMPROMISO' ? 'Registrar compromiso' : 'Registrar pago'}
      </button>
    </form>
  );
}

// ── Componente: Pestaña Por Rubro ─────────────────────────────────────────────

function PestanaPorRubro({
  porRubro, obraId, onRubroClick,
}: {
  porRubro: ResumenRubro[]; obraId: string; onRubroClick: (r: ResumenRubro) => void;
}) {
  if (porRubro.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin rubros"
        descripcion="Esta obra todavía no tiene rubros cargados."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px 80px 80px',
        gap: '8px', padding: '8px 12px',
        fontSize: '12px', fontWeight: 600, color: tokens.color.textoSuave,
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        <span>Rubro</span>
        <span style={{ textAlign: 'right' }}>Previsto</span>
        <span style={{ textAlign: 'right' }}>Comprometido</span>
        <span style={{ textAlign: 'right' }}>Pagado</span>
        <span style={{ textAlign: 'right' }}>Desvío</span>
        <span style={{ textAlign: 'center' }}>Semáforo</span>
      </div>

      {porRubro.map(r => (
        <Tarjeta key={r.rubroId} onClick={() => onRubroClick(r)} style={{ cursor: 'pointer' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px 80px 80px',
            gap: '8px', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.color.primario }}>{r.rubroCodigo}</div>
              <div style={{ fontSize: '12px', color: tokens.color.textoSuave, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.rubroNombre}
              </div>
            </div>
            <span style={{ textAlign: 'right', fontSize: '14px', fontWeight: 500 }}>
              ${r.previsto.toLocaleString('es-AR')}
            </span>
            <span style={{ textAlign: 'right', fontSize: '14px', fontWeight: 500, color: tokens.color.alerta }}>
              ${r.comprometido.toLocaleString('es-AR')}
            </span>
            <span style={{ textAlign: 'right', fontSize: '14px', fontWeight: 500, color: tokens.color.info }}>
              ${r.pagado.toLocaleString('es-AR')}
            </span>
            <span style={{
              textAlign: 'right', fontSize: '13px', fontWeight: 600,
              color: r.desvioPct === null ? tokens.color.textoSuave
                : r.desvioPct > 0 ? tokens.color.peligro
                : r.desvioPct < 0 ? tokens.color.ok
                : tokens.color.textoSuave,
            }}>
              {fmtPct(r.desvioPct)}
            </span>
            <div style={{ textAlign: 'center' }}>
              <Semaforo previsto={r.previsto} actual={r.ejecutado} showLabel={false} />
            </div>
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}

// ── Componente: Pestaña Movimientos ───────────────────────────────────────────

function PestanaMovimientos({
  obraId, inicial,
}: {
  obraId: string; inicial?: { tipo?: string; rubroId?: string };
}) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>(inicial?.tipo || '');
  const [filtroRubroId, setFiltroRubroId] = useState<string>(inicial?.rubroId || '');
  const [mostrarAnular, setMostrarAnular] = useState<Movimiento | null>(null);
  const [motivoAnular, setMotivoAnular] = useState('');
  const [anulando, setAnulando] = useState(false);

  const porPagina = 20;

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pagina: String(page), porPagina: String(porPagina) });
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroRubroId) params.set('rubroId', filtroRubroId);
      const data = await api.get(`/obras/${obraId}/movimientos?${params}`);
      setMovimientos(data.datos || []);
      setTotal(data.total || 0);
      setPagina(page);
    } catch {
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [obraId, filtroTipo, filtroRubroId]);

  useEffect(() => { cargar(1); }, [cargar]);

  async function confirmarAnulacion() {
    if (!mostrarAnular || motivoAnular.length < 4) return;
    setAnulando(true);
    try {
      await api.post(`/obras/${obraId}/movimientos/${mostrarAnular.id}/anular`, { motivo: motivoAnular });
      setMostrarAnular(null);
      setMotivoAnular('');
      cargar(pagina);
    } catch { /* error visible en toast */ }
    finally { setAnulando(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select
          value={filtroTipo}
          onChange={e => { setFiltroTipo(e.target.value); setFiltroRubroId(''); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, fontSize: '13px' }}
        >
          <option value="">Todos los tipos</option>
          <option value="COMPROMISO">Compromisos</option>
          <option value="PAGO">Pagos</option>
        </select>
        <button
          onClick={() => cargar(pagina)}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: tokens.color.primario, color: '#FFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          Filtrar
        </button>
        {(filtroTipo || filtroRubroId) && (
          <button
            onClick={() => { setFiltroTipo(''); setFiltroRubroId(''); }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, background: 'none', fontSize: '13px', cursor: 'pointer' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: tokens.color.textoSuave, padding: '32px' }}>Cargando…</p>
      ) : movimientos.length === 0 ? (
        <EstadoVacio titulo="Sin movimientos" descripcion="Todavía no hay compromisos ni pagos registrados en esta obra." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {movimientos.map(m => (
            <Tarjeta key={m.id} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <BadgeEstado
                      type={m.tipo === 'COMPROMISO' ? 'warning' : 'info'}
                    >
                      {m.tipo === 'COMPROMISO' ? 'COMPROMISO' : 'PAGO'}
                    </BadgeEstado>
                    {m.estado === 'ANULADO' && (
                      <BadgeEstado type="danger">ANULADO</BadgeEstado>
                    )}
                    {m.comprobanteUrl && <span style={{ fontSize: '12px' }}>📎</span>}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>
                    {m.proveedorNombre}
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.color.textoSuave }}>
                    {m.rubroObra.codigo} {m.rubroObra.nombre}
                    {m.tarea && ` · ${m.tarea.codigo}`}
                    {m.descripcion && ` · ${m.descripcion}`}
                  </div>
                  {m.compromiso && m.tipo === 'PAGO' && (
                    <div style={{ fontSize: '12px', color: tokens.color.info, marginTop: '4px' }}>
                      Salda compromiso: {m.compromiso.descripcion || '—'}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: m.tipo === 'COMPROMISO' ? tokens.color.alerta : tokens.color.info }}>
                    ${parseFloat(m.importe).toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.color.textoSuave }}>{fmtDate(m.fecha)}</div>
                  {m.estado === 'VIGENTE' && (
                    <button
                      onClick={() => setMostrarAnular(m)}
                      style={{
                        marginTop: '6px', padding: '4px 10px', borderRadius: '6px',
                        border: `1px solid ${tokens.color.peligro}`, background: 'none',
                        color: tokens.color.peligro, fontSize: '12px', cursor: 'pointer',
                      }}
                    >
                      Anular
                    </button>
                  )}
                </div>
              </div>
            </Tarjeta>
          ))}

          {/* Paginación */}
          {total > porPagina && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '8px' }}>
              <button
                disabled={pagina <= 1}
                onClick={() => cargar(pagina - 1)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, background: 'none', cursor: pagina <= 1 ? 'not-allowed' : 'pointer', opacity: pagina <= 1 ? 0.4 : 1 }}
              >
                Anterior
              </button>
              <span style={{ padding: '8px 12px', fontSize: '13px', color: tokens.color.textoSuave }}>
                {pagina} / {Math.ceil(total / porPagina)}
              </span>
              <button
                disabled={pagina * porPagina >= total}
                onClick={() => cargar(pagina + 1)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${tokens.color.borde}`, background: 'none', cursor: pagina * porPagina >= total ? 'not-allowed' : 'pointer', opacity: pagina * porPagina >= total ? 0.4 : 1 }}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      <ModalConfirmar
        open={!!mostrarAnular}
        titulo="Anular movimiento"
        mensaje={`Vas a anular el ${mostrarAnular?.tipo === 'COMPROMISO' ? 'compromiso' : 'pago'} a ${mostrarAnular?.proveedorNombre} por $${parseFloat(mostrarAnular?.importe || '0').toLocaleString('es-AR')}. Esta acción no se puede deshacer.`}
        impacto="El movimiento quedará anulado y no se computará en los totales."
        textoConfirmar="Anular"
        variante="peligro"
        onConfirmar={confirmarAnulacion}
        onCancelar={() => { setMostrarAnular(null); setMotivoAnular(''); }}
      />
    </div>
  );
}

// ── Componente: Drawer Detalle de Rubro ────────────────────────────────────────

function DrawerRubro({
  rubro, obraId, onClose,
}: {
  rubro: ResumenRubro | null; obraId: string; onClose: () => void;
}) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rubro) return;
    setLoading(true);
    api.get(`/obras/${obraId}/movimientos?rubroId=${rubro.rubroId}&porPagina=50`)
      .then(r => setMovimientos(r.datos || []))
      .catch(() => setMovimientos([]))
      .finally(() => setLoading(false));
  }, [rubro, obraId]);

  return (
    <Drawer open={!!rubro} onClose={onClose} title={rubro ? `${rubro.rubroCodigo} — ${rubro.rubroNombre}` : ''}>
      {rubro && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Mini resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Previsto', valor: `$${rubro.previsto.toLocaleString('es-AR')}`, color: tokens.color.texto },
              { label: 'Comprometido', valor: `$${rubro.comprometido.toLocaleString('es-AR')}`, color: tokens.color.alerta },
              { label: 'Pagado', valor: `$${rubro.pagado.toLocaleString('es-AR')}`, color: tokens.color.info },
              { label: 'Proyección', valor: `$${rubro.proyeccion.toLocaleString('es-AR')}`, color: tokens.color.primario },
            ].map(item => (
              <div key={item.label} style={{
                padding: '12px', background: tokens.color.fondo, borderRadius: '8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '11px', color: tokens.color.textoSuave, textTransform: 'uppercase', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: item.color }}>{item.valor}</div>
              </div>
            ))}
          </div>

          <BarraProgreso
            valor={rubro.pagado}
            max={Math.max(rubro.previsto, 1)}
            color={tokens.color.info}
          />

          {/* Movimientos del rubro */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Movimientos</h4>
            {loading ? (
              <p style={{ color: tokens.color.textoSuave, fontSize: '13px' }}>Cargando…</p>
            ) : movimientos.length === 0 ? (
              <p style={{ color: tokens.color.textoSuave, fontSize: '13px' }}>Sin movimientos en este rubro.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {movimientos.slice(0, 20).map(m => (
                  <div key={m.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', background: tokens.color.fondo, borderRadius: '6px', fontSize: '13px',
                  }}>
                    <div>
                      <BadgeEstado type={m.tipo === 'COMPROMISO' ? 'warning' : 'info'}>
                        {m.tipo === 'COMPROMISO' ? 'COMP' : 'PAGO'}
                      </BadgeEstado>
                      <span style={{ marginLeft: '6px', color: tokens.color.textoSuave }}>{m.proveedorNombre}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: m.tipo === 'COMPROMISO' ? tokens.color.alerta : tokens.color.info }}>
                      ${parseFloat(m.importe).toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function CajaPage() {
  const { obraId } = useParams<{ obraId: string }>() as { obraId: string };
  const [resumen, setResumen] = useState<ResumenGlobal | null>(null);
  const [rubros, setRubros] = useState<RubroObra[]>([]);
  const [sugerenciasProveedor, setSugerenciasProveedor] = useState<string[]>([]);
  const [tab, setTab] = useState<'rubro' | 'movimientos'>('rubro');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRubro, setDrawerRubro] = useState<ResumenRubro | null>(null);
  const [loading, setLoading] = useState(true);
  const [sinPresupuesto, setSinPresupuesto] = useState(false);

  useEffect(() => {
    if (!obraId) return;
    Promise.all([
      api.get(`/obras/${obraId}/caja/resumen`),
      api.get(`/obras/${obraId}/rubros`).catch(() => ({ datos: [] })),
      api.get(`/obras/${obraId}/caja/proveedores`).catch(() => ({ datos: [] })),
    ]).then(([res, rub, prov]) => {
      setResumen(res);
      setRubros(res.datos || rub.datos || []);
      setSugerenciasProveedor(prov.datos || []);
      setSinPresupuesto(res.previsto === 0 && res.comprometido === 0 && res.pagado === 0);
    }).catch(() => {
      setResumen(null);
    }).finally(() => {
      setLoading(false);
    });
  }, [obraId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <span style={{ color: tokens.color.textoSuave }}>Cargando caja…</span>
      </div>
    );
  }

  if (!resumen) {
    return (
      <EstadoVacio titulo="Sin acceso" descripcion="No tenés permiso para ver la caja de esta obra." />
    );
  }

  const { previsto, comprometido, pagado, ejecutado, proyeccion, desvioPct, semaforo, porRubro } = resumen;

  return (
    <div style={{ position: 'relative' }}>
      {/* Banner sin presupuesto */}
      {sinPresupuesto && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
          background: `${tokens.color.info}15`, border: `1px solid ${tokens.color.info}`,
          fontSize: '13px', color: tokens.color.info,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          💡 Cargá un presupuesto para medir desvíos.{' '}
          <span
            style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => window.location.href = `/obras/${obraId}/presupuestos`}
          >
            Ir a Presupuestos
          </span>
        </div>
      )}

      {/* ── Cabecera: 4 cifras + semáforo + barra apilada ── */}
      <Tarjeta style={{ marginBottom: '16px' }}>
        {/* 4 cifras */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px', marginBottom: '16px',
        }}>
          {[
            { label: 'Previsto', valor: previsto, color: tokens.color.texto },
            { label: 'Comprometido', valor: comprometido, color: tokens.color.alerta },
            { label: 'Pagado', valor: pagado, color: tokens.color.info },
            { label: 'Proyección', valor: proyeccion, color: tokens.color.primario },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: tokens.color.textoSuave, letterSpacing: '0.5px', marginBottom: '4px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: item.color, lineHeight: 1.2 }}>
                ${item.valor.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>

        {/* Semáforo global + desvío */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Semaforo previsto={previsto} actual={ejecutado} />
            {desvioPct !== null && (
              <span style={{
                fontSize: '13px', fontWeight: 600,
                color: desvioPct > 0 ? tokens.color.peligro : tokens.color.ok,
              }}>
                Desvío: {fmtPct(desvioPct)}
              </span>
            )}
          </div>
        </div>

        {/* Barra apilada: pagado (azul) / comprometido (amarillo) / restante (gris) sobre previsto */}
        <div style={{ height: '10px', borderRadius: '5px', overflow: 'hidden', background: tokens.color.borde, display: 'flex' }}>
          {previsto > 0 && (
            <>
              <div style={{
                width: `${Math.min((pagado / previsto) * 100, 100)}%`,
                background: tokens.color.info, transition: 'width 0.3s',
              }} />
              <div style={{
                width: `${(comprometido / Math.max(previsto, 1)) * 100}%`,
                background: tokens.color.alerta, transition: 'width 0.3s',
              }} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: tokens.color.textoSuave }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: tokens.color.info, display: 'inline-block' }} /> Pagado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: tokens.color.alerta, display: 'inline-block' }} /> Comprometido
          </span>
        </div>
      </Tarjeta>

      {/* ── Pestañas ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `2px solid ${tokens.color.borde}` }}>
        {([['rubro', 'Por rubro'], ['movimientos', 'Movimientos']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 20px', border: 'none', borderBottom: `3px solid ${tab === key ? tokens.color.primario : 'transparent'}`,
              background: 'none', fontSize: '14px', fontWeight: 600,
              color: tab === key ? tokens.color.primario : tokens.color.textoSuave,
              cursor: 'pointer', marginBottom: '-2px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contenido de pestaña */}
      {tab === 'rubro' ? (
        <PestanaPorRubro
          porRubro={porRubro}
          obraId={obraId}
          onRubroClick={r => setDrawerRubro(r)}
        />
      ) : (
        <PestanaMovimientos obraId={obraId} />
      )}

      {/* ── Botón flotante + Registrar ── */}
      <button
        onClick={() => setDrawerOpen(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: tokens.color.primario, color: '#FFFFFF',
          border: 'none', boxShadow: '0 4px 12px rgba(31,111,120,.35)',
          fontSize: '24px', cursor: 'pointer', zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Registrar movimiento"
      >
        +
      </button>

      {/* ── Drawer: Registrar ── */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Registrar movimiento">
        <FormularioMovimiento
          obraId={obraId}
          rubros={rubros}
          sugerenciasProveedor={sugerenciasProveedor}
          onSuccess={() => {
            setDrawerOpen(false);
            // Recargar resumen
            api.get(`/obras/${obraId}/caja/resumen`).then(setResumen).catch(() => {});
          }}
        />
      </Drawer>

      {/* ── Drawer: Detalle de rubro ── */}
      <DrawerRubro rubro={drawerRubro} obraId={obraId} onClose={() => setDrawerRubro(null)} />
    </div>
  );
}