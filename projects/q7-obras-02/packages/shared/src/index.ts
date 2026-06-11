// Tipos y enums de dominio compartidos — fuente de verdad para todo el monorepo

// ── Roles ──
export enum RolObra {
  ADMIN_OBRA = 'ADMIN_OBRA',
  COMITENTE = 'COMITENTE',
  PROFESIONAL = 'PROFESIONAL',
  CONSTRUCTOR = 'CONSTRUCTOR',
  PROVEEDOR = 'PROVEEDOR',
}

// ── Estados de obra ──
export enum EstadoObra {
  ACTIVA = 'ACTIVA',
  PAUSADA = 'PAUSADA',
  FINALIZADA = 'FINALIZADA',
}

// ── Tipos de obra ──
export enum TipoObra {
  VIVIENDA = 'VIVIENDA',
  REFORMA = 'REFORMA',
  COMERCIO = 'COMERCIO',
  CONDOMINIO = 'CONDOMINIO',
  OTRO = 'OTRO',
}

// ── Estados de membresía ──
export enum EstadoMiembro {
  PENDIENTE = 'PENDIENTE',
  ACTIVO = 'ACTIVO',
  REVOCADO = 'REVOCADO',
}

// ── Estados de tarea (M1) ──
export enum EstadoTarea {
  PENDIENTE = 'PENDIENTE',
  EN_CURSO = 'EN_CURSO',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}

// ── Unidades ──
export enum Unidad {
  GL = 'GL',       // Global
  M2 = 'M2',       // Metros cuadrados
  M3 = 'M3',       // Metros cúbicos
  ML = 'ML',       // Metros lineales
  UN = 'UN',       // Unidades
  KG = 'KG',       // Kilogramos
  HS = 'HS',       // Horas
  DIA = 'DIA',     // Días
}

// ── Origen rubro obra ──
export enum OrigenRubro {
  CATALOGO = 'CATALOGO',
  PERSONALIZADO = 'PERSONALIZADO',
}

// ── Tipos de presupuesto ──
export enum TipoPresupuesto {
  REFERENCIA = 'REFERENCIA',
  PROPUESTA = 'PROPUESTA',
  ADOPTADO = 'ADOPTADO',
}

// ── Estados de presupuesto ──
export enum EstadoPresupuesto {
  BORRADOR = 'BORRADOR',
  VIGENTE = 'VIGENTE',
  ADOPTADO_PARCIAL = 'ADOPTADO_PARCIAL',
  ADOPTADO_TOTAL = 'ADOPTADO_TOTAL',
  DESCARTADO = 'DESCARTADO',
}

// ── Tipos de recurso ──
export enum TipoRecurso {
  MO = 'MO',                 // Mano de obra
  MATERIAL = 'MATERIAL',
  EQUIPO = 'EQUIPO',
  SUBCONTRATO = 'SUBCONTRATO',
  OTRO = 'OTRO',
}

// ── Origen item de presupuesto ──
export enum OrigenItem {
  MANUAL = 'MANUAL',
  IMPORTACION = 'IMPORTACION',
  ADOPCION = 'ADOPCION',
  ORDEN_CAMBIO = 'ORDEN_CAMBIO',
}

// ── Tipos de movimiento ──
export enum TipoMovimiento {
  COMPROMISO = 'COMPROMISO',
  PAGO = 'PAGO',
}

// ── Estado de movimiento ──
export enum EstadoMovimiento {
  VIGENTE = 'VIGENTE',
  ANULADO = 'ANULADO',
}

// ── Medio de pago ──
export enum MedioPago {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  OTRO = 'OTRO',
}

// ── Tipos de índice ──
export enum TipoIndice {
  INFLACION_MENSUAL = 'INFLACION_MENSUAL',
  TC_USD = 'TC_USD',
}

// ── Motivos de OC ──
export enum MotivoOC {
  PEDIDO_COMITENTE = 'PEDIDO_COMITENTE',
  IMPREVISTO = 'IMPREVISTO',
  ERROR_PROYECTO = 'ERROR_PROYECTO',
  MEJORA = 'MEJORA',
  OTRO = 'OTRO',
}

// ── Estados de OC ──
export enum EstadoOC {
  BORRADOR = 'BORRADOR',
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  ANULADA = 'ANULADA',
}

// ── Monedas ISO 4217 ──
export type Moneda = 'ARS' | 'USD' | 'PYG';

// ── Helpers de moneda ──
export function formatearDinero(monto: string | number, moneda: Moneda = 'ARS'): string {
  const num = typeof monto === 'string' ? parseFloat(monto) : monto;
  const locales: Record<Moneda, string> = { ARS: 'es-AR', USD: 'en-US', PYG: 'es-PY' };
  return new Intl.NumberFormat(locales[moneda] || 'es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// ── Helpers de fechas ──
export function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function fechaISO(fecha: Date | string): string {
  if (fecha instanceof Date) return fecha.toISOString();
  return fecha;
}

export function formatoFecha(fecha: string): string {
  const [y, m, d] = fecha.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ── Eventos (catálogo cerrado) ──
export const CATALOGO_EVENTOS = [
  'obra.creada',
  'miembro.invitado',
  'miembro.activado',
  'computo.tarea_creada',
  'computo.importado',
  'presupuesto.creado',
  'presupuesto.item_agregado',
  'presupuesto.adoptado_rubro',
  'caja.compromiso_registrado',
  'caja.pago_registrado',
  'caja.desvio_detectado',
  'oc.creada',
  'oc.enviada',
  'oc.aprobada',
  'oc.rechazada',
  'plazos.avance_registrado',
  'plazos.dias_perdidos',
  'plazos.tarea_finalizada',
  'reporte.generado',
  'reporte.enviado',
] as const;

export type TipoEvento = typeof CATALOGO_EVENTOS[number];

// ── Código rubro catálogo ──
export const RUBROS_CATALOGO: { codigo: string; nombre: string }[] = [
  { codigo: 'TP00', nombre: 'Trabajos preliminares' },
  { codigo: 'MV00', nombre: 'Movimiento de suelo' },
  { codigo: 'AB00', nombre: 'Albañilería' },
  { codigo: 'HA00', nombre: 'Hormigón armado' },
  { codigo: 'MA00', nombre: 'Mamposterías' },
  { codigo: 'RV00', nombre: 'Revoques y terminaciones' },
  { codigo: 'CP00', nombre: 'Contrapisos y carpetas' },
  { codigo: 'PI00', nombre: 'Pisos' },
  { codigo: 'RE00', nombre: 'Revestimientos' },
  { codigo: 'CR00', nombre: 'Cielorrasos' },
  { codigo: 'CU00', nombre: 'Cubierta' },
  { codigo: 'JU00', nombre: 'Juntas de trabajo' },
  { codigo: 'IM00', nombre: 'Impermeabilizaciones' },
  { codigo: 'CE00', nombre: 'Cerco de cerramiento' },
  { codigo: 'HE00', nombre: 'Herrería' },
  { codigo: 'CA00', nombre: 'Carpinterías' },
  { codigo: 'PN00', nombre: 'Pintura y terminaciones' },
  { codigo: 'AC00', nombre: 'Artefactos y accesorios' },
  { codigo: 'IS00', nombre: 'Instalaciones sanitarias' },
  { codigo: 'IE00', nombre: 'Instalaciones eléctricas' },
  { codigo: 'ID00', nombre: 'Instalación baja tensión-datos' },
  { codigo: 'IG00', nombre: 'Instalación de gas' },
  { codigo: 'II00', nombre: 'Instalación incendio' },
  { codigo: 'JA00', nombre: 'Jardinería y parquización' },
];

// ── Semaforo ──
export function calcularSemaforo(previsto: number, ejecutado: number): 'verde' | 'ambar' | 'rojo' {
  if (previsto <= 0) return 'verde';
  const pct = (ejecutado / previsto) * 100;
  if (pct <= 90) return 'verde';
  if (pct <= 100) return 'ambar';
  return 'rojo';
}

// ── Dias hábiles (MVP: L-V, sin feriados) ──
export function sumarDiasHabiles(fechaInicio: string, dias: number): string {
  const fecha = new Date(fechaInicio + 'T00:00:00Z');
  let sumados = 0;
  while (sumados < dias) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    const dia = fecha.getUTCDay();
    if (dia !== 0 && dia !== 6) sumados++; // 0=domingo, 6=sábado
  }
  return fecha.toISOString().split('T')[0];
}

export { type Moneda as TipoMoneda };
