import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';
import { requiereRol } from '../middleware/auth.js';
import { RolObra } from '@q7/shared';

const prisma = new PrismaClient();

const crearObraSchema = z.object({
  nombre: z.string().min(2).max(255),
  tipo: z.enum(['VIVIENDA', 'REFORMA', 'COMERCIO', 'CONDOMINIO', 'OTRO']).default('OTRO'),
  pais: z.string().length(2).default('AR'),
  moneda_base: z.string().length(3).default('ARS'),
  superficie_m2: z.number().positive().optional(),
  presupuesto_objetivo: z.number().positive().optional(),
});

const actualizarObraSchema = z.object({
  nombre: z.string().min(2).max(255).optional(),
  direccion: z.string().max(500).optional(),
  superficie_m2: z.number().positive().optional(),
  estado: z.enum(['ACTIVA', 'PAUSADA', 'FINALIZADA']).optional(),
});

export async function obrasRoutes(app: FastifyInstance) {
  // GET /api/v1/obras — listar mis obras
  app.get('/obras', {
    preHandler: [app.requireAuth],
  }, async (request) => {
    const membresias = await prisma.obraMiembro.findMany({
      where: { usuarioId: request.userId, estado: 'ACTIVO', eliminadoEn: null },
      include: { obra: true },
      orderBy: { obra: { creadoEn: 'desc' } },
    });

    return membresias.map(m => ({
      id: m.obra.id,
      nombre: m.obra.nombre,
      tipo: m.obra.tipo,
      estado: m.obra.estado,
      moneda_base: m.obra.monedaBase,
      rol_propio: m.rol,
    }));
  });

  // POST /api/v1/obras
  app.post('/obras', {
    preHandler: [app.requireAuth],
  }, async (request, reply) => {
    const data = crearObraSchema.parse(request.body);

    const obra = await prisma.obra.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        pais: data.pais,
        monedaBase: data.moneda_base,
        superficieM2: data.superficie_m2,
        presupuestoObjetivo: data.presupuesto_objetivo,
        creadorId: request.userId,
      },
    });

    // Crear membresía ADMIN_OBRA automática
    const crypto = await import('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    await prisma.obraMiembro.create({
      data: {
        obraId: obra.id,
        usuarioId: request.userId,
        rol: 'ADMIN_OBRA',
        estado: 'ACTIVO',
        tokenInvitacion: token,
      },
    });

    // Evento
    await prisma.evento.create({
      data: {
        obraId: obra.id,
        usuarioId: request.userId,
        tipo: 'obra.creada',
        payload: { entidad_id: obra.id, resumen_humano: `${request.userId} creó la obra ${obra.nombre}` },
      },
    });

    return reply.status(201).send(obra);
  });

  // GET /api/v1/obras/:obraId
  app.get('/obras/:obraId', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const obra = await prisma.obra.findFirst({
      where: { id: obraId, eliminadoEn: null },
    });
    if (!obra) throw new AppError(404, 'OBRA_NO_ENCONTRADA', 'Obra no encontrada');
    return obra;
  });

  // PATCH /api/v1/obras/:obraId
  app.patch('/obras/:obraId', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const data = actualizarObraSchema.parse(request.body);

    // PROFESIONAL no puede modificar datos económicos
    const membresia = await prisma.obraMiembro.findFirst({
      where: { obraId, usuarioId: request.userId, estado: 'ACTIVO' },
    });
    if (membresia?.rol !== 'ADMIN_OBRA') {
      // Solo ADMIN cambia datos económicos, PROFESIONAL solo nombre/dirección/estado
      const { nombre, direccion, superficie_m2, estado } = data;
      return prisma.obra.update({
        where: { id: obraId },
        data: { nombre, direccion, superficieM2: superficie_m2, estado },
      });
    }

    return prisma.obra.update({
      where: { id: obraId },
      data: {
        nombre: data.nombre,
        direccion: data.direccion,
        superficieM2: data.superficie_m2,
        estado: data.estado,
      },
    });
  });
}
