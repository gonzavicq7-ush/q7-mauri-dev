/**
 * M6 — Servicio de generación de reporte semanal
 * Genera contenido jsonb según estructura del spec §6.
 * Plantillas determinísticas (sin IA) para resumen_ejecutivo.
 * 3 escenarios: obra sana / con desvío / con OC pendiente.
 */
import { PrismaClient } from '@prisma/client';
import { RolObra } from '@q7/shared';

const prisma = new PrismaClient();

// ── Tipos del contenido del reporte ───────────────────────────────────────────

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
  desvios: {
    rubro: string;
    previsto: number;
    ejecutado: number;
    pct: number;
  }[];
  cambios: {
    aprobadas: string[];
    pendientes: string[];
  };
  proxima_semana: {
    tarea: string;
    fecha_inicio: string;
  }[];
  pendientes_accion: {
    tipo: string;
    titulo: string;
    descripcion: string;
    link: string;
  }[];
  _regeneraciones?: { generado_en: string; por: string }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Obtiene el lunes de la semana dada y el domingo */
function semanaDates(semanaInicio: string): { desde: string; hasta: string } {
  const lunes = new Date(semanaInicio + 'T00:00:00Z');
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return {
    desde: lunes.toISOString().split('T')[0],
    hasta: domingo.toISOString().split('T')[0],
  };
}

/** Formatea número como moneda sin decimales para resumenes */
function fmtMiles(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

// ── Generador de resumen ejecutivo (plantillas determinísticas) ─────────────────

type Escenario = 'SANA' | 'CON_DESVIO' | 'CON_OC_PENDIENTE';

function generarResumenEjecutivo(
  escenario: Escenario,
  cifras: ContenidoReporte['cifras'],
  avance: ContenidoReporte['avance'],
  cambios: ContenidoReporte['cambios']
): string {
  const pagoStr = fmtMiles(cifras.pagado);
  const proyStr = fmtMiles(cifras.proyeccion);
  const pctAvance = avance.pct_actual;
  const demoraDias = avance.pct_actual > 0 && avance.pct_actual < 100 ? 'con demoras' : '';

  // Cuenta movimientos de la semana desde los eventos
  const movSemana = 0; // Se calcula en caller

  switch (escenario) {
    case 'SANA':
      return `Esta semana se registraron movimientos de caja. La obra está al ${pctAvance}% con avance normal. ` +
        `Proyección final: ${proyStr}. Pagado hasta ahora: ${pagoStr}.`;

    case 'CON_DESVIO':
      const desviosCount = cambios.aprobadas.length + cambios.pendientes.length;
      return `Alerta: la obra presenta desvíos en el presupuesto. ` +
        `Proyección actual: ${proyStr} (vs previsto). Al ${pctAvance}% de avance ${demoraDias}. ` +
        `${desviosCount > 0 ? `Hay ${desviosCount} órdenes de cambio en curso.` : ''}`;

    case 'CON_OC_PENDIENTE':
      return `Tenés ${cambios.pendientes.length} orden(es) de cambio pendiente(s) de aprobación. ` +
        `La obra está al ${pctAvance}% con proyección de ${proyStr}. ` +
        `Pagado hasta ahora: ${pagoStr}.`;

    default:
      return `Reporte semanal de la obra. Avance: ${pctAvance}%. Proyección: ${proyStr}.`;
  }
}

// ── Función principal de generación ───────────────────────────────────────────

export async function generarReporteSemanal(
  obraId: string,
  semanaInicio: string,
  usuarioId: string,
  rol: RolObra
): Promise<{ contenido: ContenidoReporte; id?: string }> {

  const { desde, hasta } = semanaDates(semanaInicio);
  const fechaDesde = new Date(desde + 'T00:00:00Z');
  const fechaHasta = new Date(hasta + 'T23:59:59Z');

  // ── 1. CIFRAS ────────────────────────────────────────────────────────────────
  let cifras: ContenidoReporte['cifras'] = {
    previsto: 0,
    comprometido: 0,
    pagado: 0,
    proyeccion: 0,
    delta_semana_pagado: 0,
  };

  try {
    const { resumenGlobal } = await import('../caja/calculos.js');
    const resumen = await resumenGlobal(obraId);
    cifras = {
      previsto: resumen.previsto,
      comprometido: resumen.comprometido,
      pagado: resumen.pagado,
      proyeccion: resumen.proyeccion,
      delta_semana_pagado: 0, // Se calcula con la semana anterior si se requiere
    };
  } catch {
    // Degrada
  }

  // ── 2. AVANCE ────────────────────────────────────────────────────────────────
  const tareas = await prisma.tarea.findMany({
    where: { obraId, eliminadoEn: null },
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      estado: true,
      avancePct: true,
      fechaFinNueva: true,
    },
  });

  const pct_actual = tareas.length > 0
    ? Math.round(tareas.reduce((s, t) => s + parseFloat(t.avancePct.toString()), 0) / tareas.length)
    : 0;

  // Semana anterior
  const unaSemanaAtras = new Date(fechaDesde);
  unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
  const registrosAnterior = await prisma.avanceRegistro.findMany({
    where: {
      obraId,
      fecha: { gte: unaSemanaAtras, lt: fechaDesde },
    },
  });
  const pct_semana_anterior = registrosAnterior.length > 0
    ? Math.round(registrosAnterior.reduce((s, r) => s + parseFloat(r.avancePct.toString()), 0) / registrosAnterior.length)
    : 0;

  // Tareas finalizadas esta semana
  const tareasFinalizadas = await prisma.tarea.findMany({
    where: {
      obraId,
      estado: 'FINALIZADA',
      actualizadoEn: { gte: fechaDesde, lte: fechaHasta },
      eliminadoEn: null,
    },
    select: { codigo: true, descripcion: true },
  });

  // Fotos de la semana
  const registrosConFoto = await prisma.avanceRegistro.findMany({
    where: {
      obraId,
      fecha: { gte: fechaDesde, lte: fechaHasta },
      fotoUrl: { not: null },
    },
    select: { fotoUrl: true },
    take: 6,
  });
  const fotos = registrosConFoto.map(r => r.fotoUrl!).filter(Boolean);

  const avance: ContenidoReporte['avance'] = {
    pct_actual,
    pct_semana_anterior,
    tareas_finalizadas: tareasFinalizadas.map(t => `${t.codigo} ${t.descripcion}`),
    fotos,
  };

  // ── 3. DESVÍOS ───────────────────────────────────────────────────────────────
  let desvios: ContenidoReporte['desvios'] = [];
  try {
    const { resumenGlobal } = await import('../caja/calculos.js');
    const resumen = await resumenGlobal(obraId);
    desvios = resumen.porRubro
      .filter((r: any) => r.semaforo === 'ambar' || r.semaforo === 'rojo')
      .map((r: any) => ({
        rubro: `${r.rubroCodigo} ${r.rubroNombre}`,
        previsto: r.previsto,
        ejecutado: r.ejecutado,
        pct: r.desvioPct || 0,
      }));
  } catch {
    // Degrada
  }

  // ── 4. CAMBIOS (OCs) ─────────────────────────────────────────────────────────
  const ordenesCambio = await prisma.ordenCambio.findMany({
    where: { obraId, eliminadoEn: null },
    select: { numero: true, titulo: true, estado: true, impactoCosto: true },
  });

  const cambios: ContenidoReporte['cambios'] = {
    aprobadas: ordenesCambio
      .filter(oc => oc.estado === 'APROBADA')
      .map(oc => `OC #${oc.numero}: ${oc.titulo}`),
    pendientes: ordenesCambio
      .filter(oc => oc.estado === 'PENDIENTE')
      .map(oc => `OC #${oc.numero}: ${oc.titulo}`),
  };

  // ── 5. PRÓXIMA SEMANA (tareas que arrancan) ──────────────────────────────────
  const proximaSemanaFecha = new Date(fechaDesde);
  proximaSemanaFecha.setDate(proximaSemanaFecha.getDate() + 7);
  const proxSemanaStr = proximaSemanaFecha.toISOString().split('T')[0];

  const tareasProximaSemana = await prisma.tarea.findMany({
    where: {
      obraId,
      fechaInicio: { gte: new Date(desde), lte: new Date(proxSemanaStr) },
      eliminadoEn: null,
    },
    select: { codigo: true, descripcion: true, fechaInicio: true },
    take: 5,
  });

  const proxima_semana = tareasProximaSemana.map(t => ({
    tarea: `${t.codigo} ${t.descripcion}`,
    fecha_inicio: t.fechaInicio?.toISOString().split('T')[0] || '',
  }));

  // ── 6. PENDIENTES DE ACCIÓN ──────────────────────────────────────────────────
  const pendientesAccion: ContenidoReporte['pendientes_accion'] = [];

  // OCs pendientes para ADMIN/COMITENTE
  if (rol === RolObra.ADMIN_OBRA || rol === RolObra.COMITENTE) {
    const ocsPendientes = await prisma.ordenCambio.findMany({
      where: { obraId, estado: 'PENDIENTE', eliminadoEn: null },
      select: { id: true, numero: true, titulo: true },
      take: 3,
    });
    for (const oc of ocsPendientes) {
      pendientesAccion.push({
        tipo: 'OC_PENDIENTE',
        titulo: `OC #${oc.numero} esperando aprobación`,
        descripcion: oc.titulo,
        link: `/obras/${obraId}/cambios/${oc.id}`,
      });
    }
  }

  // ── 7. DETERMINAR ESCENARIO Y RESUMEN EJECUTIVO ─────────────────────────────
  let escenario: Escenario = 'SANA';
  if (cambios.pendientes.length > 0) {
    escenario = 'CON_OC_PENDIENTE';
  } else if (desvios.length > 0) {
    escenario = 'CON_DESVIO';
  }

  const resumen_ejecutivo = generarResumenEjecutivo(escenario, cifras, avance, cambios);

  const contenido: ContenidoReporte = {
    semana: { desde, hasta },
    resumen_ejecutivo,
    cifras,
    avance,
    desvios,
    cambios,
    proxima_semana,
    pendientes_accion: pendientesAccion.slice(0, 5),
  };

  return { contenido };
}