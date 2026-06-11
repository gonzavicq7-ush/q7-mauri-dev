import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  const statusCode = error.statusCode || 500;
  const code = (error as any).code || 'ERROR_INTERNO';

  if (statusCode === 429) {
    return reply.status(429).send({
      error: { codigo: 'LIMITE_EXCEDIDO', mensaje: 'Demasiadas solicitudes. Esperá un momento.' },
    });
  }

  // Errores esperados del negocio
  if (statusCode >= 400 && statusCode < 500 && code !== 'ERROR_INTERNO') {
    return reply.status(statusCode).send({
      error: { codigo: code, mensaje: error.message },
    });
  }

  // Errores inesperados
  request.log.error(error);
  return reply.status(500).send({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' },
  });
}

// Extender Fastify para usar códigos de error de negocio
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, mensaje: string) {
    super(mensaje);
    this.statusCode = statusCode;
    this.code = code;
  }
}
