/**
 * M6 — Tablero y Reporte Semanal
 * Endpoints:
 *   GET  /api/v1/obras/:obraId/tablero
 *   POST /api/v1/obras/:obraId/reportes/generar
 *   GET  /api/v1/obras/:obraId/reportes
 *   GET  /api/v1/obras/:obraId/reportes/:id
 *   POST /api/v1/obras/:obraId/reportes/:id/enviar
 *   GET/PATCH /api/v1/yo/preferencias-notificacion
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.js';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { RolObra } from '@q7/shared';
import { EventoService } from './eventos.js';
import { generarReporteSemanal } from '../services/tablero/reporte.js';

const prisma = new PrismaClient();

// ── Schemas ────────────────────────────────────────────────────────────────────

const preferenciasSchema = z.object({
  reporte_semanal: z.boolean().optional(),
});

// ── Helper: obtener membresía ─────────────────────────────────────────────────
async function obtenerMembresia(obraId: string, usuarioId: string) {
  return prisma.obraMiembro.findFirst({
    where: { obraId, usuarioId, estado: 'ACTIVO', eliminadoEn: null },
  });
}

// ── Helper: fecha relativa en español ─────────────────────────────────────────
function fechaRelativa(fecha: Date): string {
  const ahora = new Date();
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias === 0) return 'hoy';
  if (diffDias === 1) return 'ayer';
  if (diffDias > 1 && diffDias <= 7) return `hace ${diffDias} días`;

  const d = fecha.getDate().toString().padStart(2, '0');
  const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
  return `${d}/${m}`;
}

// ── Rutas ─────────────────────────────────────────────────────────────────────
export async function tableroRoutes(app: FastifyInstance) {

  // GET /api/v1/obras/:obraId/tablero
  // R1: consume endpoints de resumen de cada módulo. No calcula nada.
  // Recorte por rol server-side: CONSTRUCTOR ve solo lo suyo.
  app.get('/obras/:obraId/tablero', {
    preHandler: [requiereRol([
      RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR,
    ])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const miembro = await obtenerMembresia(obraId, request.userId);

    // PROVEEDOR → redirigido (403)
    if (miembro?.rol === RolObra.PROVEEDOR) {
      throw new AppError(403, 'PROVEEDOR_REDIRIGIDO', 'Acceso al tablero no disponible para proveedores. Usá Presupuestos.');
    }

    const obra = await prisma.obra.findUnique({
      where: { id: obraId },
      select: { id: true, nombre: true, monedaBase: true, presupuestoObjetivo: true },
    });

    if (!obra) throw new AppError(404, 'OBRA_NO_ENCONTRADA', 'Obra no encontrada');

    // ── 1. CIFRAS MAESTRAS (consume M3: caja/resumen) ───────────────────────
    let cifrasMaestras: any = {
      previsto: 0,
      comprometido: 0,
      pagado: 0,
      proyeccion: 0,
      semaforo: 'verde' as const,
      _error: 'No disponible',
    };
    try {
      // Llamada interna al endpoint de caja (evitar circular, leer directo)
      const resumenCaja = await resumenGlobal(obraId, miembro?.rol === RolObra.CONSTRUCTOR ? miembro.id : undefined);
      const deltaVsObjetivo = obra.presupuestoObjetivo
        ? resumenCaja.proyeccion - parseFloat(obra.presupuestoObjetivo.toString())
        : null;
      cifrasMaestras = {
        previsto: resumenCaja.previsto,
        comprometido: resumenCaja.comprometido,
        pagado: resumenCaja.pagado,
        proyeccion: resumenCaja.proyeccion,
        semaforo: resumenCaja.semaforo,
        delta_vs_objetivo: deltaVsObjetivo,
      };
    } catch {
      // Degrada silenciosamente
    }

    // ── 2. NECESITA ACCIÓN ──────────────────────────────────────────────────
    const necesitaAccion: any[] = [];

    // OCs pendientes de aprobar (quien puede aprobar)
    if (miembro?.rol === RolObra.ADMIN_OBRA || miembro?.rol === RolObra.COMITENTE) {
      const ocsPendientes = await prisma.ordenCambio.findMany({
        where: { obraId, estado: 'PENDIENTE', eliminadoEn: null },
        orderBy: { creadoEn: 'asc' },
        take: 5,
      });
      for (const oc of ocsPendientes) {
        necesitaAccion.push({
          tipo: 'OC_PENDIENTE',
          titulo: `OC #${oc.numero} esperando aprobación`,
          descripcion: oc.titulo,
          link: `/obras/${obraId}/cambios/${oc.id}`,
          urgencia: 'alta',
        });
      }
    }

    // Invitaciones pendientes del usuario
    const invitacionesPendientes = await prisma.obraMiembro.findMany({
      where: { obraId, usuarioId: request.userId, estado: 'PENDIENTE', eliminadoEn: null },
    });
    for (const inv of invitacionesPendientes) {
      necesitaAccion.push({
        tipo: 'INVITACION_PENDIENTE',
        titulo: 'Tenés una invitación pendiente',
        descripcion: `Rol: ${inv.rol}`,
        link: `/invitacion/${inv.tokenInvitacion}`,
        urgencia: 'media',
      });
    }

    // Propuestas sin comparar hace >7 días
    const propuestasViejas = await prisma.presupuesto.findMany({
      where: {
        obraId,
        tipo: 'PROPUESTA',
        estado: 'VIGENTE',
        eliminadoEn: null,
      },
      include: { contratistaMiembro: { include: { usuario: { select: { nombre: true } } } } },
    });
    const sieteDiasAtras = new Date();
    sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);
    for (const p of propuestasViejas) {
      if (p.actualizadoEn && p.actualizadoEn < sieteDiasAtras) {
        necesitaAccion.push({
          tipo: 'PROPUESTA_SIN_COMPARAR',
          titulo: `Propuesta "${p.nombre}" sin comparar`,
          descripcion: `${p.contratistaMiembro?.usuario?.nombre || p.proveedorNombre || 'Sin nombre'} · ${Math.floor((Date.now() - p.actualizadoEn.getTime()) / (1000 * 60 * 60 * 24))} días`,
          link: `/obras/${obraId}/presupuestos`,
          urgencia: 'baja',
        });
      }
    }

    // Cotizaciones con fecha_precio >60 días
    const cotizacionesViejas = await prisma.presupuesto.findMany({
      where: {
        obraId,
        tipo: 'PROPUESTA',
        estado: 'VIGENTE',
        eliminadoEn: null,
      },
    });
    const sesentaDiasAtras = new Date();
    sesentaDiasAtras.setDate(sesentaDiasAtras.getDate() - 60);
    for (const c of cotizacionesViejas) {
      if (c.fechaPrecio < sesentaDiasAtras) {
        necesitaAccion.push({
          tipo: 'COTIZACION_VENCIDA',
          titulo: `Cotización "${c.nombre}" con más de 60 días`,
          descripcion: `Fecha: ${c.fechaPrecio.toISOString().split('T')[0]}`,
          link: `/obras/${obraId}/presupuestos`,
          urgencia: 'media',
        });
      }
    }

    // Limitar a 5
    const accionesTop = necesitaAccion.slice(0, 5);

    // ── 3. AVANCE (consume M5: plazos) ──────────────────────────────────────
    let avance: any = {
      pct_global: 0,
      fin_previsto: null,
      fin_proyectado: null,
      dias_demora: 0,
      curva_mini: [],
      _error: 'No disponible',
    };
    try {
      const resumenPlazos = await resumenPlazosObra(obraId, miembro?.rol === RolObra.CONSTRUCTOR ? miembro.id : undefined);
      avance = {
        pct_global: resumenPlazos.avance_global,
        fin_previsto: resumenPlazos.fin_previsto,
        fin_proyectado: resumenPlazos.fin_proyectado,
        dias_demora: resumenPlazos.demora_dias,
        curva_mini: resumenPlazos.curva,
      };
    } catch {
      // Degrada silenciosamente
    }

    // ── 4. DESVÍOS (consume M3: caja/resumen por rubro) ─────────────────────
    let desvios: any[] = [];
    try {
      const resumenCaja = await resumenGlobal(obraId, miembro?.rol === RolObra.CONSTRUCTOR ? miembro.id : undefined);
      desvios = resumenCaja.porRubro
        .map((r: any) => ({
          rubro: `${r.rubroCodigo} ${r.rubroNombre}`,
          rubroId: r.rubroId,
          previsto: r.previsto,
          ejecutado: r.ejecutado,
          desvio_pct: r.desvioPct,
          semaforo: r.semaforo,
        }))
        .sort((a: any, b: any) => Math.abs(b.desvio_pct || 0) - Math.abs(a.desvio_pct || 0))
        .slice(0, 5);
    } catch {
      // Degrada silenciosamente
    }

    // ── 5. ACTIVIDAD RECIENTE (consume tabla evento) ───────────────────────
    const miembros = await prisma.obraMiembro.findMany({
      where: { obraId, estado: 'ACTIVO', eliminadoEn: null },
      include: { usuario: { select: { id: true, nombre: true, avatarUrl: true } } },
    });

    // Para CONSTRUCTOR: solo eventos donde el usuario participó o que son de su contratista
    let whereEventos: any = { obraId };
    if (miembro?.rol === RolObra.CONSTRUCTOR) {
      const miembrosIds = miembros
        .filter(m => m.id === miembro.id)
        .map(m => m.id);
      whereEventos = {
        ...whereEventos,
        OR: [
          { usuarioId: request.userId },
          { tipo: { in: ['caja.pago_registrado', 'plazos.avance_registrado', 'plazos.tarea_finalizada'] } },
        ],
      };
    }

    const eventosRaw = await prisma.evento.findMany({
      where: whereEventos,
      include: { usuario: { select: { id: true, nombre: true, avatarUrl: true } } },
      orderBy: { fecha: 'desc' },
      take: 15,
    });

    const actividad = eventosRaw.map(e => ({
      id: e.id,
      tipo: e.tipo,
      resumen_humano: (e.payload as any)?.resumen_humano || e.tipo,
      fecha: e.fecha.toISOString(),
      fecha_relativa: fechaRelativa(e.fecha),
      avatar: e.usuario?.avatarUrl || null,
      usuario_nombre: e.usuario?.nombre || 'Sistema',
      foto_url: (e.payload as any)?.datos?.foto_url || null,
    }));

    return {
      obra: { id: obra.id, nombre: obra.nombre, moneda: obra.monedaBase },
      rol: miembro?.rol,
      cifras_maestras: cifrasMaestras,
      necesita_accion: accionesTop,
      avance,
      desvios,
      actividad,
    };
  });

  // POST /api/v1/obras/:obraId/reportes/generar
  app.post('/obras/:obraId/reportes/generar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId } = request.params as any;
    const miembro = await obtenerMembresia(obraId, request.userId);

    // Obtener semana en curso (lunes a hoy)
    const ahora = new Date();
    const lunes = new Date(ahora);
    const diaSemana = ahora.getDay();
    const diffLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    lunes.setDate(ahora.getDate() - diffLunes);
    lunes.setHours(0, 0, 0, 0);

    const semanaInicio = lunes.toISOString().split('T')[0];

    // R2: idempotente por (obra, semana_inicio)
    const existente = await prisma.reporteSemanal.findFirst({
      where: { obraId, semanaInicio: new Date(semanaInicio + 'T00:00:00Z') },
    });

    let reporte;
    if (existente) {
      // Regenerar: conserva historial de regeneraciones
      const regeneraciones = (existente.contenido as any)?._regeneraciones || [];
      regeneraciones.push({
        generado_en: existente.generadoEn.toISOString(),
        por: request.userId,
      });

      reporte = await generarReporteSemanal(obraId, semanaInicio, request.userId, miembro?.rol || RolObra.COMITENTE);

      // Agregar historial al contenido
      reporte.contenido._regeneraciones = regeneraciones;

      await prisma.reporteSemanal.update({
        where: { id: existente.id },
        data: {
          contenido: reporte.contenido as any,
          generadoEn: new Date(),
        },
      });
      reporte.id = existente.id;
    } else {
      reporte = await generarReporteSemanal(obraId, semanaInicio, request.userId, miembro?.rol || RolObra.COMITENTE);

      reporte = await prisma.reporteSemanal.create({
        data: {
          obraId,
          semanaInicio: new Date(semanaInicio + 'T00:00:00Z'),
          generadoEn: new Date(),
          contenido: reporte.contenido as any,
          enviado: false,
        },
      });
    }

    // Emitir evento reporte.generado
    await EventoService.emitir(obraId, request.userId, 'reporte.generado', {
      entidad_id: reporte.id,
      resumen_humano: `Reporte semanal generado para semana del ${semanaInicio}`,
      datos: { semana_inicio: semanaInicio },
    });

    return reply.status(201).send(reporte);
  });

  // GET /api/v1/obras/:obraId/reportes
  app.get('/obras/:obraId/reportes', {
    preHandler: [requiereRol([
      RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR,
    ])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const { pagina = '1', porPagina = '10' } = request.query as any;

    const page = parseInt(pagina as string);
    const limit = parseInt(porPagina as string);
    const skip = (page - 1) * limit;

    const [reportes, total] = await Promise.all([
      prisma.reporteSemanal.findMany({
        where: { obraId },
        select: {
          id: true,
          semanaInicio: true,
          generadoEn: true,
          enviado: true,
          contenido: true,
        },
        orderBy: { semanaInicio: 'desc' },
        skip,
        take: limit,
      }),
      prisma.reporteSemanal.count({ where: { obraId } }),
    ]);

    return {
      datos: reportes.map(r => ({
        id: r.id,
        semana_inicio: r.semanaInicio.toISOString().split('T')[0],
        generado_en: r.generadoEn.toISOString(),
        enviado: r.enviado,
        resumen: (r.contenido as any)?.resumen_ejecutivo || '',
      })),
      total,
      pagina: page,
    };
  });

  // GET /api/v1/obras/:obraId/reportes/:id
  app.get('/obras/:obraId/reportes/:id', {
    preHandler: [requiereRol([
      RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR,
    ])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const reporte = await prisma.reporteSemanal.findFirst({
      where: { id, obraId },
    });

    if (!reporte) throw new AppError(404, 'REPORTE_NO_ENCONTRADO', 'Reporte no encontrado');

    return {
      id: reporte.id,
      obra_id: reporte.obraId,
      semana_inicio: reporte.semanaInicio.toISOString().split('T')[0],
      generado_en: reporte.generadoEn.toISOString(),
      enviado: reporte.enviado,
      contenido: reporte.contenido,
    };
  });

  // POST /api/v1/obras/:obraId/reportes/:id/enviar
  app.post('/obras/:obraId/reportes/:id/enviar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request, reply) => {
    const { obraId, id } = request.params as any;

    const reporte = await prisma.reporteSemanal.findFirst({
      where: { id, obraId },
    });

    if (!reporte) throw new AppError(404, 'REPORTE_NO_ENCONTRADO', 'Reporte no encontrado');

    // Obtener miembros activos de la obra para enviar email
    const miembros = await prisma.obraMiembro.findMany({
      where: { obraId, estado: 'ACTIVO', eliminadoEn: null },
      include: { usuario: { select: { email: true, nombre: true } } },
    });

    const contenido = reporte.contenido as any;
    const semana = contenido?.semana;

    // En desarrollo: solo loguear a consola
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n📧 EMAIL DE REPORTE SEMANAL (DEV)');
      console.log('─'.repeat(50));
      console.log(`Para: ${miembros.map(m => m.usuario.email).join(', ')}`);
      console.log(`Obra: ${obraId}`);
      console.log(`Semana: ${semana?.desde} al ${semana?.hasta}`);
      console.log(`Resumen: ${contenido?.resumen_ejecutivo}`);
      console.log(`Cifras: Previsto $${contenido?.cifras?.previsto} | Pagado $${contenido?.cifras?.pagado} | Proyección $${contenido?.cifras?.proyeccion}`);
      console.log('─'.repeat(50));
    }

    // En producción: implementar envío real de email (placeholder)
    // await enviarEmailReporte(miembros.map(m => m.usuario.email), contenido);

    // Marcar como enviado
    await prisma.reporteSemanal.update({
      where: { id },
      data: { enviado: true },
    });

    // Emitir evento reporte.enviado
    await EventoService.emitir(obraId, request.userId, 'reporte.enviado', {
      entidad_id: id,
      resumen_humano: `Reporte semanal enviado a ${miembros.length} miembros`,
      datos: { miembros_count: miembros.length },
    });

    return { ok: true, enviados_a: miembros.length };
  });

  // GET /api/v1/yo/preferencias-notificacion
  // Nota: preferenciasNotificacion no existe en el schema actual (Usuario).
  // Se devuelve默认值 sin persistencia hasta que el schema se actualice.
  app.get('/yo/preferencias-notificacion', {
    preHandler: [requiereAuth],
  }, async (request) => {
    // Por ahora siempre devuelve true; cuando el schema tenga el campo, persistir.
    return { reporte_semanal: true };
  });

  // PATCH /api/v1/yo/preferencias-notificacion
  app.patch('/yo/preferencias-notificacion', {
    preHandler: [requiereAuth],
  }, async (request) => {
    const data = preferenciasSchema.parse(request.body);
    // Por ahora no persiste; cuando el schema tenga el campo, guardar en preferenciasNotificacion.
    return { reporte_semanal: data.reporte_semanal ?? true };
  });
}

// ── Helpers internos para consumir otros módulos ───────────────────────────────

/** Lee directamente el resumen global de caja (evita llamada HTTP circular) */
async function resumenGlobal(obraId: string, contratistaId?: string) {
  const { resumenGlobal } = await import('../services/caja/calculos.js');
  return resumenGlobal(obraId, contratistaId);
}

/** Lee el resumen de plazos de la obra */
async function resumenPlazosObra(obraId: string, contratistaId?: string) {
  // Buscar la última fecha de fin prevista entre las tareas
  const tareas = await prisma.tarea.findMany({
    where: { obraId, eliminadoEn: null },
    select: {
      fechaFinPrevista: true,
      fechaFinNueva: true,
      avancePct: true,
      diasPerdidos: true,
    },
  });

  if (tareas.length === 0) {
    return {
      avance_global: 0,
      fin_previsto: null,
      fin_proyectado: null,
      demora_dias: 0,
      curva: [],
    };
  }

  // Avance global = promedio ponderado de avances
  const avanceSum = tareas.reduce((sum, t) => sum + parseFloat(t.avancePct.toString()), 0);
  const avance_global = Math.round(avanceSum / tareas.length);

  // Fin previsto = fecha fin prevista de la última tarea (por orden)
  const ultimaTarea = await prisma.tarea.findFirst({
    where: { obraId, eliminadoEn: null },
    orderBy: { orden: 'desc' },
    select: { fechaFinPrevista: true, fechaFinNueva: true },
  });

  const fin_previsto = ultimaTarea?.fechaFinPrevista?.toISOString().split('T')[0] || null;
  const fin_proyectado = ultimaTarea?.fechaFinNueva?.toISOString().split('T')[0] || null;

  // Demora en días
  let demora_dias = 0;
  if (ultimaTarea?.fechaFinNueva && ultimaTarea?.fechaFinPrevista) {
    const prev = new Date(ultimaTarea.fechaFinPrevista);
    const proy = new Date(ultimaTarea.fechaFinNueva);
    demora_dias = Math.max(0, Math.ceil((proy.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Curva mini: puntos de avance por semana (últimas 8 semanas)
  const curva = await obtenerCurvaAvance(obraId, 8);

  return { avance_global, fin_previsto, fin_proyectado, demora_dias, curva };
}

/** Obtiene puntos de curva de avance para las últimas N semanas */
async function obtenerCurvaAvance(obraId: string, semanas: number): Promise<{ semana: string; pct: number }[]> {
  const ahora = new Date();
  const puntos: { semana: string; pct: number }[] = [];

  for (let i = semanas - 1; i >= 0; i--) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() - (i * 7));
    const lunes = new Date(fecha);
    const diaSemana = fecha.getDay();
    const diffLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    lunes.setDate(fecha.getDate() - diffLunes);
    lunes.setHours(0, 0, 0, 0);

    const inicioSemana = lunes.toISOString().split('T')[0];
    const finSemana = new Date(lunes);
    finSemana.setDate(lunes.getDate() + 6);
    const finSemanaStr = finSemana.toISOString().split('T')[0];

    // Obtener avance promedio de esa semana
    const registros = await prisma.avanceRegistro.findMany({
      where: {
        obraId,
        fecha: { gte: new Date(inicioSemana), lte: new Date(finSemanaStr) },
      },
      include: { tarea: { select: { avancePct: true } } },
    });

    const pct = registros.length > 0
      ? Math.round(registros.reduce((sum, r) => sum + parseFloat(r.avancePct.toString()), 0) / registros.length)
      : 0;

    puntos.push({ semana: inicioSemana, pct });
  }

  return puntos;
}