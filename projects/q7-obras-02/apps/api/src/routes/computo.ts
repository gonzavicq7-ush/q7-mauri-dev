import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';
import { requiereRol } from '../middleware/auth.js';
import { RolObra, Unidad } from '@q7/shared';
import { EventoService } from './eventos.js';

const prisma = new PrismaClient();

// ── Schemas de validación ──

const crearRubroSchema = z.object({
  codigo: z.string().length(4).optional(),
  nombre: z.string().min(1).max(255).optional(),
}).refine(data => data.codigo || (data.nombre && data.nombre.trim().length > 0), {
  message: 'Se requiere código (catálogo) o nombre (personalizado)',
});

const actualizarRubroSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  orden: z.number().int().positive().optional(),
});

const crearTareaSchema = z.object({
  rubro_obra_id: z.string().uuid(),
  padre_id: z.string().uuid().optional(),
  descripcion: z.string().min(1).max(500),
  nivel: z.number().int().min(1).max(3).default(1),
  unidad: z.nativeEnum(Unidad).default(Unidad.UN),
  cantidad: z.number().positive().optional(),
  orden: z.number().int().positive().optional(),
});

const actualizarTareaSchema = z.object({
  descripcion: z.string().min(1).max(500).optional(),
  unidad: z.nativeEnum(Unidad).optional(),
  cantidad: z.number().positive().nullable().optional(),
  orden: z.number().int().positive().optional(),
});

const reordenarTareasSchema = z.object({
  ids_ordenados: z.array(z.string().uuid()),
});

// ── Helpers ──

/** Genera código personalizado XX00 */
async function generarCodigoPersonalizado(obraId: string): Promise<string> {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const usados = new Set<string>();

  const existentes = await prisma.rubroObra.findMany({
    where: { obraId, origen: 'PERSONALIZADO' },
    select: { codigo: true },
  });
  existentes.forEach(r => usados.add(r.codigo.substring(0, 2)));

  for (const l1 of letras) {
    for (const l2 of letras) {
      const codigo = `${l1}${l2}00`;
      if (!usados.has(codigo)) return codigo;
    }
  }
  // Si se agotan, usar timestamp
  return `${Date.now().toString(36).toUpperCase().padEnd(2, 'X')}00`;
}

/** Genera código de tarea HA01, HA02… */
async function generarCodigoTarea(rubroObraId: string): Promise<string> {
  const prefijo = (await prisma.rubroObra.findUnique({ where: { id: rubroObraId }, select: { codigo: true } }))?.codigo || 'XX';
  const ultimos = await prisma.tarea.findMany({
    where: { rubroObraId, eliminadoEn: null },
    select: { codigo: true },
    orderBy: { orden: 'desc' },
    take: 1,
  });
  const last = ultimos[0]?.codigo;
  const next = last ? parseInt(last.substring(2)) + 1 : 1;
  return `${prefijo}${next.toString().padStart(2, '0')}`;
}

/** Construye árbol de tareas (jerarquía de 3 niveles) */
async function construirArbolTareas(obraId: string, rubroId?: string) {
  const where: any = { obraId, eliminadoEn: null };
  if (rubroId) where.rubroObraId = rubroId;

  const tareas = await prisma.tarea.findMany({
    where,
    include: { _count: { select: { hijos: true, presupuestoItems: true, movimientos: true } } },
    orderBy: [{ rubroObraId: 'asc' }, { orden: 'asc' }],
  });

  // Construir mapa de hijos por padre
  const porPadre = new Map<string | null, typeof tareas>();
  tareas.forEach(t => {
    const key = t.padreId;
    if (!porPadre.has(key)) porPadre.set(key, []);
    porPadre.get(key)!.push(t);
  });

  // Función recursiva para armar árbol
  const armar = (parentId: string | null): any[] => {
    return (porPadre.get(parentId) || []).map(t => ({
      ...t,
      cantidad: t.cantidad?.toString(),
      hijos: armar(t.id),
      enUso: t._count.presupuestoItems > 0 || t._count.movimientos > 0,
    }));
  };

  return armar(null);
}

// ── Rutas ──

export async function computoRoutes(app: FastifyInstance) {

  // GET /api/v1/catalogo/rubros — público autenticado
  app.get('/catalogo/rubros', {
    preHandler: [app.requireAuth],
  }, async () => {
    return prisma.rubroCatalogo.findMany({
      orderBy: { orden: 'asc' },
      select: { codigo: true, nombre: true },
    });
  });

  // GET /api/v1/obras/:obraId/rubros
  app.get('/obras/:obraId/rubros', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const rubros = await prisma.rubroObra.findMany({
      where: { obraId, eliminadoEn: null },
      include: {
        _count: { select: { tareas: true } },
      },
      orderBy: { orden: 'asc' },
    });
    // Calcular totales de cantidad por rubro
    const conTotales = await Promise.all(rubros.map(async r => {
      const tareas = await prisma.tarea.findMany({
        where: { rubroObraId: r.id, eliminadoEn: null, nivel: 3 },
        select: { cantidad: true },
      });
      const totalCantidad = tareas.reduce((sum, t) => sum + (parseFloat(t.cantidad?.toString() || '0') || 0), 0);
      return { ...r, total_cantidad: totalCantidad, tareas_count: r._count.tareas };
    }));
    return conTotales;
  });

  // POST /api/v1/obras/:obraId/rubros
  app.post('/obras/:obraId/rubros', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = crearRubroSchema.parse(request.body);

    let codigo: string;
    let origen: 'CATALOGO' | 'PERSONALIZADO' = 'CATALOGO';

    if (data.codigo) {
      // Copiar del catálogo
      const catalogo = await prisma.rubroCatalogo.findUnique({ where: { codigo: data.codigo } });
      if (!catalogo) throw new AppError(400, 'CATALOGO_NO_ENCONTRADO', `Código ${data.codigo} no existe en el catálogo`);
      codigo = data.codigo;

      // Verificar que no esté ya en esta obra
      const existente = await prisma.rubroObra.findUnique({
        where: { obraId_codigo: { obraId, codigo } },
      });
      if (existente) throw new AppError(409, 'RUBRO_YA_EXISTE', 'Este rubro ya está en la obra');
    } else {
      // Personalizado
      codigo = await generarCodigoPersonalizado(obraId);
      origen = 'PERSONALIZADO';
    }

    // Obtener siguiente orden
    const maxOrden = await prisma.rubroObra.aggregate({
      where: { obraId, eliminadoEn: null },
      _max: { orden: true },
    });

    const rubro = await prisma.rubroObra.create({
      data: {
        obraId,
        codigo,
        nombre: data.nombre || (origen === 'CATALOGO' ? undefined : 'Rubro personalizado'),
        origen,
        orden: (maxOrden._max.orden || 0) + 1,
      },
    });

    return reply.status(201).send(rubro);
  });

  // PATCH /api/v1/obras/:obraId/rubros/:id
  app.patch('/obras/:obraId/rubros/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const data = actualizarRubroSchema.parse(request.body);

    const rubro = await prisma.rubroObra.findFirst({ where: { id, obraId, eliminadoEn: null } });
    if (!rubro) throw new AppError(404, 'RUBRO_NO_ENCONTRADO', 'Rubro no encontrado');

    return prisma.rubroObra.update({
      where: { id },
      data: {
        nombre: data.nombre ?? rubro.nombre,
        orden: data.orden ?? rubro.orden,
      },
    });
  });

  // DELETE /api/v1/obras/:obraId/rubros/:id
  app.delete('/obras/:obraId/rubros/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const rubro = await prisma.rubroObra.findFirst({ where: { id, obraId, eliminadoEn: null } });
    if (!rubro) throw new AppError(404, 'RUBRO_NO_ENCONTRADO', 'Rubro no encontrado');

    // R4: Verificar uso en M2/M3
    const tareas = await prisma.tarea.findMany({
      where: { rubroObraId: id, eliminadoEn: null },
      include: { _count: { select: { presupuestoItems: true, movimientos: true } } },
    });
    const enUso = tareas.filter(t => t._count.presupuestoItems > 0 || t._count.movimientos > 0);

    if (enUso.length > 0) {
      const detalle = enUso.map(t => `Tarea "${t.descripcion}" (${t._count.presupuestoItems} ítems, ${t._count.movimientos} movimientos)`).join('; ');
      throw new AppError(409, 'RUBRO_EN_USO', `No se puede eliminar: ${detalle}`);
    }

    return prisma.rubroObra.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  });

  // GET /api/v1/obras/:obraId/tareas
  app.get('/obras/:obraId/tareas', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { rubroId } = request.query as any;
    return construirArbolTareas(obraId, rubroId);
  });

  // POST /api/v1/obras/:obraId/tareas
  app.post('/obras/:obraId/tareas', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const data = crearTareaSchema.parse(request.body);

    // Verificar rubro existe y pertenece a la obra
    const rubro = await prisma.rubroObra.findFirst({
      where: { id: data.rubro_obra_id, obraId, eliminadoEn: null },
    });
    if (!rubro) throw new AppError(404, 'RUBRO_NO_ENCONTRADO', 'Rubro no encontrado');

    // R1: Validar nivel máximo
    if (data.padre_id) {
      const padre = await prisma.tarea.findFirst({ where: { id: data.padre_id, obraId, eliminadoEn: null } });
      if (!padre) throw new AppError(404, 'TAREA_PADRE_NO_ENCONTRADA', 'Tarea padre no encontrada');
      if (padre.nivel >= 3) throw new AppError(422, 'NIVEL_MAXIMO', 'No se puede crear más de 3 niveles de profundidad');
      const nivelCalculado = padre.nivel + 1;
      if (data.nivel !== nivelCalculado) data.nivel = nivelCalculado;
    } else if (data.nivel !== 1) {
      data.nivel = 1;
    }

    // R2: Si tiene padre y el padre tiene cantidad, limpiarla con aviso
    let advertencia: string | null = null;
    if (data.padre_id) {
      const padre = await prisma.tarea.findFirst({ where: { id: data.padre_id } });
      if (padre?.cantidad) {
        await prisma.tarea.update({
          where: { id: data.padre_id },
          data: { cantidad: null },
        });
        advertencia = 'La tarea padre tenía cantidad, se limpió porque ahora tiene hijos';
      }
    }

    // Generar código único
    const codigo = await generarCodigoTarea(data.rubro_obra_id);

    // Obtener siguiente orden
    const maxOrden = await prisma.tarea.aggregate({
      where: { rubroObraId: data.rubro_obra_id, padreId: data.padre_id || null, eliminadoEn: null },
      _max: { orden: true },
    });

    const tarea = await prisma.tarea.create({
      data: {
        obraId,
        rubroObraId: data.rubro_obra_id,
        padreId: data.padre_id || null,
        codigo,
        descripcion: data.descripcion,
        nivel: data.nivel,
        unidad: data.unidad,
        cantidad: data.cantidad,
        orden: (maxOrden._max.orden || 0) + 1,
        estado: 'PENDIENTE',
      },
    });

    // Emitir evento
    await EventoService.emitir(obraId, request.userId, 'computo.tarea_creada', {
      entidad_id: tarea.id,
      resumen_humano: `Tarea "${tarea.descripcion}" creada`,
      datos: { codigo, rubro: rubro.nombre },
    });

    return reply.status(201).send({ ...tarea, advertencia });
  });

  // PATCH /api/v1/obras/:obraId/tareas/:id
  app.patch('/obras/:obraId/tareas/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const data = actualizarTareaSchema.parse(request.body);

    const tarea = await prisma.tarea.findFirst({ where: { id, obraId, eliminadoEn: null } });
    if (!tarea) throw new AppError(404, 'TAREA_NO_ENCONTRADA', 'Tarea no encontrada');

    // R2: Si tiene hijos, no puede tener cantidad propia
    if (data.cantidad !== undefined && data.cantidad !== null) {
      const hijos = await prisma.tarea.count({ where: { padreId: id, eliminadoEn: null } });
      if (hijos > 0) throw new AppError(422, 'TIENE_HIJOS', 'Una tarea con hijos no puede tener cantidad propia');
    }

    return prisma.tarea.update({
      where: { id },
      data: {
        descripcion: data.descripcion ?? tarea.descripcion,
        unidad: data.unidad ?? tarea.unidad,
        cantidad: data.cantidad !== undefined ? data.cantidad : tarea.cantidad,
        orden: data.orden ?? tarea.orden,
      },
    });
  });

  // DELETE /api/v1/obras/:obraId/tareas/:id
  app.delete('/obras/:obraId/tareas/:id', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const tarea = await prisma.tarea.findFirst({ where: { id, obraId, eliminadoEn: null } });
    if (!tarea) throw new AppError(404, 'TAREA_NO_ENCONTRADA', 'Tarea no encontrada');

    // R4: Verificar uso en M2/M3
    const _count = await prisma.tarea.findUnique({
      where: { id },
      include: { _count: { select: { presupuestoItems: true, movimientos: true } } },
    });

    if (_count && (_count._count.presupuestoItems > 0 || _count._count.movimientos > 0)) {
      const detalle = [];
      if (_count._count.presupuestoItems > 0) detalle.push(`${_count._count.presupuestoItems} ítems de presupuesto`);
      if (_count._count.movimientos > 0) detalle.push(`${_count._count.movimientos} movimientos de caja`);
      throw new AppError(409, 'TAREA_EN_USO', `No se puede eliminar: tiene ${detalle.join(' y ')}`);
    }

    return prisma.tarea.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  });

  // POST /api/v1/obras/:obraId/tareas/reordenar
  app.post('/api/v1/obras/:obraId/tareas/reordenar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const data = reordenarTareasSchema.parse(request.body);

    // Actualizar orden de cada tarea
    await Promise.all(data.ids_ordenados.map((id, index) =>
      prisma.tarea.updateMany({
        where: { id, obraId, eliminadoEn: null },
        data: { orden: index + 1 },
      })
    ));

    return { ok: true };
  });

  // POST /api/v1/obras/:obraId/computo/importar — paso 1: detectar filas
  app.post('/api/v1/obras/:obraId/computo/importar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { filas } = (request.body as any) || {};

    if (!filas || !Array.isArray(filas)) {
      throw new AppError(400, 'FORMATO_INVALIDO', 'Se requiere array "filas"');
    }

    // Obtener rubros existentes de la obra + catálogo
    const rubrosObra = await prisma.rubroObra.findMany({
      where: { obraId, eliminadoEn: null },
      select: { codigo: true, nombre: true },
    });
    const catalogos = await prisma.rubroCatalogo.findMany({ select: { codigo: true, nombre: true } });
    const todosRubros = [...rubrosObra, ...catalogos];

    const filasDetectadas = filas.map((f: any, idx: number) => {
      const codigoRubro = (f.CODIGO_RUBRO || f.codigo_rubro || '').toString().trim().toUpperCase();
      const codigoTarea = (f.CODIGO_TAREA || f.codigo_tarea || '').toString().trim();
      const tarea = (f.TAREA || f.tarea || f.descripcion || '').toString().trim();
      const nivel = parseInt(f.NIVEL || f.nivel || '1');
      const unidad = (f.UNIDAD || f.unidad || 'UN').toString().trim().toUpperCase();
      const cantidadRaw = f.CANTIDAD || f.cantidad || '';
      const cantidad = cantidadRaw ? parseFloat(cantidadRaw) : null;

      const advertencia: string[] = [];
      let rubroSugerido = todosRubros.find(r => r.codigo === codigoRubro);

      if (!rubroSugerido && codigoRubro) {
        // Buscar por similaridad (distancia de Levenshtein simple)
        const similar = todosRubros.find(r =>
          r.codigo.startsWith(codigoRubro.substring(0, 2)) ||
          r.nombre.toUpperCase().includes(codigoRubro.substring(0, 2))
        );
        if (similar) {
          advertencia.push(`Código rubro "${codigoRubro}" no existe, ¿quisiste decir "${similar.codigo}"?`);
          rubroSugerido = similar;
        } else {
          advertencia.push(`Código rubro "${codigoRubro}" no reconocido, se creará como personalizado`);
        }
      }

      if (!['GL', 'M2', 'M3', 'ML', 'UN', 'KG', 'HS', 'DIA'].includes(unidad)) {
        advertencia.push(`Unidad "${unidad}" no válida, se usará UN`);
      }

      if (cantidadRaw && isNaN(cantidad!)) {
        advertencia.push(`Cantidad "${cantidadRaw}" no es numérica`);
      }

      return {
        idx,
        codigo_rubro: codigoRubro,
        rubro_encontrado: rubroSugerido,
        codigo_tarea: codigoTarea,
        tarea,
        nivel: isNaN(nivel) ? 1 : nivel,
        unidad,
        cantidad,
        advertencia,
      };
    });

    return { filas_detectadas: filasDetectadas };
  });

  // POST /api/v1/obras/:obraId/computo/importar/confirmar — paso 2: persistir
  app.post('/api/v1/obras/:obraId/computo/importar/confirmar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { filas_mapeadas } = (request.body as any) || {};

    if (!filas_mapeadas || !Array.isArray(filas_mapeadas)) {
      throw new AppError(400, 'FORMATO_INVALIDO', 'Se requiere array "filas_mapeadas"');
    }

    const creados: { rubro: number; tarea: number } = { rubro: 0, tarea: 0 };
    const advertencias: string[] = [];

    for (const fila of filas_mapeadas) {
      const codigoRubro = (fila.codigo_rubro || '').toString().trim().toUpperCase();
      const codigoTarea = (fila.codigo_tarea || '').toString().trim();
      const descripcion = (fila.tarea || fila.descripcion || '').toString().trim();
      const nivel = parseInt(fila.nivel || '1');
      const unidad = (fila.unidad || 'UN').toString().trim().toUpperCase();
      const cantidad = fila.cantidad ? parseFloat(fila.cantidad) : undefined;
      const esPersonalizado = fila.es_personalizado || false;

      // Buscar o crear rubro
      let rubro = await prisma.rubroObra.findUnique({
        where: { obraId_codigo: { obraId, codigo: codigoRubro } },
      });

      if (!rubro) {
        if (esPersonalizado) {
          const nuevoCodigo = await generarCodigoPersonalizado(obraId);
          const maxOrden = await prisma.rubroObra.aggregate({
            where: { obraId, eliminadoEn: null },
            _max: { orden: true },
          });
          rubro = await prisma.rubroObra.create({
            data: {
              obraId,
              codigo: nuevoCodigo,
              nombre: descripcion.split(' ')[0] || 'Rubro importado',
              origen: 'PERSONALIZADO',
              orden: (maxOrden._max.orden || 0) + 1,
            },
          });
          creados.rubro++;
        } else {
          // Intentar crear desde catálogo
          const catalogo = await prisma.rubroCatalogo.findUnique({ where: { codigo: codigoRubro } });
          if (catalogo) {
            const maxOrden = await prisma.rubroObra.aggregate({
              where: { obraId, eliminadoEn: null },
              _max: { orden: true },
            });
            rubro = await prisma.rubroObra.create({
              data: {
                obraId,
                codigo: catalogo.codigo,
                nombre: catalogo.nombre,
                origen: 'CATALOGO',
                orden: (maxOrden._max.orden || 0) + 1,
              },
            });
            creados.rubro++;
          }
        }
      }

      if (!rubro) {
        advertencias.push(`Fila ${fila.idx}: no se pudo crear rubro ${codigoRubro}`);
        continue;
      }

      // Buscar padre si nivel > 1
      let padreId: string | null = null;
      if (nivel > 1 && fila.codigo_tarea_padre) {
        const padre = await prisma.tarea.findFirst({
          where: { obraId, codigo: fila.codigo_tarea_padre, eliminadoEn: null },
        });
        padreId = padre?.id || null;
      }

      // R5: Si la tarea ya existe, actualizar en vez de duplicar
      if (codigoTarea) {
        const existente = await prisma.tarea.findFirst({
          where: { obraId, codigo: codigoTarea, eliminadoEn: null },
        });
        if (existente) {
          await prisma.tarea.update({
            where: { id: existente.id },
            data: { descripcion, cantidad, unidad },
          });
          advertencias.push(`Fila ${fila.idx}: tarea ${codigoTarea} actualizada (ya existía)`);
          continue;
        }
      }

      // Crear tarea
      const nuevoCodigo = codigoTarea || await generarCodigoTarea(rubro.id);
      const maxOrdenT = await prisma.tarea.aggregate({
        where: { rubroObraId: rubro.id, padreId: padreId || undefined, eliminadoEn: null },
        _max: { orden: true },
      });

      await prisma.tarea.create({
        data: {
          obraId,
          rubroObraId: rubro.id,
          padreId,
          codigo: nuevoCodigo,
          descripcion,
          nivel,
          unidad: (['GL', 'M2', 'M3', 'ML', 'UN', 'KG', 'HS', 'DIA'].includes(unidad) ? unidad : 'UN') as any,
          cantidad,
          orden: (maxOrdenT._max.orden || 0) + 1,
          estado: 'PENDIENTE',
        },
      });
      creados.tarea++;
    }

    // Emitir evento de importación
    await EventoService.emitir(obraId, request.userId, 'computo.importado', {
      entidad_id: obraId,
      resumen_humano: `Importación de cómputo: ${creados.rubro} rubros y ${creados.tarea} tareas`,
      datos: { rubros: creados.rubro, tareas: creados.tarea },
    });

    return { creados, advertencias };
  });

  // GET /api/v1/obras/:obraId/computo/exportar — exportar xlsx (placeholder, devuelve estructura)
  app.get('/api/v1/obras/:obraId/computo/exportar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;

    const tareas = await prisma.tarea.findMany({
      where: { obraId, eliminadoEn: null },
      include: { rubroObra: { select: { codigo: true, nombre: true } } },
      orderBy: [{ rubroObra: { orden: 'asc' } }, { orden: 'asc' }],
    });

    // Generar CSV/Excel simple (las columnas exactas del spec)
    const headers = ['CODIGO_RUBRO', 'RUBRO', 'CODIGO_TAREA', 'TAREA', 'NIVEL', 'UNIDAD', 'CANTIDAD'];
    const filas = tareas.map(t => [
      t.rubroObra.codigo,
      t.rubroObra.nombre,
      t.codigo,
      t.descripcion,
      t.nivel.toString(),
      t.unidad,
      t.cantidad?.toString() || '',
    ]);

    return { headers, filas, total: tareas.length };
  });

  // POST /api/v1/obras/:obraId/computo/duplicar-desde
  app.post('/api/v1/obras/:obraId/computo/duplicar-desde', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const { obra_origen_id } = (request.body as any) || {};

    if (!obra_origen_id) throw new AppError(400, 'OBRA_ORIGEN_REQUERIDA', 'Se requiere obra_origen_id');

    // R6: Verificar que el usuario sea miembro activo de ambas obras
    const [miembroOrigen, miembroDestino] = await Promise.all([
      prisma.obraMiembro.findFirst({
        where: { obraId: obra_origen_id, usuarioId: request.userId, estado: 'ACTIVO', eliminadoEn: null },
      }),
      prisma.obraMiembro.findFirst({
        where: { obraId, usuarioId: request.userId, estado: 'ACTIVO', eliminadoEn: null },
      }),
    ]);

    if (!miembroOrigen) throw new AppError(403, 'SIN_ACCESO_OBRA_ORIGEN', 'No tenés acceso a la obra origen');
    if (!miembroDestino) throw new AppError(403, 'SIN_ACCESO_OBRA_DESTINO', 'No tenés acceso a esta obra');

    // Obtener rubros y tareas de origen
    const rubrosOrigen = await prisma.rubroObra.findMany({
      where: { obraId: obra_origen_id, eliminadoEn: null },
      include: {
        tareas: {
          where: { eliminadoEn: null },
          orderBy: { orden: 'asc' },
        },
      },
    });

    // Mapeo de rubros old->new
    const mapeoRubros = new Map<string, string>();
    const mapeoTareas = new Map<string, string>();

    for (const rubro of rubrosOrigen) {
      const maxOrdenR = await prisma.rubroObra.aggregate({
        where: { obraId, eliminadoEn: null },
        _max: { orden: true },
      });

      const nuevoRubro = await prisma.rubroObra.create({
        data: {
          obraId,
          codigo: await generarCodigoPersonalizado(obraId),
          nombre: rubro.nombre,
          origen: 'PERSONALIZADO',
          orden: (maxOrdenR._max.orden || 0) + 1,
        },
      });
      mapeoRubros.set(rubro.id, nuevoRubro.id);

      // Copiar tareas recursivamente
      const copiarTareas = async (tareas: any[], rubroObraId: string, padreId: string | null = null) => {
        for (const t of tareas) {
          const maxOrdenT = await prisma.tarea.aggregate({
            where: { rubroObraId, padreId: padreId || undefined, eliminadoEn: null },
            _max: { orden: true },
          });
          const nuevaTarea = await prisma.tarea.create({
            data: {
              obraId,
              rubroObraId,
              padreId,
              codigo: await generarCodigoTarea(rubroObraId),
              descripcion: t.descripcion,
              nivel: t.nivel,
              unidad: t.unidad,
              cantidad: t.cantidad,
              orden: (maxOrdenT._max.orden || 0) + 1,
              estado: 'PENDIENTE',
            },
          });
          mapeoTareas.set(t.id, nuevaTarea.id);
          // Copiar hijos (nivel 2 y 3)
          if (t.hijos?.length) {
            await copiarTareas(t.hijos, rubroObraId, nuevaTarea.id);
          }
        }
      };

      await copiarTareas(rubro.tareas, nuevoRubro.id, null);
    }

    return reply.status(201).send({
      rubros_creados: mapeoRubros.size,
      tareas_creadas: mapeoTareas.size,
    });
  });
}