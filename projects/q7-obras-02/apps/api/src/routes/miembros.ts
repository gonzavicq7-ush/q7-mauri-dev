import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';
import { requiereRol } from '../middleware/auth.js';
import { RolObra } from '@q7/shared';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const invitarSchema = z.object({
  email: z.string().email(),
  rol: z.enum(['COMITENTE', 'PROFESIONAL', 'CONSTRUCTOR', 'PROVEEDOR']),
});

export async function miembrosRoutes(app: FastifyInstance) {
  // GET /api/v1/obras/:obraId/miembros
  app.get('/obras/:obraId/miembros', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    return prisma.obraMiembro.findMany({
      where: { obraId, eliminadoEn: null },
      include: { usuario: { select: { id: true, email: true, nombre: true, avatarUrl: true } } },
      orderBy: { creadoEn: 'desc' },
    });
  });

  // POST /api/v1/obras/:obraId/miembros
  app.post('/obras/:obraId/miembros', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = invitarSchema.parse(request.body);

    // Verificar si ya existe membresía activa con ese email y rol
    const existente = await prisma.obraMiembro.findFirst({
      where: { obraId, emailInvitado: data.email, rol: data.rol, eliminadoEn: null },
    });
    if (existente?.estado === 'ACTIVO') {
      throw new AppError(409, 'MIEMBRO_DUPLICADO', 'Esa persona ya es miembro con ese rol');
    }

    // Si ya existía PENDIENTE o REVOCADO, lo revocamos y creamos nuevo
    if (existente) {
      await prisma.obraMiembro.update({
        where: { id: existente.id },
        data: { estado: 'REVOCADO', eliminadoEn: new Date() },
      });
    }

    // Buscar usuario existente por email
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: data.email },
    });

    const token = crypto.randomBytes(16).toString('hex');

    const miembro = await prisma.obraMiembro.create({
      data: {
        obraId,
        usuarioId: usuarioExistente?.id,
        emailInvitado: data.email,
        rol: data.rol,
        estado: 'PENDIENTE',
        tokenInvitacion: token,
      },
    });

    // Evento
    await prisma.evento.create({
      data: {
        obraId,
        usuarioId: request.userId,
        tipo: 'miembro.invitado',
        payload: {
          entidad_id: miembro.id,
          resumen_humano: `${data.email} fue invitado como ${data.rol}`,
        },
      },
    });

    // En dev: loguear el link de invitación
    console.log(`📩 Invitación para ${data.email}: http://localhost:3000/invitacion/${token}`);

    return reply.status(201).send(miembro);
  });

  // POST /api/v1/invitaciones/:token/aceptar
  app.post('/invitaciones/:token/aceptar', {
    preHandler: [app.requireAuth],
  }, async (request, reply) => {
    const { token } = request.params as any;

    const invitacion = await prisma.obraMiembro.findUnique({
      where: { tokenInvitacion: token },
    });
    if (!invitacion) {
      throw new AppError(404, 'INVITACION_NO_ENCONTRADA', 'Invitación no encontrada');
    }

    if (invitacion.estado !== 'PENDIENTE') {
      throw new AppError(409, 'INVITACION_YA_PROCESADA', 'Esta invitación ya fue aceptada o revocada');
    }

    // Verificar expiración (14 días)
    const diasDesdeCreacion = (Date.now() - invitacion.creadoEn.getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeCreacion > 14) {
      throw new AppError(410, 'INVITACION_EXPIRADA', 'La invitación expiró. Pedile al admin que te reinvite.');
    }

    await prisma.obraMiembro.update({
      where: { id: invitacion.id },
      data: {
        usuarioId: request.userId,
        estado: 'ACTIVO',
      },
    });

    await prisma.evento.create({
      data: {
        obraId: invitacion.obraId,
        usuarioId: request.userId,
        tipo: 'miembro.activado',
        payload: {
          entidad_id: invitacion.id,
          resumen_humano: `${request.userId} aceptó la invitación como ${invitacion.rol}`,
        },
      },
    });

    return reply.status(200).send({ mensaje: 'Invitación aceptada' });
  });

  // DELETE /api/v1/obras/:obraId/miembros/:id
  app.delete('/obras/:obraId/miembros/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const { id } = request.params as any;

    // No permitir revocar al último admin
    const admins = await prisma.obraMiembro.findMany({
      where: { obraId, rol: 'ADMIN_OBRA', estado: 'ACTIVO', eliminadoEn: null },
    });
    if (admins.length === 1 && admins[0].id === id) {
      throw new AppError(422, 'ULTIMO_ADMIN', 'No se puede revocar al último administrador de la obra');
    }

    await prisma.obraMiembro.update({
      where: { id },
      data: { estado: 'REVOCADO', eliminadoEn: new Date() },
    });

    return reply.status(204).send();
  });
}
