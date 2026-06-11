import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requiereRol } from '../middleware/auth.js';
import { RolObra } from '@q7/shared';

const prisma = new PrismaClient();

export async function eventosRoutes(app: FastifyInstance) {
  // GET /api/v1/obras/:obraId/eventos
  app.get('/obras/:obraId/eventos', {
    preHandler: [requiereRol([
      RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR,
    ])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { desde, tipo, pagina = '1', porPagina = '25' } = request.query as any;

    const where: any = { obraId };
    if (tipo) where.tipo = tipo;
    if (desde) where.fecha = { gte: new Date(desde) };

    const page = parseInt(pagina);
    const limit = parseInt(porPagina);
    const skip = (page - 1) * limit;

    const [eventos, total] = await Promise.all([
      prisma.evento.findMany({
        where,
        include: { usuario: { select: { id: true, nombre: true, avatarUrl: true } } },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      prisma.evento.count({ where }),
    ]);

    return { datos: eventos, total, pagina: page };
  });
}

// Servicio de eventos para otros módulos
export class EventoService {
  static async emitir(obraId: string, usuarioId: string | null, tipo: string, data: { entidad_id: string; resumen_humano: string; datos?: any }) {
    return prisma.evento.create({
      data: {
        obraId,
        usuarioId,
        tipo,
        payload: {
          entidad_id: data.entidad_id,
          resumen_humano: data.resumen_humano,
          datos: data.datos || {},
        },
      },
    });
  }
}
