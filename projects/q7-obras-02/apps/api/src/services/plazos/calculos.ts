// Cálculos de plazos y curvas — M5 Plazos y Avance
// Usa sumarDiasHabiles de @q7/shared (L-V, sin feriados)

import { Prisma } from '@prisma/client';
import { sumarDiasHabiles, hoyISO } from '@q7/shared';

export type TareaPlazo = {
  id: string;
  codigo: string;
  descripcion: string;
  nivel: number;
  unidad: string;
  fechaInicio: Date | null;
  diasHabilesPrev: number | null;
  fechaFinPrevista: Date | null;
  diasPerdidos: number;
  fechaFinNueva: Date | null;
  fechaFinReal: Date | null;
  avancePct: Prisma.Decimal;
  estado: string;
  rubroObraId: string;
  rubroCodigo: string;
  rubroNombre: string;
  tieneHijos: boolean;
};

// ── Cálculos de fecha ──────────────────────────────────────────

/**
 * fecha_fin_prevista = fecha_inicio + dias_habiles_prev (hábiles L-V)
 */
export function calcularFechaFinPrevista(
  fechaInicio: string | Date | null,
  diasHabilesPrev: number | null
): string | null {
  if (!fechaInicio || diasHabilesPrev == null || diasHabilesPrev <= 0) return null;
  const inicio = typeof fechaInicio === 'string' ? fechaInicio : (fechaInicio as Date).toISOString().split('T')[0];
  return sumarDiasHabiles(inicio, diasHabilesPrev);
}

/**
 * fecha_fin_nueva = fecha_fin_prevista + dias_perdidos (hábiles)
 */
export function calcularFechaFinNueva(
  fechaFinPrevista: string | Date | null,
  diasPerdidos: number
): string | null {
  if (!fechaFinPrevista) return null;
  const fin = typeof fechaFinPrevista === 'string' ? fechaFinPrevista : (fechaFinPrevista as Date).toISOString().split('T')[0];
  if (diasPerdidos === 0) return fin;
  return sumarDiasHabiles(fin, diasPerdidos);
}

// ── Demora ─────────────────────────────────────────────────────

/**
 * demora(tarea) = días hábiles entre fin_prevista y (fecha_fin_real | hoy si vencida y no finalizada)
 * Retorna 0 si terminó a tiempo o no está vencida.
 */
export function calcularDemora(tarea: TareaPlazo): number {
  if (!tarea.fechaFinPrevista) return 0;

  const finPrev = tarea.fechaFinPrevista instanceof Date
    ? tarea.fechaFinPrevista.toISOString().split('T')[0]
    : tarea.fechaFinPrevista;

  // Si ya finalizada: comparar con fechaFinReal
  if (tarea.estado === 'FINALIZADA' && tarea.fechaFinReal) {
    const finReal = tarea.fechaFinReal instanceof Date
      ? tarea.fechaFinReal.toISOString().split('T')[0]
      : tarea.fechaFinReal;
    if (finReal <= finPrev) return 0;
    return diasEntre(finPrev, finReal);
  }

  // Si no finalizada: comparar con hoy
  const hoy = hoyISO();
  if (hoy <= finPrev) return 0;
  return diasEntre(finPrev, hoy);
}

/** Días hábiles entre dos fechas (sin incluir inicio, contando fin) */
function diasEntre(inicio: string, fin: string): number {
  let count = 0;
  const cur = new Date(inicio + 'T00:00:00Z');
  const end = new Date(fin + 'T00:00:00Z');
  cur.setUTCDate(cur.getUTCDate() + 1); // start after inicio
  while (cur <= end) {
    const dia = cur.getUTCDay();
    if (dia !== 0 && dia !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// ── Avance rubro ───────────────────────────────────────────────

export type AvanceRubro = {
  rubroObraId: string;
  rubroCodigo: string;
  rubroNombre: string;
  totalDiasPrev: number;
  avancePonderado: number; // 0-100
  tareasHoja: number;
};

/**
 * avance_rubro = promedio ponderado por dias_habiles_prev de tareas hoja
 */
export function calcularAvanceRubro(
  tareasHoja: TareaPlazo[]
): AvanceRubro {
  let totalDias = 0;
  let sumaPonderada = 0;

  for (const t of tareasHoja) {
    const dias = t.diasHabilesPrev ?? 0;
    const avance = parseFloat(t.avancePct.toString());
    totalDias += dias;
    sumaPonderada += dias * avance;
  }

  return {
    rubroObraId: tareasHoja[0]?.rubroObraId ?? '',
    rubroCodigo: tareasHoja[0]?.rubroCodigo ?? '',
    rubroNombre: tareasHoja[0]?.rubroNombre ?? '',
    totalDiasPrev: totalDias,
    avancePonderado: totalDias > 0 ? Math.round((sumaPonderada / totalDias) * 100) / 100 : 0,
    tareasHoja: tareasHoja.length,
  };
}

// ── Curvas ─────────────────────────────────────────────────────

export type PuntoCurva = {
  fecha: string;
  prevista: number; // % acumulado previsto
  real: number;     // % acumulado real
};

export type DatosCurva = {
  puntos: PuntoCurva[];
  inicioObra: string;
  finObra: string;
  diasPerdidosTotales: number;
  totalDiasPrevistos: number;
};

type AvanceEnFecha = { fecha: string; avancePct: number; tareaId: string };

/**
 * curva_prevista(t)  = Σ dias_habiles_prev de tareas cuya fin_prevista ≤ t ÷ total_dias
 * curva_real(t)      = Σ (dias_habiles_prev × avance_en_t) ÷ total_dias
 *                      (avance_en_t = último avance_registro ≤ t)
 * Series semanales desde inicio_obra hasta max(fin_nueva, hoy)
 */
export function calcularCurva(
  tareasHoja: TareaPlazo[],
  avances: AvanceEnFecha[],
  inicioObra: string,
  finMaxObra: string
): DatosCurva {
  const hoy = hoyISO();
  const finHasta = finMaxObra > hoy ? finMaxObra : hoy;

  const totalDias = tareasHoja.reduce((sum, t) => sum + (t.diasHabilesPrev ?? 0), 0);
  if (totalDias === 0) {
    return {
      puntos: [],
      inicioObra,
      finObra: finHasta,
      diasPerdidosTotales: tareasHoja.reduce((sum, t) => sum + t.diasPerdidos, 0),
      totalDiasPrevistos: 0,
    };
  }

  // Acumular avances por tarea al corte semanal
  const avancesPorTarea = new Map<string, AvanceEnFecha[]>();
  for (const a of avances) {
    const arr = avancesPorTarea.get(a.tareaId) || [];
    arr.push(a);
    avancesPorTarea.set(a.tareaId, arr);
  }

  // Semanas desde inicio hasta finHasta
  const semanas = generarSemanas(inicioObra, finHasta);
  const puntos: PuntoCurva[] = [];

  for (const semana of semanas) {
    // Prevista: Σ dias_habiles_prev de tareas con fin_prevista ≤ semana
    let diasPrevAcum = 0;
    let diasRealAcum = 0;

    for (const t of tareasHoja) {
      const dias = t.diasHabilesPrev ?? 0;
      const finPrev = t.fechaFinPrevista
        ? ((t.fechaFinPrevista instanceof Date
            ? t.fechaFinPrevista.toISOString().split('T')[0]
            : t.fechaFinPrevista))
        : null;

      if (finPrev && finPrev <= semana) {
        diasPrevAcum += dias;
      }

      // Avance real en esta semana: último registro ≤ semana
      const regs = avancesPorTarea.get(t.id) || [];
      const regSemana = regs
        .filter(r => r.fecha <= semana)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

      if (regSemana) {
        diasRealAcum += dias * (regSemana.avancePct / 100);
      }
    }

    puntos.push({
      fecha: semana,
      prevista: Math.round((diasPrevAcum / totalDias) * 10000) / 100,
      real: Math.round((diasRealAcum / totalDias) * 10000) / 100,
    });
  }

  return {
    puntos,
    inicioObra,
    finObra: finHasta,
    diasPerdidosTotales: tareasHoja.reduce((sum, t) => sum + t.diasPerdidos, 0),
    totalDiasPrevistos: totalDias,
  };
}

function generarSemanas(inicio: string, fin: string): string[] {
  const semanas: string[] = [];
  const cur = new Date(inicio + 'T00:00:00Z');
  // Ajustar al lunes
  const day = cur.getUTCDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  cur.setUTCDate(cur.getUTCDate() + diff);

  const end = new Date(fin + 'T00:00:00Z');
  while (cur <= end) {
    semanas.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return semanas;
}

// ── Gantt: posición y ancho de barras ─────────────────────────

export type BarraGantt = {
  tareaId: string;
  codigo: string;
  descripcion: string;
  nivel: number;
  rubroCodigo: string;
  // Barra prevista
  prevInicio: string | null;
  prevFin: string | null;
  // Barra de avance (desde prevInicio hasta prevInicio + (% avance))
  avanceInicio: string | null;
  avanceFin: string | null;
  // Extensión días perdidos
  perdidosInicio: string | null;
  perdidosFin: string | null;
  // Fin nuevo
  finNuevo: string | null;
  // Fin real
  finReal: string | null;
  hoy: string;
  estado: string;
  avancePct: number;
  diasPerdidos: number;
  // Para rollup de padres
  rollupAvancePct?: number;
  rollupDiasPerdidos?: number;
  rollupFinNuevo?: string | null;
};

/**
 * Genera los datos de barras para el Gantt.
 * Solo tareas hoja tienen fechas propias; padres muestran rollup.
 */
export function generarBarrasGantt(
  tareas: TareaPlazo[],
  hoy: string,
  inicioObra: string
): BarraGantt[] {
  // Construir mapa de hijos por padre
  const hijosPorPadre = new Map<string, TareaPlazo[]>();
  for (const t of tareas) {
    // buscar padreId
  }

  // Necesitamos el árbol completo para rollup
  // Pasamos dos veces: primero hojas, luego padres
  const hojas = tareas.filter(t => esTareaHoja(t, tareas));
  const padres = tareas.filter(t => !esTareaHoja(t, tareas));

  const barras: BarraGantt[] = [];

  // Hojas
  for (const t of hojas) {
    const prevInicio = t.fechaInicio
      ? ((t.fechaInicio instanceof Date ? t.fechaInicio.toISOString().split('T')[0] : t.fechaInicio))
      : null;
    const prevFin = t.fechaFinPrevista
      ? ((t.fechaFinPrevista instanceof Date ? t.fechaFinPrevista.toISOString().split('T')[0] : t.fechaFinPrevista))
      : null;
    const finNuevo = t.fechaFinNueva
      ? ((t.fechaFinNueva instanceof Date ? t.fechaFinNueva.toISOString().split('T')[0] : t.fechaFinNueva))
      : null;
    const finReal = t.fechaFinReal
      ? ((t.fechaFinReal instanceof Date ? t.fechaFinReal.toISOString().split('T')[0] : t.fechaFinReal))
      : null;

    const dias = t.diasHabilesPrev ?? 0;
    const avance = parseFloat(t.avancePct.toString());

    // Avance fin = prevInicio + (% de días)
    let avanceFin: string | null = null;
    if (prevInicio && dias > 0 && avance > 0) {
      const diasAvance = Math.round((avance / 100) * dias);
      avanceFin = diasAvance > 0 ? sumarDiasHabiles(prevInicio, diasAvance) : prevInicio;
    }

    // Días perdidos: extensión desde prevFin hasta finNuevo
    let perdidosInicio: string | null = null;
    let perdidosFin: string | null = null;
    if (t.diasPerdidos > 0 && prevFin && finNuevo && finNuevo > prevFin) {
      perdidosInicio = prevFin;
      perdidosFin = finNuevo;
    } else if (t.diasPerdidos < 0 && prevFin && finNuevo) {
      // Recupero: la barra de avance se acorta
      perdidosInicio = finNuevo;
      perdidosFin = prevFin;
    }

    barras.push({
      tareaId: t.id,
      codigo: t.codigo,
      descripcion: t.descripcion,
      nivel: t.nivel,
      rubroCodigo: t.rubroCodigo,
      prevInicio,
      prevFin,
      avanceInicio: prevInicio,
      avanceFin: avanceFin || prevInicio,
      perdidosInicio,
      perdidosFin,
      finNuevo,
      finReal,
      hoy,
      estado: t.estado,
      avancePct: avance,
      diasPerdidos: t.diasPerdidos,
    });
  }

  return barras;
}

function esTareaHoja(tarea: TareaPlazo, todas: TareaPlazo[]): boolean {
  return !todas.some(ot => ot.padreId === tarea.id);
}

// ── Resumen global de obra ─────────────────────────────────────

export type ResumenPlazos = {
  inicioObra: string | null;
  finPrevistoObra: string | null;
  finProyectadoObra: string | null;
  avanceGlobalPct: number;
  demoraDias: number;
  diasPerdidosTotales: number;
  tareasTotal: number;
  tareasFinalizadas: number;
  tareasEnCurso: number;
  tareasPendientes: number;
};

export function calcularResumenObra(
  tareas: TareaPlazo[]
): ResumenPlazos {
  const hojas = tareas.filter(t => !t.tieneHijos);
  if (hojas.length === 0) {
    return {
      inicioObra: null,
      finPrevistoObra: null,
      finProyectadoObra: null,
      avanceGlobalPct: 0,
      demoraDias: 0,
      diasPerdidosTotales: 0,
      tareasTotal: 0,
      tareasFinalizadas: 0,
      tareasEnCurso: 0,
      tareasPendientes: 0,
    };
  }

  // Inicio obra = mínimo fechaInicio de tareas hoja
  const inicios = hojas.map(t => t.fechaInicio).filter(Boolean) as Date[];
  const inicioObra = inicios.length
    ? new Date(Math.min(...inicios.map(d => d.getTime()))).toISOString().split('T')[0]
    : null;

  // Fin previsto obra = máximo fechaFinPrevista
  const finesPrev = hojas.map(t => t.fechaFinPrevista).filter(Boolean) as Date[];
  const finPrevistoObra = finesPrev.length
    ? new Date(Math.max(...finesPrev.map(d => d.getTime()))).toISOString().split('T')[0]
    : null;

  // Fin nuevo obra = máximo fechaFinNueva
  const finesNuevo = hojas.map(t => t.fechaFinNueva).filter(Boolean) as Date[];
  const finProyectadoObra = finesNuevo.length
    ? new Date(Math.max(...finesNuevo.map(d => d.getTime()))).toISOString().split('T')[0]
    : null;

  // Avance global ponderado
  const avanceRubro = calcularAvanceRubro(hojas);

  // Demora total = suma de demoras de tareas vencidas
  let demoraTotal = 0;
  for (const t of hojas) {
    demoraTotal += calcularDemora(t);
  }

  const diasPerdidosTotales = hojas.reduce((sum, t) => sum + t.diasPerdidos, 0);

  return {
    inicioObra,
    finPrevistoObra,
    finProyectadoObra,
    avanceGlobalPct: avanceRubro.avancePonderado,
    demoraDias: demoraTotal,
    diasPerdidosTotales,
    tareasTotal: hojas.length,
    tareasFinalizadas: hojas.filter(t => t.estado === 'FINALIZADA').length,
    tareasEnCurso: hojas.filter(t => t.estado === 'EN_CURSO').length,
    tareasPendientes: hojas.filter(t => t.estado === 'PENDIENTE').length,
  };
}