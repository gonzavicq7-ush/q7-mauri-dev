import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';

const prisma = new PrismaClient();

const registroSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(2).max(255),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const recuperarSchema = z.object({
  email: z.string().email(),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/registro
  app.post('/registro', async (request, reply) => {
    const data = registroSchema.parse(request.body);

    const existente = await prisma.usuario.findUnique({
      where: { email: data.email },
    });
    if (existente) {
      throw new AppError(409, 'EMAIL_DUPLICADO', 'Ya existe una cuenta con ese email');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const usuario = await prisma.usuario.create({
      data: { email: data.email, nombre: data.nombre, passwordHash },
    });

    const token = app.jwt.sign({ sub: usuario.id, email: usuario.email });

    return reply.status(201).send({
      token,
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
    });
  });

  // POST /api/v1/auth/login
  app.post('/login', async (request, reply) => {
    const data = loginSchema.parse(request.body);

    const usuario = await prisma.usuario.findUnique({
      where: { email: data.email },
    });
    if (!usuario) {
      throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');
    }

    const valido = await bcrypt.compare(data.password, usuario.passwordHash);
    if (!valido) {
      throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');
    }

    const token = app.jwt.sign({ sub: usuario.id, email: usuario.email });

    return { token, usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre } };
  });

  // POST /api/v1/auth/recuperar
  app.post('/recuperar', async (request, reply) => {
    const data = recuperarSchema.parse(request.body);

    const usuario = await prisma.usuario.findUnique({
      where: { email: data.email },
    });

    if (usuario) {
      const token = app.jwt.sign({ sub: usuario.id, email: usuario.email }, { expiresIn: '1h' });
      console.log(`🔑 Recuperación para ${data.email}: http://localhost:3000/restablecer?token=${token}`);
    }
    return reply.status(204).send();
  });

  // GET /api/v1/yo
  app.get('/yo', {
    preHandler: [async (request: any, reply) => {
      try { await request.jwtVerify(); } catch { throw new AppError(401, 'SIN_AUTENTICACION', 'Token inválido o expirado'); }
      request.userId = request.user.sub;
    }],
  }, async (request) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id: (request as any).userId },
      include: {
        membresias: {
          where: { estado: 'ACTIVO', eliminadoEn: null },
          include: { obra: true },
        },
      },
    });
    if (!usuario) {
      throw new AppError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      obras: usuario.membresias.map(m => ({
        id: m.obra.id,
        nombre: m.obra.nombre,
        rol: m.rol,
      })),
    };
  });
}
