/**
 * M4 — Órdenes de Cambio
 * 9 endpoints según spec §4.
 * Reglas de negocio: R1–R8.
 * R4 (aprobar): transacción atómica con impacto en presupuesto ADOPTADO y plazos.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';
import { requiereRol } from '../middleware/auth.js';
import { RolObra, MotivoOC, EstadoOC, TipoRecurso, Unidad, TipoPresupuesto, EstadoPresupuesto, OrigenItem } from '@q7/shared';
import { EventoService } from './eventos.js';

const prisma = new PrismaClient();

// ── Schemas de validación ─────────────────────────────────────────────────────

const itemSchema = z.object({
  descripcion: z.string().min(1).max(500),
  tipo_recurso: z.enum(['MO', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO', 'OTRO']),
  unidad: z.enum(['GL', 'M2', 'M3', 'ML', 'UN', 'KG', 'HS', 'DIA']),
  cantidad: z.number(),
  precio_unitario: z.number(),
});

const crearOCSchema = z.object({
  titulo: z.string().min(1).max(255),
  descripcion: z.string().max(2000).optional(),
  motivo: z.enum(['PEDIDO_COMITENTE', 'IMPREVISTO', 'ERROR_PROYECTO', 'MEJORA', 'OTRO']),
  impacto_dias: z.number().int().default(0),
  rubros_afectados: z.array(z.string().uuid()).min(1),
  items: z.array(itemSchema).min(1),
});

const patchOCSchema = z.object({
  titulo: z.string().min(1).max(255).optional(),
  descripcion: z.string().max(2000).optional(),
  motivo: z.enum(['PEDIDO_COMITENTE', 'IMPREVISTO', 'ERROR_PROYECTO', 'MEJORA', 'OTRO']).optional(),
  impacto_dias: z.number().int().optional(),
  rubros_afectados: z.array(z.string().uuid()).optional(),
  items: z.array(itemSchema).optional(),
});

const aprobarOCSchema = z.object({
  nota: z.string().max(1000).optional(),
});

const rechazarOCSchema = z.object({
  nota: z.string().min(4).max(1000),
});

// ── Helper: obtener siguiente número de OC por obra ───────────────────────────
async function siguienteNumeroOC(obraId: string): Promise<number> {
  const last = await prisma.ordenCambio.findFirst({
    where: { obraId, eliminadoEn: null },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });
  return (last?.numero ?? 0) + 1;
}

// ── Helper: verificar que la OC existe y pertenece a la obra ───────────────
async function ocFind(obraId: string, id: string) {
  return prisma.ordenCambio.findFirst({
    where: { id, obraId, eliminadoEn: null },
    include: {
      items: true,
      solicitante: { select: { id: true, nombre: true, email: true } },
      resolutor: { select: { id: true, nombre: true } },
      obra: { select: { id: true, nombre: true, monedaBase: true } },
    },
  });
}

// ── Helper: verificar que todos los rubros pertenecen a la obra ──────────────
async function validarRubrosAfectados(rubrosIds: string[], obraId: string) {
  const rubros = await prisma.rubroObra.findMany({
    where: { id: { in: rubrosIds }, obraId, eliminadoEn: null },
  });
  if (rubros.length !== rubrosIds.length) {
    throw new AppError(400, 'RUBROS_INVALIDOS', 'Uno o más rubros no pertenecen a esta obra');
  }
}

// ── Helper: verificar rol de aprobador ────────────────────────────────────────
async function puedeAprobar(obraId: string, usuarioId: string, solicitanteId: string): Promise<boolean> {
  // R3: El solicitante NO puede autoaprobarse
  if (usuarioId === solicitanteId) return false;

  const miembro = await prisma.obraMiembro.findFirst({
    where: { obraId, usuarioId, rol: { in: [RolObra.ADMIN_OBRA, RolObra.COMITENTE] }, estado: 'ACTIVO', eliminadoEn: null },
  });
  return !!miembro;
}

// ── Helper: calcular subtotal de un ítem ─────────────────────────────────────
function calcularSubtotal(cantidad: number, precioUnitario: number): string {
  return (cantidad * precioUnitario).toFixed(2);
}

// ── R4: Lógica de aprobación atómica ──────────────────────────────────────────
async function aprobarOCAtomic(
  ordenCambio: {
    id: string; numero: number; obraId: string; impactoCosto: any;
    moneda: string; impactoDias: number; rubrosAfectados: string[];
  },
  resolutorId: string,
  nota?: string
) {
  const obraId = ordenCambio.obraId;

  // Ejecutar TODO en una transacción: (a) copiar ítems al ADOPTADO,
  // (b) sumar dias_perdidos a la última tarea del primer rubro,
  // (c) marcar la OC como aprobada.
  // Si falla cualquiera, NADA se persiste.
  const resultado = await prisma.$transaction(async (tx) => {
    // (a) Buscar o crear presupuesto ADOPTADO
    let adoptado = await tx.presupuesto.findFirst({
      where: { obraId, tipo: 'ADOPTADO', eliminadoEn: null },
    });

    if (!adoptado) {
      const obra = await tx.obra.findUnique({ where: { id: obraId } });
      adoptado = await tx.presupuesto.create({
        data: {
          obraId,
          tipo: 'ADOPTADO',
          nombre: `Presupuesto Adoptado - ${new Date().toLocaleDateString('es-AR')}`,
          moneda: obra!.monedaBase,
          fechaPrecio: new Date(),
          estado: 'ADOPTADO_TOTAL',
        },
      });
    }

    // Obtener ítems de la OC (dentro de la transacción)
    const itemsOC = await tx.ordenCambioItem.findMany({
      where: { ordenCambioId: ordenCambio.id },
    });

    // Copiar ítems al ADOPTADO con origen=ORDEN_CAMBIO
    // Se asignan al primer rubro afectado (MVP simple)
    if (itemsOC.length > 0) {
      const itemsParaAdoptado = itemsOC.map(item => ({
        presupuestoId: adoptado!.id,
        rubroObraId: ordenCambio.rubrosAfectados[0],
        descripcion: item.descripcion,
        tipoRecurso: item.tipoRecurso as any,
        unidad: item.unidad as any,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        origen: 'ORDEN_CAMBIO' as any,
        origenItemId: null,
      }));
      await tx.presupuestoItem.createMany({ data: itemsParaAdoptado });
    }

    // (b) Si impacto_dias > 0, sumar días a la última tarea del primer rubro
    let tareaActualizada = null;
    if (ordenCambio.impactoDias > 0 && ordenCambio.rubrosAfectados.length > 0) {
      const primerRubro = ordenCambio.rubrosAfectados[0];
      const ultimaTarea = await tx.tarea.findFirst({
        where: { rubroObraId: primerRubro, eliminadoEn: null },
        orderBy: { orden: 'desc' },
      });

      if (ultimaTarea) {
        tareaActualizada = await tx.tarea.update({
          where: { id: ultimaTarea.id },
          data: { diasPerdidos: { increment: ordenCambio.impactoDias } },
        });
      }
    }

    // (c) Marcar la OC como aprobada
    const ocAprobada = await tx.ordenCambio.update({
      where: { id: ordenCambio.id },
      data: {
        estado: 'APROBADA',
        resolutorId,
        fechaResolucion: new Date(),
        notaResolucion: nota || null,
      },
    });

    return { ocAprobada, adoptadoId: adoptado!.id, tareaActualizada };
  });

  return resultado;
}

// ── Routes ─────────────────────────────────────────────────────────────────────
export async function ordenesCambioRoutes(app: FastifyInstance) {

  // GET /api/v1/obras/:obraId/ordenes-cambio
  app.get('/obras/:obraId/ordenes-cambio', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { estado, pagina = '1', porPagina = '25' } = request.query as any;

    const where: any = { obraId, eliminadoEn: null };
    if (estado) where.estado = estado;

    const page = parseInt(pagina as string);
    const limit = parseInt(porPagina as string);
    const skip = (page - 1) * limit;

    const [ordenes, total] = await Promise.all([
      prisma.ordenCambio.findMany({
        where,
        include: {
          solicitante: { select: { id: true, nombre: true } },
          items: true,
        },
        orderBy: { numero: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ordenCambio.count({ where }),
    ]);

    return { datos: ordenes, total, pagina: page };
  });

  // POST /api/v1/obras/:obraId/ordenes-cambio
  app.post('/obras/:obraId/ordenes-cambio', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = crearOCSchema.parse(request.body);

    // Validar rubros afectados
    await validarRubrosAfectados(data.rubros_afectados, obraId);

    // Obtener moneda de la obra
    const obra = await prisma.obra.findUnique({ where: { id: obraId } });
    const moneda = obra!.monedaBase;

    // Calcular impacto_costo = suma de subtotales de ítems
    const itemsConSubtotal = data.items.map(item => ({
      ...item,
      subtotal: calcularSubtotal(item.cantidad, item.precio_unitario),
    }));
    const impactoCosto = itemsConSubtotal.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    // R1: siguiente número secuencial por obra
    const numero = await siguienteNumeroOC(obraId);

    // Obtener obra para moneda
    const ordenCambio = await prisma.ordenCambio.create({
      data: {
        obraId,
        numero,
        titulo: data.titulo,
        descripcion: data.descripcion || null,
        motivo: data.motivo as any,
        impactoCosto,
        moneda,
        impactoDias: data.impacto_dias,
        rubrosAfectados: data.rubros_afectados,
        estado: 'BORRADOR',
        solicitanteId: request.userId,
      },
    });

    // Crear ítems de la OC
    await prisma.ordenCambioItem.createMany({
      data: itemsConSubtotal.map(item => ({
        ordenCambioId: ordenCambio.id,
        descripcion: item.descripcion,
        tipoRecurso: item.tipo_recurso as any,
        unidad: item.unidad as any,
        cantidad: item.cantidad,
        precioUnitario: item.precio_unitario,
        subtotal: item.subtotal,
      })),
    });

    // Emitir evento oc.creada
    const resumenHumano = `Nueva orden de cambio #${numero}: ${data.titulo}`;
    await EventoService.emitir(obraId, request.userId, 'oc.creada', {
      entidad_id: ordenCambio.id,
      resumen_humano: resumenHumano,
      datos: { numero, titulo: data.titulo, motivo: data.motivo, impacto_costo: impactoCosto, impacto_dias: data.impacto_dias },
    });

    // Devolver OC completa con ítems
    const ocCompleta = await prisma.ordenCambio.findUnique({
      where: { id: ordenCambio.id },
      include: { items: true, solicitante: { select: { id: true, nombre: true } } },
    });

    return reply.status(201).send(ocCompleta);
  });

  // GET /api/v1/obras/:obraId/ordenes-cambio/:id
  app.get('/obras/:obraId/ordenes-cambio/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const orden = await ocFind(obraId, id);
    if (!orden) throw new AppError(404, 'OC_NO_ENCONTRADA', 'Orden de cambio no encontrada');

    // Obtener nombres de rubros afectados
    const rubros = await prisma.rubroObra.findMany({
      where: { id: { in: orden.rubrosAfectados } },
      select: { id: true, codigo: true, nombre: true },
    });

    return { ...orden, _rubros: rubros };
  });

  // PATCH /api/v1/obras/:obraId/ordenes-cambio/:id
  // R2: solo editable en estado BORRADOR
  app.patch('/obras/:obraId/ordenes-cambio/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const data = patchOCSchema.parse(request.body);

    const orden = await ocFind(obraId, id);
    if (!orden) throw new AppError(404, 'OC_NO_ENCONTRADA', 'Orden de cambio no encontrada');
    if (orden.estado !== 'BORRADOR') {
      throw new AppError(422, 'OC_NO_EDITABLE', 'Solo se pueden editar órdenes de cambio en estado BORRADOR');
    }

    // Validar rubros si se envían
    if (data.rubros_afectados) {
      await validarRubrosAfectados(data.rubros_afectados, obraId);
    }

    // Recalcular impacto_costo si cambian items
    let impactoCosto = orden.impactoCosto.toString();
    if (data.items) {
      const itemsConSubtotal = data.items.map(item => ({
        ...item,
        subtotal: calcularSubtotal(item.cantidad, item.precio_unitario),
      }));
      impactoCosto = itemsConSubtotal.reduce((sum, item) => sum + parseFloat(item.subtotal), 0).toString();

      // Eliminar ítems existentes y crear los nuevos
      await prisma.ordenCambioItem.deleteMany({ where: { ordenCambioId: id } });
      await prisma.ordenCambioItem.createMany({
        data: itemsConSubtotal.map(item => ({
          ordenCambioId: id,
          descripcion: item.descripcion,
          tipoRecurso: item.tipo_recurso as any,
          unidad: item.unidad as any,
          cantidad: item.cantidad,
          precioUnitario: item.precio_unitario,
          subtotal: item.subtotal,
        })),
      });
    }

    const updateData: any = {
      titulo: data.titulo ?? orden.titulo,
      descripcion: data.descripcion ?? orden.descripcion,
      motivo: data.motivo ? (data.motivo as any) : orden.motivo,
      impactoDias: data.impacto_dias ?? orden.impactoDias,
      rubrosAfectados: data.rubros_afectados ?? orden.rubrosAfectados,
      impactoCosto: data.items ? parseFloat(impactoCosto) : undefined,
    };

    const actualizada = await prisma.ordenCambio.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return actualizada;
  });

  // POST /api/v1/obras/:obraId/ordenes-cambio/:id/enviar
  // R2: solo desde BORRADOR → PENDIENTE
  app.post('/obras/:obraId/ordenes-cambio/:id/enviar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const orden = await ocFind(obraId, id);
    if (!orden) throw new AppError(404, 'OC_NO_ENCONTRADA', 'Orden de cambio no encontrada');
    if (orden.estado !== 'BORRADOR') {
      throw new AppError(422, 'OC_NO_SE_PUEDE_ENVIAR', 'Solo se pueden enviar órdenes de cambio en estado BORRADOR');
    }

    const actualizada = await prisma.ordenCambio.update({
      where: { id },
      data: { estado: 'PENDIENTE' },
    });

    // Emitir evento oc.enviada
    const resumenHumano = `OC #${orden.numero} enviada para aprobación: ${orden.titulo}`;
    await EventoService.emitir(obraId, request.userId, 'oc.enviada', {
      entidad_id: id,
      resumen_humano: resumenHumano,
      datos: { numero: orden.numero, titulo: orden.titulo, solicitante: orden.solicitante.nombre },
    });

    return actualizada;
  });

  // POST /api/v1/obras/:obraId/ordenes-cambio/:id/aprobar
  // R3: El solicitante NO puede autoaprobarse (OC_AUTOAPROBACION)
  // R4: transacción atómica (ítems al ADOPTADO + días perdidos + evento)
  app.post('/obras/:obraId/ordenes-cambio/:id/aprobar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;
    const data = aprobarOCSchema.parse(request.body || {});

    const orden = await ocFind(obraId, id);
    if (!orden) throw new AppError(404, 'OC_NO_ENCONTRADA', 'Orden de cambio no encontrada');
    if (orden.estado !== 'PENDIENTE') {
      throw new AppError(422, 'OC_NO_PENDIENTE', 'Solo se pueden aprobar órdenes de cambio en estado PENDIENTE');
    }

    // R3: verificar que no sea autoaprobación
    const puede = await puedeAprobar(obraId, request.userId, orden.solicitanteId);
    if (!puede) {
      throw new AppError(403, 'OC_AUTOAPROBACION', 'No podés aprobar tu propia orden de cambio');
    }

    // R4: ejecutar aprobación atómica
    const resultado = await aprobarOCAtomic(orden, request.userId, data.nota);

    // Emitir evento oc.aprobada
    const resumenHumano = `OC #${orden.numero} aprobada: +$${Math.abs(parseFloat(orden.impactoCosto.toString())).toLocaleString('es-AR')} y ${orden.impactoDias > 0 ? '+' : ''}${orden.impactoDias} días`;
    await EventoService.emitir(obraId, request.userId, 'oc.aprobada', {
      entidad_id: id,
      resumen_humano: resumenHumano,
      datos: {
        numero: orden.numero,
        titulo: orden.titulo,
        impacto_costo: orden.impactoCosto.toString(),
        impacto_dias: orden.impactoDias,
        resolutor: request.userId,
      },
    });

    return reply.status(200).send(resultado.ocAprobada);
  });

  // POST /api/v1/obras/:obraId/ordenes-cambio/:id/rechazar
  // R5: nota obligatoria, emite oc.rechazada
  app.post('/obras/:obraId/ordenes-cambio/:id/rechazar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;
    const data = rechazarOCSchema.parse(request.body);

    const orden = await ocFind(obraId, id);
    if (!orden) throw new AppError(404, 'OC_NO_ENCONTRADA', 'Orden de cambio no encontrada');
    if (orden.estado !== 'PENDIENTE') {
      throw new AppError(422, 'OC_NO_PENDIENTE', 'Solo se pueden rechazar órdenes de cambio en estado PENDIENTE');
    }

    const rechazada = await prisma.ordenCambio.update({
      where: { id },
      data: {
        estado: 'RECHAZADA',
        resolutorId: request.userId,
        fechaResolucion: new Date(),
        notaResolucion: data.nota,
      },
    });

    // Emitir evento oc.rechazada
    const resumenHumano = `OC #${orden.numero} rechazada: ${data.nota}`;
    await EventoService.emitir(obraId, request.userId, 'oc.rechazada', {
      entidad_id: id,
      resumen_humano: resumenHumano,
      datos: { numero: orden.numero, titulo: orden.titulo, nota: data.nota },
    });

    return reply.status(200).send(rechazada);
  });

  // POST /api/v1/obras/:obraId/ordenes-cambio/:id/anular
  // R2: solo desde BORRADOR → ANULADA
  app.post('/obras/:obraId/ordenes-cambio/:id/anular', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const orden = await ocFind(obraId, id);
    if (!orden) throw new AppError(404, 'OC_NO_ENCONTRADA', 'Orden de cambio no encontrada');
    if (orden.estado !== 'BORRADOR') {
      throw new AppError(422, 'OC_NO_ANULABLE', 'Solo se pueden anular órdenes de cambio en estado BORRADOR');
    }

    const anulada = await prisma.ordenCambio.update({
      where: { id },
      data: { estado: 'ANULADA' },
    });

    return anulada;
  });

  // GET /api/v1/obras/:obraId/ordenes-cambio/:id/pdf
  // R7: PDF con obra, número, fechas, partes, descripción, ítems, impacto, estado y nota
  app.get('/obras/:obraId/ordenes-cambio/:id/pdf', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;

    const orden = await ocFind(obraId, id);
    if (!orden) throw new AppError(404, 'OC_NO_ENCONTRADA', 'Orden de cambio no encontrada');

    // Generar contenido del PDF como texto formateado (para MVP)
    // En producción se usaría una librería PDF real
    const contenido = generarTextoOC(orden);

    return reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="OC_${orden.numero}_${orden.titulo.replace(/\s+/g, '_')}.txt"`)
      .send(contenido);
  });
}

// ── Helper: generar texto de OC para descarga ────────────────────────────────
function generarTextoOC(orden: any): string {
  const lines: string[] = [];
  const separador = '═'.repeat(60);

  lines.push(separador);
  lines.push(`  ORDEN DE CAMBIO #${orden.numero}`);
  lines.push(separador);
  lines.push('');
  lines.push(`Obra:          ${orden.obra.nombre}`);
  lines.push(`Fecha:         ${orden.fechaResolucion ? new Date(orden.fechaResolucion).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}`);
  lines.push(`Estado:        ${orden.estado}`);
  lines.push('');
  lines.push(`Solicitante:   ${orden.solicitante.nombre} <${orden.solicitante.email}>`);
  if (orden.resolutor) {
    lines.push(`Resolutor:     ${orden.resolutor.nombre}`);
  }
  lines.push('');
  lines.push(`Título:        ${orden.titulo}`);
  lines.push(`Motivo:        ${orden.motivo.replace(/_/g, ' ')}`);
  if (orden.descripcion) {
    lines.push(`Descripción:   ${orden.descripcion}`);
  }
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('  DETALLE DE ÍTEMS');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('  #  Descripción                  Tipo         U.M.   Cant.    P.Unitario    Subtotal');
  lines.push('─'.repeat(60));

  orden.items.forEach((item: any, idx: number) => {
    const desc = item.descripcion.length > 25 ? item.descripcion.substring(0, 22) + '...' : item.descripcion.padEnd(25);
    const tipo = item.tipoRecurso.padEnd(12);
    const um = item.unidad.padEnd(4);
    const cant = item.cantidad.toString().padStart(8);
    const precio = parseFloat(item.precioUnitario.toString()).toLocaleString('es-AR', { minimumFractionDigits: 2 }).padStart(12);
    const subtotal = parseFloat(item.subtotal.toString()).toLocaleString('es-AR', { minimumFractionDigits: 2 }).padStart(13);
    lines.push(`  ${(idx + 1).toString().padStart(2)}  ${desc} ${tipo} ${um} ${cant} ${precio} ${subtotal}`);
  });

  lines.push('─'.repeat(60));
  const total = parseFloat(orden.impactoCosto.toString()).toLocaleString('es-AR', { style: 'currency', currency: orden.moneda });
  lines.push(`  IMPACTO TOTAL: ${total}`);
  lines.push(`  Impacto en días: ${orden.impactoDias > 0 ? '+' : ''}${orden.impactoDias} días`);
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('  RESOLUCIÓN');
  lines.push('─'.repeat(60));

  if (orden.notaResolucion) {
    lines.push(`  Nota: ${orden.notaResolucion}`);
  }
  lines.push(`  Estado final: ${orden.estado}`);
  if (orden.fechaResolucion) {
    lines.push(`  Resuelta el: ${new Date(orden.fechaResolucion).toLocaleString('es-AR')}`);
  }

  lines.push('');
  lines.push(separador);
  lines.push('  Documento generado por ObraClara - Sistema de gestión de obras');
  lines.push(separador);

  return lines.join('\n');
}