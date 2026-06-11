import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';
import { requiereRol } from '../middleware/auth.js';
import { RolObra, TipoPresupuesto, EstadoPresupuesto, TipoRecurso, OrigenItem } from '@q7/shared';
import { EventoService } from './eventos.js';
import { calcularComparador, type ComparadorFila } from '../services/presupuestos/comparador.js';
import { adoptarRubro, adoptarRubroMultiple } from '../services/presupuestos/adopcion.js';

const prisma = new PrismaClient();

// ── Schemas de validación ──

const crearPresupuestoSchema = z.object({
  tipo: z.nativeEnum(TipoPresupuesto),
  nombre: z.string().min(1).max(255),
  moneda: z.string().length(3).default('ARS'),
  fecha_precio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha: YYYY-MM-DD'),
  contratista_miembro_id: z.string().uuid().optional(),
  proveedor_nombre: z.string().max(255).optional(),
  observaciones: z.string().max(2000).optional(),
});

const actualizarPresupuestoSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  fecha_precio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observaciones: z.string().max(2000).optional(),
});

const crearItemSchema = z.object({
  rubro_obra_id: z.string().uuid(),
  tarea_id: z.string().uuid().optional(),
  descripcion: z.string().min(1).max(500),
  tipo_recurso: z.nativeEnum(TipoRecurso).default(TipoRecurso.MATERIAL),
  unidad: z.string().max(10).default('UN'),
  cantidad: z.number().positive(),
  precio_unitario: z.number().positive(),
  incluye: z.string().max(1000).optional(),
  excluye: z.string().max(1000).optional(),
  no_cotizado: z.boolean().default(false),
});

const actualizarItemSchema = z.object({
  descripcion: z.string().min(1).max(500).optional(),
  tipo_recurso: z.nativeEnum(TipoRecurso).optional(),
  unidad: z.string().max(10).optional(),
  cantidad: z.number().positive().optional(),
  precio_unitario: z.number().positive().optional(),
  incluye: z.string().max(1000).optional(),
  excluye: z.string().max(1000).optional(),
});

const crearAdopcionSchema = z.object({
  rubro_obra_id: z.string().uuid(),
  presupuesto_origen_id: z.string().uuid(),
  nota: z.string().max(1000).optional(),
});

// ── Helpers ──

/** Calcula totales de un presupuesto por rubro y por tipo_recurso */
async function calcularTotalesPresupuesto(presupuestoId: string) {
  const items = await prisma.presupuestoItem.findMany({
    where: { presupuestoId, eliminadoEn: null },
    include: { rubroObra: { select: { codigo: true, nombre: true } } },
  });

  const porRubro = new Map<string, { codigo: string; nombre: string; subtotal: string }>();
  const porRecurso: Record<string, string> = {};

  let total = 0;
  for (const item of items) {
    const sid = item.subtotal.toString();
    total += parseFloat(sid);

    // Por rubro
    const existente = porRubro.get(item.rubroObraId);
    if (existente) {
      existente.subtotal = (parseFloat(existente.subtotal) + parseFloat(sid)).toFixed(2);
    } else {
      porRubro.set(item.rubroObraId, {
        codigo: item.rubroObra.codigo,
        nombre: item.rubroObra.nombre,
        subtotal: sid,
      });
    }

    // Por tipo recurso
    const tr = item.tipoRecurso;
    porRecurso[tr] = (parseFloat(porRecurso[tr] || '0') + parseFloat(sid)).toFixed(2);
  }

  return { total: total.toFixed(2), porRubro: Array.from(porRubro.values()), porRecurso };
}

/** Antigüedad en días de la fecha_precio */
function antiguedadDias(fechaPrecio: Date): number {
  const hoy = new Date();
  const diff = hoy.getTime() - fechaPrecio.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Obtener membresía del usuario actual en la obra */
async function obtenerMembresia(obraId: string, usuarioId: string) {
  return prisma.obraMiembro.findFirst({
    where: { obraId, usuarioId, estado: 'ACTIVO', eliminadoEn: null },
  });
}

// ── Rutas ──

export async function presupuestosRoutes(app: FastifyInstance) {

  // GET /api/v1/obras/:obraId/presupuestos
  app.get('/obras/:obraId/presupuestos', {
    preHandler: [requiereRol([
      RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR, RolObra.PROVEEDOR,
    ])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { tipo } = request.query as any;
    const membresia = await obtenerMembresia(obraId, request.userId);

    const where: any = { obraId, eliminadoEn: null };
    if (tipo) where.tipo = tipo;

    // R8: privacidad — CONSTRUCTOR/PROVEEDOR solo ve lo propio
    if (membresia?.rol === RolObra.CONSTRUCTOR || membresia?.rol === RolObra.PROVEEDOR) {
      if (membresia.rol === RolObra.CONSTRUCTOR) {
        where.contratistaMiembroId = membresia.id;
      } else {
        // PROVEEDOR ve solo propuestas propias (sin contratista, por nombre)
        where.contratistaMiembroId = null;
        where.tipo = TipoPresupuesto.PROPUESTA;
      }
    }

    const presupuestos = await prisma.presupuesto.findMany({
      where,
      include: {
        contratistaMiembro: { include: { usuario: { select: { id: true, nombre: true } } } },
        items: { where: { eliminadoEn: null } },
        _count: { select: { items: true } },
      },
      orderBy: [{ tipo: 'asc' }, { creadoEn: 'desc' }],
    });

    // Calcular totales y % cobertura para cada presupuesto
    const result = await Promise.all(presupuestos.map(async (p) => {
      const totales = await calcularTotalesPresupuesto(p.id);
      const diasAntiguedad = antiguedadDias(p.fechaPrecio);

      // R3: % cobertura para propuestas
      let coberturaPct: number | null = null;
      if (p.tipo === TipoPresupuesto.PROPUESTA) {
        const rubrosConItems = await prisma.presupuestoItem.findMany({
          where: { presupuestoId: p.id, eliminadoEn: null },
          distinct: ['rubroObraId'],
          select: { rubroObraId: true },
        });
        const rubrosObra = await prisma.rubroObra.findMany({
          where: { obraId, eliminadoEn: null },
          include: { tareas: { where: { eliminadoEn: null, nivel: 3 } } },
        });
        const rubrosConTareas = rubrosObra.filter(r => r.tareas.length > 0).length;
        coberturaPct = rubrosConTareas > 0 ? Math.round((rubrosConItems.length / rubrosConTareas) * 100) : 0;
      }

      return {
        id: p.id,
        tipo: p.tipo,
        nombre: p.nombre,
        proveedor_nombre: p.proveedorNombre,
        moneda: p.moneda,
        fecha_precio: p.fechaPrecio.toISOString().split('T')[0],
        estado: p.estado,
        observaciones: p.observaciones,
        contratista: p.contratistaMiembro?.usuario?.nombre || null,
        total: totales.total,
        items_count: p._count.items,
        cobertura_pct: coberturaPct,
        dias_antiguedad: diasAntiguedad,
        // No incluir referencia a otros presupuestos si es CONSTRUCTOR/PROVEEDOR
      };
    }));

    return result;
  });

  // POST /api/v1/obras/:obraId/presupuestos
  app.post('/obras/:obraId/presupuestos', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = crearPresupuestoSchema.parse(request.body);
    const membresia = await obtenerMembresia(obraId, request.userId);

    // R1: máx 1 REFERENCIA no descartada y 0 o 1 ADOPTADO por obra
    if (data.tipo === TipoPresupuesto.REFERENCIA) {
      const existente = await prisma.presupuesto.findFirst({
        where: { obraId, tipo: TipoPresupuesto.REFERENCIA, estado: { not: EstadoPresupuesto.DESCARTADO }, eliminadoEn: null },
      });
      if (existente) throw new AppError(409, 'YA_EXISTE_REFERENCIA', 'Ya existe una estimación de referencia para esta obra');
    }
    if (data.tipo === TipoPresupuesto.ADOPTADO) {
      const existente = await prisma.presupuesto.findFirst({
        where: { obraId, tipo: TipoPresupuesto.ADOPTADO, eliminadoEn: null },
      });
      if (existente) throw new AppError(409, 'YA_EXISTE_ADOPTADO', 'Ya existe un presupuesto adoptado para esta obra');
    }

    // R8: CONSTRUCTOR solo puede crear propuestas propias
    if (membresia?.rol === RolObra.CONSTRUCTOR && data.tipo === TipoPresupuesto.PROPUESTA) {
      data.contratista_miembro_id = membresia.id;
    }

    const presupuesto = await prisma.presupuesto.create({
      data: {
        obraId,
        tipo: data.tipo,
        nombre: data.nombre,
        moneda: data.moneda,
        fechaPrecio: new Date(data.fecha_precio),
        contratistaMiembroId: data.contratista_miembro_id,
        proveedorNombre: data.proveedor_nombre,
        observaciones: data.observaciones,
        estado: EstadoPresupuesto.BORRADOR,
      },
    });

    await EventoService.emitir(obraId, request.userId, 'presupuesto.creado', {
      entidad_id: presupuesto.id,
      resumen_humano: `Presupuesto "${presupuesto.nombre}" creado como ${data.tipo}`,
      datos: { tipo: data.tipo, moneda: data.moneda },
    });

    return reply.status(201).send({ id: presupuesto.id, ...presupuesto });
  });

  // GET /api/v1/obras/:obraId/presupuestos/:id
  app.get('/obras/:obraId/presupuestos/:id', {
    preHandler: [requiereRol([
      RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR, RolObra.PROVEEDOR,
    ])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const membresia = await obtenerMembresia(obraId, request.userId);

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
      include: {
        contratistaMiembro: { include: { usuario: { select: { id: true, nombre: true } } } },
        items: {
          where: { eliminadoEn: null },
          include: {
            rubroObra: { select: { id: true, codigo: true, nombre: true } },
            tarea: { select: { id: true, codigo: true, descripcion: true } },
          },
          orderBy: [{ rubroObra: { orden: 'asc' } }, { creadoEn: 'asc' }],
        },
      },
    });

    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    // R8: privacidad
    if ((membresia?.rol === RolObra.CONSTRUCTOR || membresia?.rol === RolObra.PROVEEDOR) && presupuesto.tipo === TipoPresupuesto.REFERENCIA) {
      throw new AppError(403, 'OBRA_SIN_PERMISO', 'No tenés permiso para ver este presupuesto');
    }

    // Agrupar por rubro
    const porRubro = new Map<string, { rubro: any; items: any[]; subtotal: number }>();
    for (const item of presupuesto.items) {
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

    const totales = await calcularTotalesPresupuesto(id);
    const diasAntiguedad = antiguedadDias(presupuesto.fechaPrecio);

    return {
      id: presupuesto.id,
      tipo: presupuesto.tipo,
      nombre: presupuesto.nombre,
      proveedor_nombre: presupuesto.proveedorNombre,
      moneda: presupuesto.moneda,
      fecha_precio: presupuesto.fechaPrecio.toISOString().split('T')[0],
      estado: presupuesto.estado,
      observaciones: presupuesto.observaciones,
      contratista: presupuesto.contratistaMiembro?.usuario?.nombre || null,
      dias_antiguedad: diasAntiguedad,
      total: totales.total,
      items_count: presupuesto.items.length,
      por_rubro: Array.from(porRubro.values()).map(r => ({
        id: r.rubro.id,
        codigo: r.rubro.codigo,
        nombre: r.rubro.nombre,
        items: r.items.map(i => ({
          id: i.id,
          tarea_id: i.tareaId,
          tarea_codigo: i.tarea?.codigo || null,
          tarea_descripcion: i.tarea?.descripcion || null,
          descripcion: i.descripcion,
          tipo_recurso: i.tipoRecurso,
          unidad: i.unidad,
          cantidad: i.cantidad.toString(),
          precio_unitario: i.precioUnitario.toString(),
          subtotal: i.subtotal.toString(),
          incluye: i.incluye,
          excluye: i.excluye,
          no_cotizado: i.noCotizado,
          origen: i.origen,
        })),
        subtotal: r.subtotal.toFixed(2),
      })),
      totales_por_recurso: totales.porRecurso,
    };
  });

  // PATCH /api/v1/obras/:obraId/presupuestos/:id
  app.patch('/obras/:obraId/presupuestos/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const data = actualizarPresupuestoSchema.parse(request.body);
    const membresia = await obtenerMembresia(obraId, request.userId);

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    // R2: ADOPTADO no se edita a mano
    if (presupuesto.tipo === TipoPresupuesto.ADOPTADO) {
      throw new AppError(422, 'ADOPTADO_NO_EDITABLE', 'El presupuesto adoptado no se puede editar manualmente');
    }

    // R8: CONSTRUCTOR solo edita lo propio
    if (membresia?.rol === RolObra.CONSTRUCTOR && presupuesto.contratistaMiembroId !== membresia.id) {
      throw new AppError(403, 'OBRA_SIN_PERMISO', 'No podés editar este presupuesto');
    }

    // R7: no se puede descartar si tiene adopciones
    if (presupuesto.estado === EstadoPresupuesto.ADOPTADO_PARCIAL || presupuesto.estado === EstadoPresupuesto.ADOPTADO_TOTAL) {
      if (data.observaciones !== undefined) {
        // Solo observaciones se permiten
        return prisma.presupuesto.update({
          where: { id },
          data: { observaciones: data.observaciones },
        });
      }
      throw new AppError(422, 'NO_SE_PUEDE_DESCARTAR', 'Una propuesta con rubros adoptados no puede descartarse');
    }

    return prisma.presupuesto.update({
      where: { id },
      data: {
        nombre: data.nombre ?? presupuesto.nombre,
        fechaPrecio: data.fecha_precio ? new Date(data.fecha_precio) : presupuesto.fechaPrecio,
        observaciones: data.observaciones ?? presupuesto.observaciones,
      },
    });
  });

  // DELETE /api/v1/obras/:obraId/presupuestos/:id
  app.delete('/obras/:obraId/presupuestos/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const membresia = await obtenerMembresia(obraId, request.userId);

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    // R7: no descartar si tiene adopciones
    if (presupuesto.estado === EstadoPresupuesto.ADOPTADO_PARCIAL || presupuesto.estado === EstadoPresupuesto.ADOPTADO_TOTAL) {
      throw new AppError(422, 'NO_SE_PUEDE_DESCARTAR', 'Una propuesta con rubros adoptados no puede descartarse');
    }

    // R8: CONSTRUCTOR solo elimina lo propio
    if (membresia?.rol === RolObra.CONSTRUCTOR && presupuesto.contratistaMiembroId !== membresia.id) {
      throw new AppError(403, 'OBRA_SIN_PERMISO', 'No podés eliminar este presupuesto');
    }

    return prisma.presupuesto.update({
      where: { id },
      data: { estado: EstadoPresupuesto.DESCARTADO },
    });
  });

  // POST /api/v1/obras/:obraId/presupuestos/:id/items
  app.post('/obras/:obraId/presupuestos/:id/items', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;
    const data = crearItemSchema.parse(request.body);
    const membresia = await obtenerMembresia(obraId, request.userId);

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    // R2: ADOPTADO no recibe items manuales (salvo que vengan de OC)
    if (presupuesto.tipo === TipoPresupuesto.ADOPTADO) {
      throw new AppError(422, 'ADOPTADO_NO_RECIBE_ITEMS', 'El presupuesto adoptado solo recibe ítems por adopción u OC aprobada');
    }

    // R8: CONSTRUCTOR solo edita lo propio
    if (membresia?.rol === RolObra.CONSTRUCTOR && presupuesto.contratistaMiembroId !== membresia.id) {
      throw new AppError(403, 'OBRA_SIN_PERMISO', 'No podés agregar ítems a este presupuesto');
    }

    // Verificar rubro existe y pertenece a la obra
    const rubro = await prisma.rubroObra.findFirst({
      where: { id: data.rubro_obra_id, obraId, eliminadoEn: null },
    });
    if (!rubro) throw new AppError(404, 'RUBRO_NO_ENCONTRADO', 'Rubro no encontrado');

    const cantidad = parseFloat(data.cantidad.toString());
    const precioUnitario = parseFloat(data.precio_unitario.toString());
    const subtotal = cantidad * precioUnitario;

    const item = await prisma.presupuestoItem.create({
      data: {
        presupuestoId: id,
        rubroObraId: data.rubro_obra_id,
        tareaId: data.tarea_id,
        descripcion: data.descripcion,
        tipoRecurso: data.tipo_recurso,
        unidad: data.unidad as any,
        cantidad,
        precioUnitario,
        subtotal,
        incluye: data.incluye,
        excluye: data.excluye,
        noCotizado: data.no_cotizado,
        origen: OrigenItem.MANUAL,
      },
    });

    // Actualizar estado a VIGENTE si estaba BORRADOR
    if (presupuesto.estado === EstadoPresupuesto.BORRADOR) {
      await prisma.presupuesto.update({ where: { id }, data: { estado: EstadoPresupuesto.VIGENTE } });
    }

    await EventoService.emitir(obraId, request.userId, 'presupuesto.item_agregado', {
      entidad_id: item.id,
      resumen_humano: `Ítem "${data.descripcion}" agregado a "${presupuesto.nombre}"`,
      datos: { presupuesto_id: id, rubro: rubro.nombre },
    });

    return reply.status(201).send({
      id: item.id,
      cantidad: item.cantidad.toString(),
      precio_unitario: item.precioUnitario.toString(),
      subtotal: item.subtotal.toString(),
    });
  });

  // PATCH /api/v1/obras/:obraId/presupuestos/:id/items/:itemId
  app.patch('/obras/:obraId/presupuestos/:id/items/:itemId', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id, itemId } = request.params as any;
    const data = actualizarItemSchema.parse(request.body);
    const membresia = await obtenerMembresia(obraId, request.userId);

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    // R2: ADOPTADO no se edita manualmente
    if (presupuesto.tipo === TipoPresupuesto.ADOPTADO) {
      throw new AppError(422, 'ADOPTADO_NO_EDITABLE', 'El presupuesto adoptado no se puede editar');
    }

    // R8: CONSTRUCTOR solo edita lo propio
    if (membresia?.rol === RolObra.CONSTRUCTOR && presupuesto.contratistaMiembroId !== membresia.id) {
      throw new AppError(403, 'OBRA_SIN_PERMISO', 'No podés editar ítems de este presupuesto');
    }

    const item = await prisma.presupuestoItem.findFirst({
      where: { id: itemId, presupuestoId: id, eliminadoEn: null },
    });
    if (!item) throw new AppError(404, 'ITEM_NO_ENCONTRADO', 'Ítem no encontrado');

    const updateData: any = {};
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.tipo_recurso !== undefined) updateData.tipoRecurso = data.tipo_recurso;
    if (data.unidad !== undefined) updateData.unidad = data.unidad;

    if (data.cantidad !== undefined || data.precio_unitario !== undefined) {
      const newCantidad = data.cantidad !== undefined ? parseFloat(data.cantidad.toString()) : parseFloat(item.cantidad.toString());
      const newPrecio = data.precio_unitario !== undefined ? parseFloat(data.precio_unitario.toString()) : parseFloat(item.precioUnitario.toString());
      updateData.cantidad = newCantidad;
      updateData.precioUnitario = newPrecio;
      updateData.subtotal = newCantidad * newPrecio;
    }

    if (data.incluye !== undefined) updateData.incluye = data.incluye;
    if (data.excluye !== undefined) updateData.excluye = data.excluye;

    return prisma.presupuestoItem.update({
      where: { id: itemId },
      data: updateData,
    });
  });

  // DELETE /api/v1/obras/:obraId/presupuestos/:id/items/:itemId
  app.delete('/obras/:obraId/presupuestos/:id/items/:itemId', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id, itemId } = request.params as any;
    const membresia = await obtenerMembresia(obraId, request.userId);

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    if (presupuesto.tipo === TipoPresupuesto.ADOPTADO) {
      throw new AppError(422, 'ADOPTADO_NO_EDITABLE', 'El presupuesto adoptado no se puede editar');
    }

    if (membresia?.rol === RolObra.CONSTRUCTOR && presupuesto.contratistaMiembroId !== membresia.id) {
      throw new AppError(403, 'OBRA_SIN_PERMISO', 'No podés eliminar ítems de este presupuesto');
    }

    return prisma.presupuestoItem.update({
      where: { id: itemId },
      data: { eliminadoEn: new Date() },
    });
  });

  // POST /api/v1/obras/:obraId/presupuestos/:id/items/no-cotizado
  app.post('/obras/:obraId/presupuestos/:id/items/no-cotizado', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;
    const { rubro_obra_id } = (request.body as any) || {};

    if (!rubro_obra_id) throw new AppError(400, 'RUBRO_REQUERIDO', 'Se requiere rubro_obra_id');

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    if (presupuesto.tipo !== TipoPresupuesto.PROPUESTA) {
      throw new AppError(422, 'SOLO_PROPUESTA', 'Solo se pueden marcar rubros como no cotizados en propuestas');
    }

    // Marcar todos los items de ese rubro como no_cotizado
    await prisma.presupuestoItem.updateMany({
      where: { presupuestoId: id, rubroObraId: rubro_obra_id, eliminadoEn: null },
      data: { noCotizado: true },
    });

    return { ok: true };
  });

  // POST /api/v1/obras/:obraId/presupuestos/:id/importar
  app.post('/obras/:obraId/presupuestos/:id/importar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const { filas } = (request.body as any) || {};

    if (!filas || !Array.isArray(filas)) {
      throw new AppError(400, 'FORMATO_INVALIDO', 'Se requiere array "filas"');
    }

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    if (presupuesto.tipo === TipoPresupuesto.ADOPTADO) {
      throw new AppError(422, 'ADOPTADO_NO_IMPORTABLE', 'El presupuesto adoptado no acepta importaciones');
    }

    // Obtener rubros de la obra
    const rubrosObra = await prisma.rubroObra.findMany({
      where: { obraId, eliminadoEn: null },
      select: { id: true, codigo: true, nombre: true },
    });

    const filasDetectadas = filas.map((f: any, idx: number) => {
      const codigoRubro = (f.CODIGO_RUBRO || f.codigo_rubro || '').toString().trim().toUpperCase();
      const codigoTarea = (f.CODIGO_TAREA || f.codigo_tarea || '').toString().trim();
      const descripcion = (f.DESCRIPCION || f.descripcion || '').toString().trim();
      const tipoRecurso = (f.TIPO_RECURSO || f.tipo_recurso || 'MATERIAL').toString().trim().toUpperCase();
      const unidad = (f.UNIDAD || f.unidad || 'UN').toString().trim().toUpperCase();
      const cantidadRaw = f.CANTIDAD || f.cantidad || '';
      const precioRaw = f.PRECIO_UNITARIO || f.precio_unitario || '';
      const incluye = (f.INCLUYE || f.incluye || '').toString().trim();
      const excluye = (f.EXCLUYE || f.excluye || '').toString().trim();

      const advertencia: string[] = [];
      const rubroEncontrado = rubrosObra.find(r => r.codigo === codigoRubro);

      if (!rubroEncontrado && codigoRubro) {
        advertencia.push(`Rubro "${codigoRubro}" no existe en esta obra`);
      }

      if (!['MO', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO', 'OTRO'].includes(tipoRecurso)) {
        advertencia.push(`Tipo recurso "${tipoRecurso}" no válido`);
      }

      if (!['GL', 'M2', 'M3', 'ML', 'UN', 'KG', 'HS', 'DIA'].includes(unidad)) {
        advertencia.push(`Unidad "${unidad}" no válida`);
      }

      const cantidad = cantidadRaw ? parseFloat(cantidadRaw) : null;
      const precio = precioRaw ? parseFloat(precioRaw) : null;

      if (cantidadRaw && isNaN(cantidad!)) advertencia.push(`Cantidad "${cantidadRaw}" no numérica`);
      if (precioRaw && isNaN(precio!)) advertencia.push(`Precio "${precioRaw}" no numérico`);

      return {
        idx,
        codigo_rubro: codigoRubro,
        rubro_encontrado: rubroEncontrado,
        codigo_tarea: codigoTarea,
        descripcion,
        tipo_recurso: tipoRecurso,
        unidad,
        cantidad,
        precio_unitario: precio,
        incluye,
        excluye,
        advertencia,
      };
    });

    return { filas_detectadas: filasDetectadas };
  });

  // POST /api/v1/obras/:obraId/presupuestos/:id/importar/confirmar
  app.post('/obras/:obraId/presupuestos/:id/importar/confirmar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;
    const { filas_mapeadas } = (request.body as any) || {};

    if (!filas_mapeadas || !Array.isArray(filas_mapeadas)) {
      throw new AppError(400, 'FORMATO_INVALIDO', 'Se requiere array "filas_mapeadas"');
    }

    const presupuesto = await prisma.presupuesto.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!presupuesto) throw new AppError(404, 'PRESUPUESTO_NO_ENCONTRADO', 'Presupuesto no encontrado');

    const creados: { items: number; rubros: number } = { items: 0, rubros: 0 };
    const advertencias: string[] = [];

    for (const fila of filas_mapeadas) {
      if (!fila.rubro_encontrado) {
        advertencias.push(`Fila ${fila.idx}: rubro "${fila.codigo_rubro}" no encontrado, se ignora`);
        continue;
      }

      if (fila.cantidad === null || fila.precio_unitario === null) {
        advertencias.push(`Fila ${fila.idx}: cantidad o precio faltante, se ignora`);
        continue;
      }

      // Buscar tarea por código
      let tareaId: string | null = null;
      if (fila.codigo_tarea) {
        const tarea = await prisma.tarea.findFirst({
          where: { obraId, codigo: fila.codigo_tarea, eliminadoEn: null },
        });
        tareaId = tarea?.id || null;
        if (!tarea) {
          advertencias.push(`Fila ${fila.idx}: tarea "${fila.codigo_tarea}" no encontrada, se vincula solo al rubro`);
        }
      }

      const cantidad = parseFloat(fila.cantidad);
      const precio = parseFloat(fila.precio_unitario);
      const subtotal = cantidad * precio;

      await prisma.presupuestoItem.create({
        data: {
          presupuestoId: id,
          rubroObraId: fila.rubro_encontrado.id,
          tareaId,
          descripcion: fila.descripcion || fila.codigo_tarea || 'Ítem importado',
          tipoRecurso: (['MO', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO', 'OTRO'].includes(fila.tipo_recurso) ? fila.tipo_recurso : 'MATERIAL') as any,
          unidad: (['GL', 'M2', 'M3', 'ML', 'UN', 'KG', 'HS', 'DIA'].includes(fila.unidad) ? fila.unidad : 'UN') as any,
          cantidad,
          precioUnitario: precio,
          subtotal,
          incluye: fila.incluye || null,
          excluye: fila.excluye || null,
          origen: OrigenItem.IMPORTACION,
        },
      });
      creados.items++;
    }

    // Actualizar estado si estaba BORRADOR
    if (presupuesto.estado === EstadoPresupuesto.BORRADOR) {
      await prisma.presupuesto.update({ where: { id }, data: { estado: EstadoPresupuesto.VIGENTE } });
    }

    return reply.status(201).send({ creados, advertencias });
  });

  // GET /api/v1/obras/:obraId/comparador
  app.get('/obras/:obraId/comparador', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { propuestas } = request.query as any;

    if (!propuestas) throw new AppError(400, 'PROPUESTAS_REQUERIDAS', 'Se requiere ?propuestas=id1,id2,id3');

    const ids = propuestas.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (ids.length < 2) throw new AppError(400, 'MINIMO_DOS_PROPUESTAS', 'Comparar exige al menos 2 propuestas');

    const resultado = await calcularComparador(obraId, ids);
    return resultado;
  });

  // POST /api/v1/obras/:obraId/adopciones
  app.post('/obras/:obraId/adopciones', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = crearAdopcionSchema.parse(request.body);

    const result = await adoptarRubro(obraId, data.rubro_obra_id, data.presupuesto_origen_id, request.userId, data.nota);

    await EventoService.emitir(obraId, request.userId, 'presupuesto.adoptado_rubro', {
      entidad_id: result.adopcion.id,
      resumen_humano: `Rubro adoptado de propuesta: ${result.montoAdoptado}`,
      datos: { rubro_obra_id: data.rubro_obra_id, presupuesto_origen_id: data.presupuesto_origen_id, monto: result.montoAdoptado },
    });

    return reply.status(201).send(result);
  });

  // POST /api/v1/obras/:obraId/adopciones/masivas
  app.post('/obras/:obraId/adopciones/masivas', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const { adopciones } = (request.body as any) || {};

    if (!adopciones || !Array.isArray(adopciones) || adopciones.length === 0) {
      throw new AppError(400, 'ADOPCIONES_REQUERIDAS', 'Se requiere array de adopciones');
    }

    const results = await adoptarRubroMultiple(obraId, adopciones, request.userId);

    await EventoService.emitir(obraId, request.userId, 'presupuesto.adoptado_rubro', {
      entidad_id: 'masiva',
      resumen_humano: `Adopción masiva: ${results.length} rubros adoptados`,
      datos: { cantidad: results.length },
    });

    return reply.status(201).send({ adopciones: results });
  });

  // DELETE /api/v1/obras/:obraId/adopciones/:id
  app.delete('/obras/:obraId/adopciones/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const adopcion = await prisma.adopcion.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!adopcion) throw new AppError(404, 'ADOPCION_NO_ENCONTRADA', 'Adopción no encontrada');

    // Soft-delete de la adopción
    return prisma.adopcion.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  });

  // GET /api/v1/obras/:obraId/comparador/exportar
  app.get('/obras/:obraId/comparador/exportar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { propuestas } = request.query as any;

    if (!propuestas) throw new AppError(400, 'PROPUESTAS_REQUERIDAS', 'Se requiere ?propuestas=id1,id2,id3');

    const ids = propuestas.split(',').map((s: string) => s.trim()).filter(Boolean);
    const resultado = await calcularComparador(obraId, ids);

    // Generar CSV
    const headers = ['Rubro', ...resultado.columnas.map(c => `${c.nombre} (${c.tipo})`)];
    const filasCsv = resultado.filas.map(f => {
      const fila: string[] = [`${f.rubro_codigo} ${f.rubro_nombre}`];
      for (const col of resultado.columnas) {
        const celda = f.celdas[col.id];
        if (!celda) {
          fila.push('No cotiza');
        } else {
          fila.push(celda.subtotal.toString());
        }
      }
      return fila;
    });

    return {
      headers,
      filas: filasCsv,
      totales: resultado.totales,
      info: 'Total comparable = suma de rubros que TODAS las propuestas cotizan completo',
    };
  });
}