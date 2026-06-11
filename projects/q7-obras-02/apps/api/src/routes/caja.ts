/**
 * Rutas M3: Caja de obra (compromisos, pagos y desvío)
 * Endpoints: GET/POST /api/v1/obras/:obraId/movimientos,
 *            PATCH /api/v1/obras/:obraId/movimientos/:id,
 *            POST /api/v1/obras/:obraId/movimientos/:id/anular,
 *            GET /api/v1/obras/:obraId/caja/resumen,
 *            GET /api/v1/obras/:obraId/caja/exportar,
 *            GET/POST/PATCH /api/v1/obras/:obraId/indices
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';
import { requiereRol } from '../middleware/auth.js';
import { RolObra, TipoMovimiento, EstadoMovimiento } from '@q7/shared';
import { EventoService } from './eventos.js';
import {
  resumenGlobal,
  saldoCompromiso,
  compromisosAbiertos,
  proveedoresHistoricos,
  ResumenGlobal,
} from '../services/caja/calculos.js';

const prisma = new PrismaClient();

// ── Schemas de validación ─────────────────────────────────────────────────────

const crearMovimientoSchema = z.object({
  tipo: z.enum(['COMPROMISO', 'PAGO']),
  rubro_obra_id: z.string().uuid(),
  tarea_id: z.string().uuid().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proveedor_nombre: z.string().min(1).max(255).optional(),
  contratista_miembro_id: z.string().uuid().optional(),
  descripcion: z.string().max(500).optional(),
  moneda: z.string().length(3).default('ARS'),
  importe: z.number().positive(),
  compromiso_id: z.string().uuid().optional(),
  medio_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'OTRO']).optional(),
});

const patchMovimientoSchema = z.object({
  descripcion: z.string().max(500).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const anularMovimientoSchema = z.object({
  motivo: z.string().min(4).max(500),
});

const indiceSchema = z.object({
  tipo: z.enum(['INFLACION_MENSUAL', 'TC_USD']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.number().nonnegative(),
});

// ── Helper: verificar que el rubro pertenece a la obra ─────────────────────────
async function rubroPerteneceAObra(rubroId: string, obraId: string): Promise<boolean> {
  const r = await prisma.rubroObra.findFirst({ where: { id: rubroId, obraId, eliminadoEn: null } });
  return !!r;
}

// ── Helper: verificar membresía y rol ──────────────────────────────────────────
async function obtenerMiembroConRol(obraId: string, usuarioId: string) {
  return prisma.obraMiembro.findFirst({
    where: { obraId, usuarioId, estado: 'ACTIVO', eliminadoEn: null },
  });
}

// ── GET /api/v1/obras/:obraId/movimientos ──────────────────────────────────────
export async function cajaRoutes(app: FastifyInstance) {
  app.get('/obras/:obraId/movimientos', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const {
      tipo, rubroId, desde, hasta, proveedor,
      pagina = '1', porPagina = '25',
    } = request.query as any;

    const miembro = await obtenerMiembroConRol(obraId, request.userId);

    // R7: CONSTRUCTOR solo ve sus propios movimientos
    const where: any = { obraId, eliminadoEn: null };
    if (miembro?.rol === RolObra.CONSTRUCTOR) {
      where.contratistaMiembroId = miembro.id;
    }
    if (tipo) where.tipo = tipo;
    if (rubroId) where.rubroObraId = rubroId;
    if (desde) where.fecha = { ...where.fecha, gte: new Date(desde) };
    if (hasta) where.fecha = { ...where.fecha, lte: new Date(hasta) };
    if (proveedor) where.proveedorNombre = { contains: proveedor, mode: 'insensitive' };

    const page = parseInt(pagina);
    const limit = parseInt(porPagina);
    const skip = (page - 1) * limit;

    const [movimientos, total] = await Promise.all([
      prisma.movimiento.findMany({
        where,
        include: {
          rubroObra: { select: { id: true, codigo: true, nombre: true } },
          tarea: { select: { id: true, codigo: true, descripcion: true } },
          compromiso: { select: { id: true, descripcion: true, importe: true } },
          contratistaMiembro: {
            select: { id: true, usuario: { select: { id: true, nombre: true } } },
          },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      prisma.movimiento.count({ where }),
    ]);

    return { datos: movimientos, total, pagina: page };
  });

  // POST /api/v1/obras/:obraId/movimientos
  app.post('/obras/:obraId/movimientos', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = crearMovimientoSchema.parse(request.body);

    // Validar que el rubro pertenece a la obra
    if (!(await rubroPerteneceAObra(data.rubro_obra_id, obraId))) {
      throw new AppError(400, 'RUBRO_INVALIDO', 'El rubro no pertenece a esta obra');
    }

    // R1: importe > 0 se valida con .positive()
    // R1: si moneda difiere de moneda_base, marcar con advertencia (se excluye de cálculos)
    const obra = await prisma.obra.findUnique({ where: { id: obraId } });
    const monedaDiferente = data.moneda !== obra!.monedaBase;

    // R2: si es PAGO con compromiso_id, no puede exceder el saldo del compromiso
    if (data.tipo === 'PAGO' && data.compromiso_id) {
      const saldo = await saldoCompromiso(data.compromiso_id);
      if (data.importe > saldo) {
        throw new AppError(
          422,
          'PAGO_EXCEDE_COMPROMISO',
          `El pago ($ ${data.importe.toFixed(2)}) excede el saldo disponible del compromiso ($ ${saldo.toFixed(2)})`
        );
      }
    }

    // Proveedor: requiere uno de los dos campos
    if (!data.proveedor_nombre && !data.contratista_miembro_id) {
      throw new AppError(400, 'PROVEEDOR_REQUERIDO', 'Debes indicar proveedor_nombre o contratista_miembro_id');
    }

    // Si hay contratista_miembro_id, obtener el nombre del usuario
    let proveedorNombre = data.proveedor_nombre;
    if (data.contratista_miembro_id && !proveedorNombre) {
      const member = await prisma.obraMiembro.findUnique({
        where: { id: data.contratista_miembro_id },
        include: { usuario: { select: { nombre: true } } },
      });
      proveedorNombre = member?.usuario?.nombre || 'Contratista';
    }

    const movimiento = await prisma.movimiento.create({
      data: {
        obraId,
        rubroObraId: data.rubro_obra_id,
        tareaId: data.tarea_id,
        tipo: data.tipo as any,
        compromisoId: data.compromiso_id,
        fecha: new Date(data.fecha + 'T00:00:00Z'),
        proveedorNombre: proveedorNombre!,
        contratistaMiembroId: data.contratista_miembro_id,
        descripcion: data.descripcion,
        moneda: data.moneda,
        importe: data.importe,
        medioPago: data.medio_pago as any || null,
        estado: 'VIGENTE',
      },
    });

    // R5: detectar desvío del semáforo tras persistir
    const resumen: ResumenGlobal = await resumenGlobal(obraId);
    const rubroResumen = resumen.porRubro.find(r => r.rubroId === data.rubro_obra_id);
    if (rubroResumen) {
      const rubroInfo = await prisma.rubroObra.findUnique({ where: { id: data.rubro_obra_id } });
      const resumenAnteriorStr = request.headers['x-ultimo-resumen'] as string;
      let resumenAnterior: ResumenRubro | null = null;
      if (resumenAnteriorStr) {
        try { resumenAnterior = JSON.parse(resumenAnteriorStr); } catch { /* ignore */ }
      }
      if (resumenAnterior) {
        // Detectamos si cruzó umbral
        if (resumenAnterior.semaforo !== rubroResumen.semaforo && rubroResumen.semaforo !== 'verde') {
          await EventoService.emitir(obraId, request.userId, 'caja.desvio_detectado', {
            entidad_id: movimiento.id,
            resumen_humano: `${rubroInfo!.codigo} superó el previsto: $${(rubroResumen.ejecutado - rubroResumen.previsto).toLocaleString('es-AR')} sobre $${rubroResumen.previsto.toLocaleString('es-AR')}`,
            datos: {
              rubroId: data.rubro_obra_id,
              rubroCodigo: rubroInfo!.codigo,
              previsto: rubroResumen.previsto,
              ejecutado: rubroResumen.ejecutado,
              desvioPct: rubroResumen.desvioPct,
              semaforo: rubroResumen.semaforo,
            },
          });
        }
      }
    }

    // Emitir evento del movimiento
    const tipoEvento = data.tipo === 'COMPROMISO'
      ? 'caja.compromiso_registrado'
      : 'caja.pago_registrado';
    const rubroInfo = await prisma.rubroObra.findUnique({ where: { id: data.rubro_obra_id } });
    const resumenHumano = data.tipo === 'COMPROMISO'
      ? `Nuevo compromiso en ${rubroInfo!.codigo}: $${data.importe.toLocaleString('es-AR')} a ${proveedorNombre}`
      : `Pago registrado en ${rubroInfo!.codigo}: $${data.importe.toLocaleString('es-AR')} a ${proveedorNombre}`;

    await EventoService.emitir(obraId, request.userId, tipoEvento, {
      entidad_id: movimiento.id,
      resumen_humano: resumenHumano,
      datos: { tipo: data.tipo, importe: data.importe, proveedor: proveedorNombre, rubro: rubroInfo!.codigo },
    });

    return reply.status(201).send({ ...movimiento, _advertencia_moneda_diferente: monedaDiferente });
  });

  // PATCH /api/v1/obras/:obraId/movimientos/:id
  // R4: solo descripcion y fecha; no se edita importe/rubro/tipo
  app.patch('/obras/:obraId/movimientos/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const data = patchMovimientoSchema.parse(request.body);

    const movimiento = await prisma.movimiento.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!movimiento) throw new AppError(404, 'MOVIMIENTO_NO_ENCONTRADO', 'Movimiento no encontrado');
    if (movimiento.estado === 'ANULADO') {
      throw new AppError(422, 'MOVIMIENTO_ANULADO', 'No se puede editar un movimiento anulado');
    }

    return prisma.movimiento.update({
      where: { id },
      data: {
        descripcion: data.descripcion ?? movimiento.descripcion,
        fecha: data.fecha ? new Date(data.fecha + 'T00:00:00Z') : movimiento.fecha,
      },
    });
  });

  // POST /api/v1/obras/:obraId/movimientos/:id/anular
  app.post('/obras/:obraId/movimientos/:id/anular', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;
    const { motivo } = anularMovimientoSchema.parse(request.body);

    const movimiento = await prisma.movimiento.findFirst({
      where: { id, obraId, eliminadoEn: null },
      include: { pagos: { where: { estado: 'VIGENTE' } } },
    });
    if (!movimiento) throw new AppError(404, 'MOVIMIENTO_NO_ENCONTRADO', 'Movimiento no encontrado');
    if (movimiento.estado === 'ANULADO') {
      throw new AppError(422, 'MOVIMIENTO_YA_ANULADO', 'Este movimiento ya está anulado');
    }

    // R3: si es un COMPROMISO con pagos aplicados, no se puede anular
    if (movimiento.tipo === 'COMPROMISO' && movimiento.pagos.length > 0) {
      throw new AppError(
        422,
        'COMPROMISO_CON_PAGOS',
        'Este compromiso tiene pagos aplicados. Anulá primero los pagos o desvinculalos antes de anular el compromiso.'
      );
    }

    await prisma.movimiento.update({
      where: { id },
      data: { estado: 'ANULADO' },
    });

    // Si es un PAGO, desvinculamos del compromiso (el saldo queda libre)
    if (movimiento.tipo === 'PAGO' && movimiento.compromisoId) {
      await prisma.movimiento.update({
        where: { id },
        data: { compromisoId: null },
      });
    }

    return reply.status(200).send({ mensaje: 'Movimiento anulado', motivo });
  });

  // GET /api/v1/obras/:obraId/caja/resumen
  app.get('/obras/:obraId/caja/resumen', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const miembro = await obtenerMiembroConRol(obraId, request.userId);

    // R7: CONSTRUCTOR ve solo resumen filtrado a su contratista_miembro_id
    // (pasamos el id al resumenGlobal que filtra movimientos)
    const resumen = await resumenGlobal(obraId, miembro?.rol === RolObra.CONSTRUCTOR ? miembro.id : undefined);
    return resumen;
  });

  // GET /api/v1/obras/:obraId/caja/proveedores (autocompletar)
  app.get('/api/v1/obras/:obraId/caja/proveedores', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const proveedores = await proveedoresHistoricos(obraId);
    return { datos: proveedores };
  });

  // GET /api/v1/obras/:obraId/caja/compromisos-abiertos?rubroId=
  app.get('/api/v1/obras/:obraId/caja/compromisos-abiertos', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { rubroId } = request.query as any;
    if (!rubroId) throw new AppError(400, 'RUBRO_REQUERIDO', 'Se requiere rubroId');

    const miembro = await obtenerMiembroConRol(obraId, request.userId);
    const compromisos = await compromisosAbiertos(
      rubroId,
      miembro?.rol === RolObra.CONSTRUCTOR ? miembro.id : undefined
    );
    return { datos: compromisos };
  });

  // GET /api/v1/obras/:obraId/caja/exportar
  app.get('/api/v1/obras/:obraId/caja/exportar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { rubroId, tipo, desde, hasta } = request.query as any;

    const where: any = { obraId, eliminadoEn: null };
    if (tipo) where.tipo = tipo;
    if (rubroId) where.rubroObraId = rubroId;
    if (desde) where.fecha = { ...where.fecha, gte: new Date(desde) };
    if (hasta) where.fecha = { ...where.fecha, lte: new Date(hasta) };

    const movimientos = await prisma.movimiento.findMany({
      where,
      include: {
        rubroObra: { select: { codigo: true, nombre: true } },
        tarea: { select: { codigo: true, descripcion: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    // CSV simple
    const headers = ['Fecha', 'Tipo', 'Rubro', 'Proveedor', 'Descripción', 'Moneda', 'Importe', 'Medio', 'Estado'];
    const rows = movimientos.map(m => [
      m.fecha.toISOString().split('T')[0],
      m.tipo,
      `${m.rubroObra.codigo} ${m.rubroObra.nombre}`,
      m.proveedorNombre,
      m.descripcion || '',
      m.moneda,
      m.importe.toString(),
      m.medioPago || '',
      m.estado,
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="caja_${obraId}.csv"`)
      .send(csv);
  });

  // ── Índices (ADMIN) ────────────────────────────────────────────────────────

  // GET /api/v1/obras/:obraId/indices
  app.get('/api/v1/obras/:obraId/indices', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { tipo, desde, hasta } = request.query as any;

    const where: any = {};
    if (tipo) where.tipo = tipo;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }

    return prisma.indice.findMany({
      where,
      orderBy: { fecha: 'desc' },
    });
  });

  // POST /api/v1/obras/:obraId/indices
  app.post('/api/v1/obras/:obraId/indices', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = indiceSchema.parse(request.body);

    // No se requiere obraId para índice (es global), solo verificación de permisos
    const indice = await prisma.indice.upsert({
      where: { tipo_fecha: { tipo: data.tipo, fecha: new Date(data.fecha + 'T00:00:00Z') } },
      update: { valor: data.valor },
      create: {
        tipo: data.tipo as any,
        fecha: new Date(data.fecha + 'T00:00:00Z'),
        valor: data.valor,
      },
    });

    return reply.status(201).send(indice);
  });

  // PATCH /api/v1/obras/:obraId/indices
  app.patch('/api/v1/obras/:obraId/indices', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA])],
  }, async (request) => {
    const data = indiceSchema.partial().parse(request.body);
    if (!data.tipo || !data.fecha) {
      throw new AppError(400, 'DATOS_INCOMPLETOS', 'Se requiere tipo y fecha para actualizar un índice');
    }

    return prisma.indice.update({
      where: { tipo_fecha: { tipo: data.tipo, fecha: new Date(data.fecha + 'T00:00:00Z') } },
      data: { valor: data.valor },
    });
  });
}

// Re-exportar ResumenRubro para uso en tests
export type { ResumenRubro } from '../services/caja/calculos.js';