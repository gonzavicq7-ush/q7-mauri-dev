import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { authRoutes } from './routes/auth.js';
import { obrasRoutes } from './routes/obras.js';
import { miembrosRoutes } from './routes/miembros.js';
import { eventosRoutes } from './routes/eventos.js';
import { errorHandler, AppError } from './middleware/error.js';

const app = fastify({ logger: true });

// Plugins
await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'q7-obras-02-dev-secret-change-in-prod' });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

// Decorator: requireAuth
app.decorate('requireAuth', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(401, 'SIN_AUTENTICACION', 'Token inválido o expirado');
  }
  request.userId = request.user.sub;
});

// Error handler
app.setErrorHandler(errorHandler);

// Routes
await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(obrasRoutes, { prefix: '/api/v1' });
await app.register(miembrosRoutes, { prefix: '/api/v1' });
await app.register(eventosRoutes, { prefix: '/api/v1' });

// Health check
app.get('/api/v1/health', async () => ({ status: 'ok' }));

try {
  const port = parseInt(process.env.PORT || '3001');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`✅ API q7-obras-02 corriendo en http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export default app;
