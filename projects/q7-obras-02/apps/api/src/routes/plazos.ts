// Routes de Plazos y Avance — M5
// Endpoints: GET plazos, PATCH plazos, POST dias-perdidos, POST avance, POST finalizar, GET historial

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { requiereRol } from '../middleware/auth.js';
import { RolObra, EstadoTarea } from '@q7/shared';
import { EventoService } from './eventos.js';
import {
  calcularFechaFinPrevista,
  calcularFechaFinNueva,
  calcularDemora,
  calcularAvanceRubro,
  calcularCurva,
  calcularResumenObra,
  generarBarrasGantt,
  type TareaPlazo,
} from '../services/plazos/calculos.js';

const prisma = new PrismaClient();

// ── Schemas de validación ──────────────────────────────────────

const PatchPlazosSchema = z.object({
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dias_habiles_prev: z.number().int().min(0).optional(),
});

const DiasPerdidosSchema = z.object({
  dias: z.number().int(), // puede ser negativo (recupero)
  motivo: z.string().min(1, 'Motivo obligatorio'),
});

const AvanceSchema = z.object({
  avance_pct: z.number().min(0).max(100),
  nota: z.string().optional(),
  foto: z.string().optional(), // URL de foto subida
});

const FinalizarSchema = z.object({
  fecha_fin_real: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ── Helper: verificar tarea hoja ───────────────────────────────

async function esTareaHoja(tareaId: string): Promise<boolean> {
  const hijos = await prisma.tarea.count({ where: { padreId: tareaId, eliminadoEn: null } });
  return hijos === 0;
}

async function obtenerTareaConPlazos(tareaId: string, obraId: string) {
  return prisma.tarea.findFirst({
    where: { id: tareaId, obraId, eliminadoEn: null },
    include: {
      rubroObra: { select: { id: true, codigo: true, nombre: true } },
      avancesRegistro: {
        where: { eliminadoEn: null },
        orderBy: { fecha: 'asc' },
        include: { registradoPorUser: { select: { id: true, nombre: true } } },
      },
    },
  });
}

// ── GET /obras/:obraId/plazos ──────────────────────────────────

export async function plazosRoutes(app: FastifyInstance) {

  // GET /api/v1/obras/:obraId/plazos
  app.get('/obras/:obraId/plazos', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId } = request.params as any;
    const usuarioId = (request as any).userId as string;

    // Obtener miembro para R7
    const miembro = await prisma.obraMiembro.findFirst({
      where: { obraId, usuarioId, estado: 'ACTIVO', eliminadoEn: null },
    });
    const rol = miembro?.rol;

    // Obtener todas las tareas de la obra con plazos
    const tareasRaw = await prisma.tarea.findMany({
      where: { obraId, eliminadoEn: null },
      include: {
        rubroObra: { select: { id: true, codigo: true, nombre: true } },
        avancesRegistro: {
          where: { eliminadoEn: null },
          orderBy: { fecha: 'asc' },
        },
      },
      orderBy: [{ rubroObra: { orden: 'asc' } }, { orden: 'asc' }],
    });

    // Determinar cuáles son hojas (no tienen hijos)
    const todasIds = new Set(tareasRaw.map(t => t.id));
    const tareasPlazo: TareaPlazo[] = tareasRaw.map(t => ({
      id: t.id,
      codigo: t.codigo,
      descripcion: t.descripcion,
      nivel: t.nivel,
      unidad: t.unidad,
      fechaInicio: t.fechaInicio,
      diasHabilesPrev: t.diasHabilesPrev,
      fechaFinPrevista: t.fechaFinPrevista,
      diasPerdidos: t.diasPerdidos,
      fechaFinNueva: t.fechaFinNueva,
      fechaFinReal: t.fechaFinReal,
      avancePct: t.avancePct,
      estado: t.estado,
      rubroObraId: t.rubroObra.id,
      rubroCodigo: t.rubroObra.codigo,
      rubroNombre: t.rubroObra.nombre,
      tieneHijos: todasIds.has(t.id) && tareasRaw.some(h => h.padreId === t.id),
    }));

    const hojas = tareasPlazo.filter(t => !t.tieneHijos);
    const hoy = new Date().toISOString().split('T')[0];

    // Resumen global
    const resumen = calcularResumenObra(tareasPlazo);

    // ÁRBOL: rubros → tareas (con rollup en padres)
    const rubroIds = [...new Set(tareasPlazo.map(t => t.rubroObraId))];
    const rubrosData = await Promise.all(
      rubroIds.map(async (rubroId) => {
        const rubroTareas = tareasPlazo.filter(t => t.rubroObraId === rubroId);
        const hojasRubro = rubroTareas.filter(t => !t.tieneHijos);

        // Rollup rubro
        const avanceRubro = calcularAvanceRubro(hojasRubro);
        const finMaxRubro = hojasRubro
          .map(t => t.fechaFinNueva)
          .filter(Boolean)
          .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
        const diasPerdidosRubro = hojasRubro.reduce((s, t) => s + t.diasPerdidos, 0);

        // Barras Gantt para este rubro
        const barras = generarBarrasGantt(rubroTareas, hoy, resumen.inicioObra || hoy);

        // Curva por rubro (R6)
        const avances = hojasRubro.flatMap(t =>
          (t as any)._count?.avancesRegistro
            ? []
            : []
        );
        const avancesFlatos = await prisma.avanceRegistro.findMany({
          where: {
            tareaId: { in: hojasRubro.map(t => t.id) },
            eliminadoEn: null,
          },
          select: { tareaId: true, fecha: true, avancePct: true },
        });

        const curvaRubro = calcularCurva(
          hojasRubro,
          avancesFlatos.map(a => ({
            tareaId: a.tareaId,
            fecha: a.fecha.toISOString().split('T')[0],
            avancePct: parseFloat(a.avancePct.toString()),
          })),
          resumen.inicioObra || hoy,
          finMaxRubro
            ? (finMaxRubro instanceof Date ? finMaxRubro.toISOString().split('T')[0] : finMaxRubro)
            : hoy
        );

        // R7: CONSTRUCTOR solo ve tareas propias
        let tareasFiltradas = rubroTareas;
        if (rol === RolObra.CONSTRUCTOR) {
          // MVP: constructor puede ver todas pero no editar plazos (se filtra en cada endpoint)
          tareasFiltradas = rubroTareas;
        }

        return {
          rubroObraId: rubroId,
          rubroCodigo: rubroTareas[0]?.rubroCodigo || '',
          rubroNombre: rubroTareas[0]?.rubroNombre || '',
          avancePct: avanceRubro.avancePonderado,
          diasPerdidos: diasPerdidosRubro,
          finProyectado: finMaxRubro
            ? (finMaxRubro instanceof Date ? finMaxRubro.toISOString().split('T')[0] : finMaxRubro)
            : null,
          tareas: tareasFiltradas.map(t => {
            const barra = barras.find(b => b.tareaId === t.id);
            return {
              id: t.id,
              codigo: t.codigo,
              descripcion: t.descripcion,
              nivel: t.nivel,
              unidad: t.unidad,
              // Campos de plazos (solo hojas)
              esHoja: !t.tieneHijos,
              fechaInicio: t.fechaInicio
                ? (t.fechaInicio instanceof Date ? t.fechaInicio.toISOString().split('T')[0] : t.fechaInicio)
                : null,
              diasHabilesPrev: t.diasHabilesPrev,
              fechaFinPrevista: t.fechaFinPrevista
                ? (t.fechaFinPrevista instanceof Date ? t.fechaFinPrevista.toISOString().split('T')[0] : t.fechaFinPrevista)
                : null,
              diasPerdidos: t.diasPerdidos,
              fechaFinNueva: t.fechaFinNueva
                ? (t.fechaFinNueva instanceof Date ? t.fechaFinNueva.toISOString().split('T')[0] : t.fechaFinNueva)
                : null,
              fechaFinReal: t.fechaFinReal
                ? (t.fechaFinReal instanceof Date ? t.fechaFinReal.toISOString().split('T')[0] : t.fechaFinReal)
                : null,
              avancePct: parseFloat(t.avancePct.toString()),
              estado: t.estado,
              // Barra Gantt
              barra: barra || null,
              // Para padres: rollup calculado
              rollupAvancePct: t.tieneHijos ? calcularAvanceRubro(rubroTareas.filter(h => h.padreId === t.id)).avancePonderado : undefined,
            };
          }),
          curva: curvaRubro,
        };
      })
    );

    // Datos de curva global
    const avancesGlobales = await prisma.avanceRegistro.findMany({
      where: { obraId, eliminadoEn: null },
      select: { tareaId: true, fecha: true, avancePct: true },
    });
    const curvaGlobal = calcularCurva(
      hojas,
      avancesGlobales.map(a => ({
        tareaId: a.tareaId,
        fecha: a.fecha.toISOString().split('T')[0],
        avancePct: parseFloat(a.avancePct.toString()),
      })),
      resumen.inicioObra || hoy,
      resumen.finProyectadoObra || hoy
    );

    // Anotaciones de OC aprobadas (para la curva)
    const ocsAprobadas = await prisma.ordenCambio.findMany({
      where: { obraId, estado: 'APROBADA', eliminadoEn: null, impactoDias: { not: 0 } },
      select: { id: true, numero: true, titulo: true, impactoDias: true, fechaResolucion: true },
    });

    return {
      resumen,
      rubros: rubrosData,
      curvaGlobal,
      ordenesCambioDias: ocsAprobadas.map(oc => ({
        id: oc.id,
        numero: oc.numero,
        titulo: oc.titulo,
        impactoDias: oc.impactoDias,
        fecha: oc.fechaResolucion
          ? (oc.fechaResolucion instanceof Date ? oc.fechaResolucion.toISOString().split('T')[0] : oc.fechaResolucion)
          : null,
      })),
    };
  });

  // PATCH /api/v1/obras/:obraId/tareas/:id/plazos
  app.patch('/obras/:obraId/tareas/:id/plazos', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const usuarioId = (request as any).userId as string;
    const data = PatchPlazosSchema.parse(request.body);

    // R1: verificar que es tarea hoja
    const esHoja = await esTareaHoja(id);
    if (!esHoja) {
      return (request as any).reply.status(422).send({
        error: { codigo: 'SOLO_TAREA_HOJA', mensaje: 'Solo tareas hoja pueden tener plazos propios' },
      });
    }

    const tarea = await obtenerTareaConPlazos(id, obraId);
    if (!tarea) {
      return (request as any).reply.status(404).send({
        error: { codigo: 'TAREA_NO_ENCONTRADA', mensaje: 'Tarea no encontrada' },
      });
    }

    // Construir update
    const updateData: any = {};
    if (data.fecha_inicio !== undefined) {
      updateData.fechaInicio = new Date(data.fecha_inicio);
    }
    if (data.dias_habiles_prev !== undefined) {
      updateData.diasHabilesPrev = data.dias_habiles_prev;
    }

    // Recalcular fecha_fin_prevista si cambió inicio o días
    const nuevaFechaInicio = data.fecha_inicio
      ? data.fecha_inicio
      : (tarea.fechaInicio ? tarea.fechaInicio.toISOString().split('T')[0] : null);
    const nuevosDias = data.dias_habiles_prev !== undefined
      ? data.dias_habiles_prev
      : (tarea.diasHabilesPrev ?? 0);

    if (nuevaFechaInicio && nuevosDias > 0) {
      const nuevaFinPrev = calcularFechaFinPrevista(nuevaFechaInicio, nuevosDias);
      if (nuevaFinPrev) updateData.fechaFinPrevista = new Date(nuevaFinPrev);

      // Recalcular fecha_fin_nueva con dias_perdidos actuales
      const nuevaFinNueva = calcularFechaFinNueva(nuevaFinPrev, tarea.diasPerdidos);
      if (nuevaFinNueva) updateData.fechaFinNueva = new Date(nuevaFinNueva);
    }

    const tareaActualizada = await prisma.tarea.update({
      where: { id },
      data: updateData,
      include: { rubroObra: { select: { codigo: true, nombre: true } } },
    });

    return {
      id: tareaActualizada.id,
      fechaInicio: tareaActualizada.fechaInicio?.toISOString().split('T')[0] || null,
      diasHabilesPrev: tareaActualizada.diasHabilesPrev,
      fechaFinPrevista: tareaActualizada.fechaFinPrevista?.toISOString().split('T')[0] || null,
      diasPerdidos: tareaActualizada.diasPerdidos,
      fechaFinNueva: tareaActualizada.fechaFinNueva?.toISOString().split('T')[0] || null,
      estado: tareaActualizada.estado,
    };
  });

  // POST /api/v1/obras/:obraId/tareas/:id/dias-perdidos
  app.post('/obras/:obraId/tareas/:id/dias-perdidos', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const usuarioId = (request as any).userId as string;
    const { dias, motivo } = DiasPerdidosSchema.parse(request.body);

    // R7: CONSTRUCTOR solo en rubros propios (MVP simplificado: se permite en cualquier tarea)
    const miembro = await prisma.obraMiembro.findFirst({
      where: { obraId, usuarioId, estado: 'ACTIVO', eliminadoEn: null },
    });

    const tarea = await obtenerTareaConPlazos(id, obraId);
    if (!tarea) {
      return (request as any).reply.status(404).send({
        error: { codigo: 'TAREA_NO_ENCONTRADA', mensaje: 'Tarea no encontrada' },
      });
    }

    // R4: dias_perdidos acumulado nunca baja de 0
    const nuevoAcumulado = Math.max(0, tarea.diasPerdidos + dias);

    // Recalcular fecha_fin_nueva
    const finPrev = tarea.fechaFinPrevista?.toISOString().split('T')[0] || null;
    let nuevaFinNueva: string | null = null;
    if (finPrev) {
      nuevaFinNueva = calcularFechaFinNueva(finPrev, nuevoAcumulado);
    }

    const tareaActualizada = await prisma.tarea.update({
      where: { id },
      data: {
        diasPerdidos: nuevoAcumulado,
        fechaFinNueva: nuevaFinNueva ? new Date(nuevaFinNueva) : undefined,
      },
      include: { rubroObra: { select: { codigo: true, nombre: true } } },
    });

    // R5: Emitir evento
    await EventoService.emitir(obraId, usuarioId, 'plazos.dias_perdidos', {
      entidad_id: id,
      resumen_humano: `${tarea.codigo} ${dias >= 0 ? '+' + dias : dias} días perdidos (motivo: ${motivo})`,
      datos: {
        tareaId: id,
        tareaCodigo: tarea.codigo,
        dias: dias,
        acumulado: nuevoAcumulado,
        motivo,
        fechaFinNueva: nuevaFinNueva,
      },
    });

    return {
      id: tareaActualizada.id,
      diasPerdidos: tareaActualizada.diasPerdidos,
      fechaFinNueva: tareaActualizada.fechaFinNueva?.toISOString().split('T')[0] || null,
      demora: calcularDemora({
        ...tarea,
        diasPerdidos: nuevoAcumulado,
        fechaFinNueva: tareaActualizada.fechaFinNueva,
      } as TareaPlazo),
    };
  });

  // POST /api/v1/obras/:obraId/tareas/:id/avance
  app.post('/obras/:obraId/tareas/:id/avance', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const usuarioId = (request as any).userId as string;
    const { avance_pct, nota, foto } = AvanceSchema.parse(request.body);

    const tarea = await obtenerTareaConPlazos(id, obraId);
    if (!tarea) {
      return (request as any).reply.status(404).send({
        error: { codigo: 'TAREA_NO_ENCONTRADA', mensaje: 'Tarea no encontrada' },
      });
    }

    const avanceActual = parseFloat(tarea.avancePct.toString());
    const esCorreccion = avance_pct < avanceActual;

    // R2: si baja, necesita nota y rol ADMIN/PROFESIONAL
    if (esCorreccion) {
      const miembro = await prisma.obraMiembro.findFirst({
        where: { obraId, usuarioId, estado: 'ACTIVO', eliminadoEn: null },
      });
      if (!nota) {
        return (request as any).reply.status(422).send({
          error: { codigo: 'NOTA_OBLIGATORIA', mensaje: 'Corrección de avance requiere nota explicativa' },
        });
      }
      if (!miembro || (miembro.rol !== RolObra.ADMIN_OBRA && miembro.rol !== RolObra.PROFESIONAL)) {
        return (request as any).reply.status(403).send({
          error: { codigo: 'AVANCE_NO_PUEDE_BAJAR', mensaje: 'Solo ADMIN o PROFESIONAL pueden corregir avance a la baja' },
        });
      }
    }

    // R3: avance > 0 → estado EN_CURSO
    let nuevoEstado: 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' = tarea.estado as any;
    if (avance_pct > 0 && tarea.estado === 'PENDIENTE') {
      nuevoEstado = 'EN_CURSO';
    }

    const hoy = new Date().toISOString().split('T')[0];

    // Crear registro de avance
    const registro = await prisma.avanceRegistro.create({
      data: {
        tareaId: id,
        obraId,
        fecha: new Date(hoy),
        avancePct: new Prisma.Decimal(avance_pct),
        nota: nota || null,
        fotoUrl: foto || null,
        registradoPor: usuarioId,
      },
      include: { registradoPorUser: { select: { id: true, nombre: true } } },
    });

    // Actualizar tarea
    const tareaActualizada = await prisma.tarea.update({
      where: { id },
      data: {
        avancePct: new Prisma.Decimal(avance_pct),
        estado: nuevoEstado,
      },
      include: { rubroObra: { select: { codigo: true, nombre: true } } },
    });

    // R5: Emitir evento
    await EventoService.emitir(obraId, usuarioId, 'plazos.avance_registrado', {
      entidad_id: id,
      resumen_humano: `${tarea.codigo} al ${avance_pct}%`,
      datos: {
        tareaId: id,
        tareaCodigo: tarea.codigo,
        avancePct: avance_pct,
        nota,
        esCorreccion,
      },
    });

    return {
      registro: {
        id: registro.id,
        fecha: registro.fecha.toISOString().split('T')[0],
        avancePct: parseFloat(registro.avancePct.toString()),
        nota: registro.nota,
        fotoUrl: registro.fotoUrl,
        registradoPor: registro.registradoPorUser,
      },
      tarea: {
        id: tareaActualizada.id,
        avancePct: parseFloat(tareaActualizada.avancePct.toString()),
        estado: tareaActualizada.estado,
      },
    };
  });

  // POST /api/v1/obras/:obraId/tareas/:id/finalizar
  app.post('/obras/:obraId/tareas/:id/finalizar', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;
    const usuarioId = (request as any).userId as string;
    const { fecha_fin_real } = FinalizarSchema.parse(request.body);

    const tarea = await obtenerTareaConPlazos(id, obraId);
    if (!tarea) {
      return (request as any).reply.status(404).send({
        error: { codigo: 'TAREA_NO_ENCONTRADA', mensaje: 'Tarea no encontrada' },
      });
    }

    // R3: finalizar exige avance 100
    const avanceActual = parseFloat(tarea.avancePct.toString());
    if (avanceActual < 100) {
      return (request as any).reply.status(422).send({
        error: { codigo: 'AVANCE_INCOMPLETO', mensaje: `No se puede finalizar con avance ${avanceActual}% — requiere 100%` },
      });
    }

    const tareaActualizada = await prisma.tarea.update({
      where: { id },
      data: {
        estado: 'FINALIZADA',
        fechaFinReal: new Date(fecha_fin_real),
        // Si no tenía fechaFinNueva, calcularla con los días perdidos
        fechaFinNueva: tarea.fechaFinNueva || tarea.fechaFinPrevista,
      },
      include: { rubroObra: { select: { codigo: true, nombre: true } } },
    });

    // R5: Emitir evento
    await EventoService.emitir(obraId, usuarioId, 'plazos.tarea_finalizada', {
      entidad_id: id,
      resumen_humano: `${tarea.codigo} finalizada el ${fecha_fin_real}`,
      datos: {
        tareaId: id,
        tareaCodigo: tarea.codigo,
        fechaFinReal: fecha_fin_real,
        diasPerdidos: tareaActualizada.diasPerdidos,
      },
    });

    return {
      id: tareaActualizada.id,
      estado: tareaActualizada.estado,
      fechaFinReal: tareaActualizada.fechaFinReal?.toISOString().split('T')[0] || null,
      diasPerdidos: tareaActualizada.diasPerdidos,
      demora: calcularDemora({
        ...tarea,
        estado: 'FINALIZADA',
        fechaFinReal: tareaActualizada.fechaFinReal,
      } as TareaPlazo),
    };
  });

  // GET /api/v1/obras/:obraId/tareas/:id/historial-avance
  app.get('/obras/:obraId/tareas/:id/historial-avance', {
    preHandler: [requiereRol([RolObra.ADMIN_OBRA, RolObra.COMITENTE, RolObra.PROFESIONAL, RolObra.CONSTRUCTOR])],
  }, async (request) => {
    const { obraId, id } = request.params as any;

    const tarea = await prisma.tarea.findFirst({
      where: { id, obraId, eliminadoEn: null },
    });
    if (!tarea) {
      return (request as any).reply.status(404).send({
        error: { codigo: 'TAREA_NO_ENCONTRADA', mensaje: 'Tarea no encontrada' },
      });
    }

    const registros = await prisma.avanceRegistro.findMany({
      where: { tareaId: id, eliminadoEn: null },
      orderBy: { fecha: 'desc' },
      include: { registradoPorUser: { select: { id: true, nombre: true, avatarUrl: true } } },
    });

    return {
      tarea: {
        id: tarea.id,
        codigo: tarea.codigo,
        descripcion: tarea.descripcion,
      },
      registros: registros.map(r => ({
        id: r.id,
        fecha: r.fecha.toISOString().split('T')[0],
        avancePct: parseFloat(r.avancePct.toString()),
        nota: r.nota,
        fotoUrl: r.fotoUrl,
        registradoPor: r.registradoPorUser,
      })),
    };
  });
}