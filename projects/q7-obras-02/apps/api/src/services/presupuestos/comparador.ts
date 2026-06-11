import { PrismaClient, TipoPresupuesto, TipoRecurso } from '@prisma/client';
import { AppError } from '../../middleware/error.js';

const prisma = new PrismaClient();

// ── Tipos del comparador ──

export interface CeldaComparador {
  subtotal: number;
  items_count: number;
  no_cotizado: boolean;
  parcial: boolean;
  tooltip: string | null;
  es_mejor_precio: boolean;
}

export interface FilaComparador {
  rubro_id: string;
  rubro_codigo: string;
  rubro_nombre: string;
  orden: number;
  celdas: Record<string, CeldaComparador>; // key = presupuestoId
  mejor_precio_col: string | null; // presupuestoId con mejor precio
}

export interface ColumnaComparador {
  id: string;
  nombre: string;
  tipo: 'REFERENCIA' | 'PROPUESTA';
  proveedor: string | null;
  moneda: string;
  fecha_precio: string;
}

export interface TotalesComparador {
  total_comparable: Record<string, number>; // presupuestoId -> total comparable
  total_nominal: Record<string, number>; // presupuestoId -> total nominal
  delta_vs_referencia: Record<string, number> | null; // vs referencia
}

// ── Servicio principal ──

export async function calcularComparador(obraId: string, propuestaIds: string[]): Promise<{
  columnas: ColumnaComparador[];
  filas: FilaComparador[];
  totales: TotalesComparador;
}> {

  // Obtener todos los presupuestos a comparar (propuestas + referencia si existe)
  const todosIds = [...propuestaIds];

  // Buscar si hay una referencia para esta obra
  const referencia = await prisma.presupuesto.findFirst({
    where: { obraId, tipo: TipoPresupuesto.REFERENCIA, estado: { not: 'DESCARTADO' }, eliminadoEn: null },
    include: {
      items: { where: { eliminadoEn: null }, include: { rubroObra: true } },
    },
  });

  if (referencia) {
    todosIds.unshift(referencia.id); // Poner referencia primero
  }

  // Cargar todos los presupuestos
  const presupuestos = await prisma.presupuesto.findMany({
    where: { id: { in: todosIds }, eliminadoEn: null },
    include: {
      contratistaMiembro: { include: { usuario: { select: { nombre: true } } } },
      items: { where: { eliminadoEn: null } },
    },
  });

  // Ordenar: referencia primero, luego propuestas
  presupuestos.sort((a, b) => {
    if (a.tipo === TipoPresupuesto.REFERENCIA) return -1;
    if (b.tipo === TipoPresupuesto.REFERENCIA) return 1;
    return propuestaIds.indexOf(a.id) - propuestaIds.indexOf(b.id);
  });

  // Verificar R4: misma moneda
  const monedas = new Set(presupuestos.map(p => p.moneda));
  if (monedas.size > 1) {
    throw new AppError(400, 'MONEDAS_DIFERENTES', 'Las propuestas deben estar en la misma moneda para comparar');
  }

  // Obtener rubros de la obra (con tareas de nivel 3)
  const rubrosObra = await prisma.rubroObra.findMany({
    where: { obraId, eliminadoEn: null },
    include: {
      tareas: { where: { eliminadoEn: null, nivel: 3 }, select: { id: true } },
    },
    orderBy: { orden: 'asc' },
  });

  // Obtener el adoptado para marcar rubros ya adoptados
  const adoptado = await prisma.presupuesto.findFirst({
    where: { obraId, tipo: TipoPresupuesto.ADOPTADO, eliminadoEn: null },
    include: {
      items: { where: { eliminadoEn: null, origen: 'ADOPCION' } },
      adopciones: { where: { eliminadoEn: null } },
    },
  });

  // Map de adopciones por rubro
  const adopcionesPorRubro = new Map<string, string>(); // rubroObraId -> presupuestoOrigenId
  if (adoptado) {
    for (const a of adoptado.adopciones) {
      adopcionesPorRubro.set(a.rubroObraId, a.presupuestoOrigenId);
    }
  }

  // Obtener adopciones vigentes (para saber cuáles ya están adoptados)
  const adopciones = await prisma.adopcion.findMany({
    where: { obraId, eliminadoEn: null },
    select: { rubroObraId: true, presupuestoOrigenId: true },
  });
  const adoptadoPorRubro = new Map<string, string>();
  for (const a of adopciones) {
    adoptadoPorRubro.set(a.rubroObraId, a.presupuestoOrigenId);
  }

  // Construir columnas
  const columnas: ColumnaComparador[] = presupuestos.map(p => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo as 'REFERENCIA' | 'PROPUESTA',
    proveedor: p.contratistaMiembro?.usuario?.nombre || p.proveedorNombre || 'Sin proveedor',
    moneda: p.moneda,
    fecha_precio: p.fechaPrecio.toISOString().split('T')[0],
  }));

  // Indexar items por rubro y presupuesto
  const itemsPorPresupuesto = new Map<string, Map<string, { count: number; subtotal: number; tareasIds: Set<string> }>>();
  for (const p of presupuestos) {
    const porRubro = new Map<string, { count: number; subtotal: number; tareasIds: Set<string> }>();
    for (const item of p.items) {
      const existente = porRubro.get(item.rubroObraId);
      if (existente) {
        existente.count++;
        existente.subtotal += parseFloat(item.subtotal.toString());
        if (item.tareaId) existente.tareasIds.add(item.tareaId);
      } else {
        porRubro.set(item.rubroObraId, {
          count: 1,
          subtotal: parseFloat(item.subtotal.toString()),
          tareasIds: item.tareaId ? new Set([item.tareaId]) : new Set(),
        });
      }
    }
    itemsPorPresupuesto.set(p.id, porRubro);
  }

  // Calcular máxima cantidad de tareas por rubro (para determinar "parcial")
  const maxTareasPorRubro = new Map<string, number>(); // rubroId -> max tareas cotizadas
  for (const [presId, porRubro] of itemsPorPresupuesto) {
    for (const [rubroId, data] of porRubro) {
      const actual = maxTareasPorRubro.get(rubroId) || 0;
      if (data.count > actual) maxTareasPorRubro.set(rubroId, data.count);
    }
  }

  // Construir filas
  const filas: FilaComparador[] = [];
  for (const rubro of rubrosObra) {
    // Solo rubros con al menos una tarea de nivel 3
    if (rubro.tareas.length === 0) continue;

    const celdas: Record<string, CeldaComparador> = {};
    let mejorPrecio: number | null = null;
    let mejorCol: string | null = null;

    for (const col of columnas) {
      const porRubro = itemsPorPresupuesto.get(col.id);
      const datosRubro = porRubro?.get(rubro.id);

      if (!datosRubro || datosRubro.count === 0) {
        // No cotizó este rubro
        celdas[col.id] = {
          subtotal: 0,
          items_count: 0,
          no_cotizado: true,
          parcial: false,
          tooltip: `No cotiza ${rubro.codigo} — ${rubro.nombre}`,
          es_mejor_precio: false,
        };
      } else {
        const esParcial = datosRubro.count < (maxTareasPorRubro.get(rubro.id) || 1);
        const tooltip = esParcial
          ? `Cotiza ${datosRubro.count} de ${maxTareasPorRubro.get(rubro.id) || '?'} tareas del rubro`
          : null;

        celdas[col.id] = {
          subtotal: datosRubro.subtotal,
          items_count: datosRubro.count,
          no_cotizado: false,
          parcial: esParcial,
          tooltip,
          es_mejor_precio: false,
        };

        // Determinar mejor precio (solo entre columnas completas, no referencia)
        if (col.tipo === 'PROPUESTA' && !esParcial) {
          if (mejorPrecio === null || datosRubro.subtotal < mejorPrecio) {
            mejorPrecio = datosRubro.subtotal;
            mejorCol = col.id;
          }
        }
      }
    }

    // Marcar mejor precio
    if (mejorCol) {
      celdas[mejorCol].es_mejor_precio = true;
    }

    // Verificar si ya está adoptado
    const adoptadoDe = adoptadoPorRubro.get(rubro.id);
    const adoptadoYa = !!adoptadoDe;

    filas.push({
      rubro_id: rubro.id,
      rubro_codigo: rubro.codigo,
      rubro_nombre: rubro.nombre,
      orden: rubro.orden,
      celdas,
      mejor_precio_col: mejorCol,
    });
  }

  // Calcular totales
  const totales: TotalesComparador = {
    total_comparable: {},
    total_nominal: {},
    delta_vs_referencia: null,
  };

  // Para total comparable: solo rubros que TODAS las propuestas (no referencia) cotizan completo
  for (const col of columnas) {
    let totalComp = 0;
    let totalNom = 0;

    for (const fila of filas) {
      const celda = fila.celdas[col.id];
      if (!celda) continue;

      totalNom += celda.subtotal;

      // Solo contar en comparable si:
      // - No es no_cotizado Y
      // - Si es PROPUESTA: no es parcial
      if (!celda.no_cotizado && (col.tipo === 'REFERENCIA' || !celda.parcial)) {
        totalComp += celda.subtotal;
      }
    }

    totales.total_nominal[col.id] = Math.round(totalNom * 100) / 100;
    totales.total_comparable[col.id] = Math.round(totalComp * 100) / 100;
  }

  // Calcular delta vs referencia
  if (referencia) {
    const refTotalComp = totales.total_comparable[referencia.id] || 0;
    if (refTotalComp > 0) {
      totales.delta_vs_referencia = {};
      for (const col of columnas) {
        if (col.id === referencia.id) {
          totales.delta_vs_referencia[col.id] = 0;
        } else {
          const colTotalComp = totales.total_comparable[col.id] || 0;
          const delta = ((colTotalComp - refTotalComp) / refTotalComp) * 100;
          totales.delta_vs_referencia[col.id] = Math.round(delta * 100) / 100;
        }
      }
    }
  }

  return { columnas, filas, totales };
}

// ── Items detallados para el drawer ──

export async function obtenerItemsParaDrawer(presupuestoId: string, rubroObraId: string) {
  const items = await prisma.presupuestoItem.findMany({
    where: { presupuestoId, rubroObraId, eliminadoEn: null },
    include: {
      tarea: { select: { codigo: true, descripcion: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return items.map(i => ({
    id: i.id,
    descripcion: i.descripcion,
    tarea_codigo: i.tarea?.codigo || null,
    tarea_descripcion: i.tarea?.descripcion || null,
    tipo_recurso: i.tipoRecurso,
    unidad: i.unidad,
    cantidad: i.cantidad.toString(),
    precio_unitario: i.precioUnitario.toString(),
    subtotal: i.subtotal.toString(),
    incluye: i.incluye,
    excluye: i.excluye,
  }));
}