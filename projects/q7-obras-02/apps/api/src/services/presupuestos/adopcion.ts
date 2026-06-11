import { PrismaClient, TipoPresupuesto, EstadoPresupuesto, OrigenItem } from '@prisma/client';
import { AppError } from '../../middleware/error.js';

const prisma = new PrismaClient();

export interface ResultadoAdopcion {
  adopcion: { id: string; rubro_obra_id: string; presupuesto_origen_id: string; fecha: string };
  items_copiados: number;
  montoAdoptado: string;
  adoptadoId: string;
}

/**
 * Adoptar un rubro desde una propuesta al ADOPTADO.
 * R5: deep copy con origen=ADOPCION y origen_item_id
 * R6: re-adoptar soft-deletea los items previos del ADOPTADO de ese rubro
 * R7: actualizar estado de la propuesta a ADOPTADO_PARCIAL o ADOPTADO_TOTAL
 */
export async function adoptarRubro(
  obraId: string,
  rubroObraId: string,
  presupuestoOrigenId: string,
  usuarioId: string,
  nota?: string,
): Promise<ResultadoAdopcion> {

  // Validar que el presupuesto origen existe y es PROPUESTA
  const presupuestoOrigen = await prisma.presupuesto.findFirst({
    where: { id: presupuestoOrigenId, obraId, tipo: TipoPresupuesto.PROPUESTA, eliminadoEn: null },
  });
  if (!presupuestoOrigen) {
    throw new AppError(404, 'PROPUESTA_NO_ENCONTRADA', 'No se encontró la propuesta');
  }

  // Validar que el rubro existe y pertenece a la obra
  const rubro = await prisma.rubroObra.findFirst({
    where: { id: rubroObraId, obraId, eliminadoEn: null },
  });
  if (!rubro) {
    throw new AppError(404, 'RUBRO_NO_ENCONTRADO', 'Rubro no encontrado');
  }

  // Obtener o crear el ADOPTADO (R1: solo 1 ADOPTADO por obra)
  let adoptado = await prisma.presupuesto.findFirst({
    where: { obraId, tipo: TipoPresupuesto.ADOPTADO, eliminadoEn: null },
  });

  if (!adoptado) {
    // Crear el ADOPTADO automáticamente
    adoptado = await prisma.presupuesto.create({
      data: {
        obraId,
        tipo: TipoPresupuesto.ADOPTADO,
        nombre: 'Presupuesto Adoptado',
        moneda: presupuestoOrigen.moneda,
        fechaPrecio: new Date(),
        estado: EstadoPresupuesto.BORRADOR,
      },
    });
  }

  // R6: soft-delete de items previos del ADOPTADO de este rubro
  const itemsPrevios = await prisma.presupuestoItem.findMany({
    where: {
      presupuestoId: adoptado.id,
      rubroObraId,
      origen: OrigenItem.ADOPCION,
      eliminadoEn: null,
    },
  });

  if (itemsPrevios.length > 0) {
    await prisma.presupuestoItem.updateMany({
      where: { id: { in: itemsPrevios.map(i => i.id) } },
      data: { eliminadoEn: new Date() },
    });
  }

  // Copiar items de la propuesta al ADOPTADO (deep copy)
  const itemsOrigen = await prisma.presupuestoItem.findMany({
    where: { presupuestoId: presupuestoOrigenId, rubroObraId, eliminadoEn: null },
  });

  let montoTotal = 0;
  const itemsCreados = [];

  for (const item of itemsOrigen) {
    const nuevoItem = await prisma.presupuestoItem.create({
      data: {
        presupuestoId: adoptado.id,
        rubroObraId: item.rubroObraId,
        tareaId: item.tareaId,
        descripcion: item.descripcion,
        tipoRecurso: item.tipoRecurso,
        unidad: item.unidad,
        cantidad: parseFloat(item.cantidad.toString()),
        precioUnitario: parseFloat(item.precioUnitario.toString()),
        subtotal: parseFloat(item.subtotal.toString()),
        incluye: item.incluye,
        excluye: item.excluye,
        noCotizado: item.noCotizado,
        origen: OrigenItem.ADOPCION,
        origenItemId: item.id,
      },
    });
    itemsCreados.push(nuevoItem);
    montoTotal += parseFloat(item.subtotal.toString());
  }

  // Registrar la adopción
  const adopcion = await prisma.adopcion.create({
    data: {
      obraId,
      rubroObraId,
      presupuestoOrigenId,
      decididoPor: usuarioId,
      nota,
    },
  });

  // R7: actualizar estado de la propuesta origen
  const adopcionesDeEstaPropuesta = await prisma.adopcion.count({
    where: { presupuestoOrigenId, eliminadoEn: null },
  });

  const rubrosTotales = await prisma.rubroObra.count({
    where: { obraId, eliminadoEn: null },
    include: { tareas: { where: { eliminadoEn: null, nivel: 3 } } },
  });
  const rubrosConTareas = rubrosTotales;

  // Obtener cuántos rubros únicos tiene la propuesta
  const rubrosDePropuesta = await prisma.presupuestoItem.findMany({
    where: { presupuestoId: presupuestoOrigenId, eliminadoEn: null },
    distinct: ['rubroObraId'],
    select: { rubroObraId: true },
  });

  if (adopcionesDeEstaPropuesta >= rubrosDePropuesta.length) {
    await prisma.presupuesto.update({
      where: { id: presupuestoOrigenId },
      data: { estado: EstadoPresupuesto.ADOPTADO_TOTAL },
    });
  } else {
    await prisma.presupuesto.update({
      where: { id: presupuestoOrigenId },
      data: { estado: EstadoPresupuesto.ADOPTADO_PARCIAL },
    });
  }

  // Actualizar estado del ADOPTADO a VIGENTE
  await prisma.presupuesto.update({
    where: { id: adoptado.id },
    data: { estado: EstadoPresupuesto.VIGENTE },
  });

  return {
    adopcion: {
      id: adopcion.id,
      rubro_obra_id: rubroObraId,
      presupuesto_origen_id: presupuestoOrigenId,
      fecha: adopcion.fecha.toISOString(),
    },
    items_copiados: itemsCreados.length,
    montoAdoptado: montoTotal.toFixed(2),
    adoptadoId: adoptado.id,
  };
}

/**
 * Adoptar múltiples rubros en una operación.
 * Cada adopción: { rubro_obra_id, presupuesto_origen_id }
 */
export async function adoptarRubroMultiple(
  obraId: string,
  adopciones: { rubro_obra_id: string; presupuesto_origen_id: string; nota?: string }[],
  usuarioId: string,
): Promise<ResultadoAdopcion[]> {
  const resultados: ResultadoAdopcion[] = [];

  for (const adopcion of adopciones) {
    const result = await adoptarRubro(
      obraId,
      adopcion.rubro_obra_id,
      adopcion.presupuesto_origen_id,
      usuarioId,
      adopcion.nota,
    );
    resultados.push(result);
  }

  return resultados;
}

/**
 * Obtener el adoptado de una obra con su breakdown por origen.
 */
export async function obtenerAdoptadoConOrigenes(obraId: string) {
  const adoptado = await prisma.presupuesto.findFirst({
    where: { obraId, tipo: TipoPresupuesto.ADOPTADO, eliminadoEn: null },
    include: {
      items: {
        where: { eliminadoEn: null },
        include: {
          rubroObra: { select: { id: true, codigo: true, nombre: true, orden: true } },
          origenItem: {
            include: {
              presupuesto: { select: { id: true, nombre: true, tipo: true } },
            },
          },
        },
        orderBy: [{ rubroObra: { orden: 'asc' } }, { createdAt: 'asc' }],
      },
      adopciones: {
        where: { eliminadoEn: null },
        include: {
          rubroObra: { select: { codigo: true, nombre: true } },
          presupuestoOrigen: { select: { id: true, nombre: true } },
          decididoPorUser: { select: { nombre: true } },
        },
      },
    },
  });

  if (!adoptado) return null;

  // Agrupar items por rubro
  const porRubro = new Map<string, { rubro: any; items: any[]; subtotal: number }>();
  for (const item of adoptado.items) {
    const existente = porRubro.get(item.rubroObraId);
    if (existente) {
      existente.items.push(item);
      existente.subtotal += parseFloat(item.subtotal.toString());
    } else {
      porRubro.set(item.rubroObraId, {
        rubro: item.rubroObra,
        items: [item],
        subtotal: parseFloat(item.subtotal.toString()),
      });
    }
  }

  // Calcular totales
  let total = 0;
  const porRecurso: Record<string, number> = {};
  for (const item of adoptado.items) {
    total += parseFloat(item.subtotal.toString());
    const tr = item.tipoRecurso;
    porRecurso[tr] = (porRecurso[tr] || 0) + parseFloat(item.subtotal.toString());
  }

  return {
    id: adoptado.id,
    total: total.toFixed(2),
    moneda: adoptado.moneda,
    estado: adoptado.estado,
    por_rubro: Array.from(porRubro.values()).map(r => ({
      id: r.rubro.id,
      codigo: r.rubro.codigo,
      nombre: r.rubro.nombre,
      subtotal: r.subtotal.toFixed(2),
      items: r.items.map(i => ({
        id: i.id,
        descripcion: i.descripcion,
        tipo_recurso: i.tipoRecurso,
        unidad: i.unidad,
        cantidad: i.cantidad.toString(),
        precio_unitario: i.precioUnitario.toString(),
        subtotal: i.subtotal.toString(),
        origen: i.origen,
        origen_de: i.origen === 'ADOPCION' && i.origenItem?.presupuesto
          ? { id: i.origenItem.presupuesto.id, nombre: i.origenItem.presupuesto.nombre }
          : i.origen === 'ORDEN_CAMBIO'
          ? { nombre: 'Orden de cambio' }
          : { nombre: 'Manual' },
      })),
    })),
    adopciones: adoptado.adopciones.map(a => ({
      id: a.id,
      rubro: `${a.rubroObra.codigo} ${a.rubroObra.nombre}`,
      presupuesto: a.presupuestoOrigen.nombre,
      presupuesto_id: a.presupuestoOrigen.id,
      fecha: a.fecha.toISOString(),
      decidido_por: a.decididoPorUser.nombre,
      nota: a.nota,
    })),
    totales_por_recurso: porRecurso,
  };
}