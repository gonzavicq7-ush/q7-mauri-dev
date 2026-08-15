/**
 * Cálculos server-side para Caja de obra (M3)
 * Único lugar donde viven las fórmulas de previsto/comprometido/pagado/ejecutado/proyección/desvío.
 * Lee de M2 (presupuesto ADOPTADO, fallback REFERENCIA) SOLO LECTURA.
 */
import { PrismaClient, RubroObra, Movimiento } from '@prisma/client';
import { calcularSemaforo } from '@q7/shared';

const prisma = new PrismaClient();

export type ResumenRubro = {
  rubroId: string;
  rubroCodigo: string;
  rubroNombre: string;
  previsto: number;
  comprometido: number;
  pagado: number;
  ejecutado: number;
  proyeccion: number;
  desvioPct: number | null; // null si previsto es 0
  semaforo: 'verde' | 'ambar' | 'rojo';
};

export type ResumenGlobal = {
  previsto: number;
  comprometido: number;
  pagado: number;
  ejecutado: number;
  proyeccion: number;
  desvioPct: number | null;
  semaforo: 'verde' | 'ambar' | 'rojo';
  porRubro: ResumenRubro[];
};

/** Previsto de un rubro: suma de subtotales del presupuesto ADOPTADO (fallback REFERENCIA) */
export async function previsto(rubroId: string): Promise<number> {
  // ADOPTADO
  const adoptado = await prisma.presupuesto.findFirst({
    where: {
      obraId: (await prisma.rubroObra.findUnique({ where: { id: rubroId } }))!.obraId,
      tipo: 'ADOPTADO',
      estado: { in: ['ADOPTADO_TOTAL', 'ADOPTADO_PARCIAL'] },
      eliminadoEn: null,
    },
  });

  if (adoptado) {
    const items = await prisma.presupuestoItem.findMany({
      where: { presupuestoId: adoptado.id, rubroObraId: rubroId, eliminadoEn: null },
      select: { subtotal: true },
    });
    return items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  }

  // Fallback: REFERENCIA vigente
  const referencia = await prisma.presupuesto.findFirst({
    where: {
      obraId: (await prisma.rubroObra.findUnique({ where: { id: rubroId } }))!.obraId,
      tipo: 'REFERENCIA',
      estado: 'VIGENTE',
      eliminadoEn: null,
    },
  });

  if (referencia) {
    const items = await prisma.presupuestoItem.findMany({
      where: { presupuestoId: referencia.id, rubroObraId: rubroId, eliminadoEn: null },
      select: { subtotal: true },
    });
    return items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  }

  return 0;
}

/** Comprometido de un rubro: Σ COMPROMISO vigentes − Σ pagos aplicados a esos compromisos */
export async function comprometido(rubroId: string, contratistaMiembroId?: string): Promise<number> {
  const where: any = { rubroObraId: rubroId, tipo: 'COMPROMISO', estado: 'VIGENTE', eliminadoEn: null };
  if (contratistaMiembroId) where.contratistaMiembroId = contratistaMiembroId;

  // Compromisos vigentes del rubro
  const compromisos = await prisma.movimiento.findMany({
    where,
    include: {
      pagos: {
        where: {
          estado: 'VIGENTE', eliminadoEn: null,
          ...(contratistaMiembroId ? { contratistaMiembroId } : {}),
        },
        select: { importe: true },
      },
    },
  });

  let totalComprometido = 0;
  for (const comp of compromisos) {
    const saldoPagado = comp.pagos.reduce((sum, p) => sum + Number(p.importe), 0);
    const saldoRestante = Math.max(0, Number(comp.importe) - saldoPagado);
    totalComprometido += saldoRestante;
  }

  return totalComprometido;
}

/** Pagado de un rubro: Σ PAGO vigentes */
export async function pagado(rubroId: string, contratistaMiembroId?: string): Promise<number> {
  const where: any = { rubroObraId: rubroId, tipo: 'PAGO', estado: 'VIGENTE', eliminadoEn: null };
  if (contratistaMiembroId) where.contratistaMiembroId = contratistaMiembroId;

  const result = await prisma.movimiento.aggregate({
    where,
    _sum: { importe: true },
  });
  return Number(result._sum.importe ?? 0);
}

/** Ejecutado = comprometido + pagado (de un rubro o global) */
export function ejecutadoCalc(previsto: number, comprometido: number, pagado: number): number {
  return comprometido + pagado;
}

/** Proyección = max(previsto, ejecutado) */
export function proyeccionCalc(previsto: number, ejecutado: number): number {
  return Math.max(previsto, ejecutado);
}

/** Desvío % = (ejecutado − previsto) / previsto; null si previsto es 0 */
export function desvioPctCalc(previsto: number, ejecutado: number): number | null {
  if (previsto <= 0) return null;
  return ((ejecutado - previsto) / previsto) * 100;
}

/**
 * Resume un rubro (previsto/comprometido/pagado/ejecutado/proyección/desvío/semáforo).
 */
export async function resumirRubro(
  rubro: { id: string; codigo: string; nombre: string },
  contratistaMiembroId?: string
): Promise<ResumenRubro> {
  const [prev, comp, pag] = await Promise.all([
    previsto(rubro.id),
    comprometido(rubro.id, contratistaMiembroId),
    pagado(rubro.id, contratistaMiembroId),
  ]);
  const eje = ejecutadoCalc(prev, comp, pag);
  const proy = proyeccionCalc(prev, eje);
  const desvio = desvioPctCalc(prev, eje);
  const semaforo = calcularSemaforo(prev, eje);

  return {
    rubroId: rubro.id,
    rubroCodigo: rubro.codigo,
    rubroNombre: rubro.nombre,
    previsto: prev,
    comprometido: comp,
    pagado: pag,
    ejecutado: eje,
    proyeccion: proy,
    desvioPct: desvio,
    semaforo,
  };
}

/**
 * Resumen global + por rubro de una obra.
 * Si es CONSTRUCTOR, solo suma sus propios movimientos.
 */
export async function resumenGlobal(
  obraId: string,
  contratistaMiembroId?: string
): Promise<ResumenGlobal> {
  const rubos = await prisma.rubroObra.findMany({
    where: { obraId, eliminadoEn: null },
    orderBy: { orden: 'asc' },
  });

  const porRubro: ResumenRubro[] = [];

  for (const rubro of rubos) {
    const resumen = await resumirRubro(rubro, contratistaMiembroId);
    porRubro.push(resumen);
  }

  const totals = porRubro.reduce(
    (acc, r) => ({
      previsto: acc.previsto + r.previsto,
      comprometido: acc.comprometido + r.comprometido,
      pagado: acc.pagado + r.pagado,
      ejecutado: acc.ejecutado + r.ejecutado,
      proyeccion: acc.proyeccion + r.proyeccion,
    }),
    { previsto: 0, comprometido: 0, pagado: 0, ejecutado: 0, proyeccion: 0 }
  );

  const desvioGlobal = desvioPctCalc(totals.previsto, totals.ejecutado);
  const semaforoGlobal = calcularSemaforo(totals.previsto, totals.ejecutado);

  return {
    ...totals,
    desvioPct: desvioGlobal,
    semaforo: semaforoGlobal,
    porRubro,
  };
}

/**
 * Saldo pendiente de un compromiso (lo que falta pagar).
 */
export async function saldoCompromiso(compromisoId: string): Promise<number> {
  const compromiso = await prisma.movimiento.findUnique({
    where: { id: compromisoId },
    include: {
      pagos: {
        where: { estado: 'VIGENTE', eliminadoEn: null },
        select: { importe: true },
      },
    },
  });
  if (!compromiso) return 0;
  const yaPagado = compromiso.pagos.reduce((s, p) => s + Number(p.importe), 0);
  return Math.max(0, Number(compromiso.importe) - yaPagado);
}

/**
 * Compromisos abiertos de un rubro (con saldo > 0).
 */
export async function compromisosAbiertos(
  rubroId: string,
  contratistaMiembroId?: string
): Promise<Array<{ id: string; descripcion: string | null; importe: string; saldo: number }>> {
  const where: any = {
    rubroObraId: rubroId,
    tipo: 'COMPROMISO',
    estado: 'VIGENTE',
    eliminadoEn: null,
  };
  if (contratistaMiembroId) where.contratistaMiembroId = contratistaMiembroId;

  const compromisos = await prisma.movimiento.findMany({
    where,
    select: { id: true, importe: true, descripcion: true },
  });

  const result = [];
  for (const c of compromisos) {
    const saldo = await saldoCompromiso(c.id);
    if (saldo > 0) {
      result.push({ id: c.id, descripcion: c.descripcion, importe: String(c.importe), saldo });
    }
  }
  return result;
}

/**
 * Proveedores históricos de una obra (para autocompletar).
 */
export async function proveedoresHistoricos(obraId: string): Promise<string[]> {
  const movimientos = await prisma.movimiento.findMany({
    where: { obraId, eliminadoEn: null },
    select: { proveedorNombre: true },
    distinct: ['proveedorNombre'],
    orderBy: { creadoEn: 'desc' },
    take: 100,
  });
  return movimientos.map(m => m.proveedorNombre);
}