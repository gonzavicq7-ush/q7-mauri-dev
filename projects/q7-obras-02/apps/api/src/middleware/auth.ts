import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './error.js';
import { PrismaClient } from '@prisma/client';
import { RolObra } from '@q7/shared';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
  }
}

const prisma = new PrismaClient();

/** Middleware que verifica JWT y agrega userId al request */
export async function requiereAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(401, 'SIN_AUTENTICACION', 'Token inválido o expirado');
  }
  request.userId = request.user.sub;
}

/** Middleware que verifica que el usuario tenga uno de los roles especificados en la obra */
export function requiereRol(roles: RolObra[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requiereAuth(request, reply);

    const obraId = (request.params as any).obraId;
    if (!obraId) {
      throw new AppError(400, 'OBRA_REQUERIDA', 'Se requiere el ID de obra');
    }

    const membresia = await prisma.obraMiembro.findFirst({
      where: {
        obraId,
        usuarioId: request.userId,
        estado: 'ACTIVO',
        rol: { in: roles },
        eliminadoEn: null,
      },
    });

    if (!membresia) {
      throw new AppError(403, 'OBRA_SIN_PERMISO', 'No tenés permiso para esta operación en esta obra');
    }
  };
}
