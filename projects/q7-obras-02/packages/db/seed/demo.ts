// Seed de datos semilla — obra demo "Vivienda Demo 200 m²"
// Fixture para tests de integración de todos los módulos
// Documentado en 00_ARQUITECTURA_COMUN.md §9

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Password: "demo123" para todos los usuarios demo
const HASH = '$2a$10$nCbm5nL7yeR7M0Ypw0QAHeKCWFP7UBGQ15fDHOWxTqsb5atXKFZpm'; // bcrypt hash de "demo123"

function uuid(): string {
  return crypto.randomUUID();
}

async function main() {
  console.log('🌱 Sembrando datos demo de q7-obras-02...');

  // ── Usuarios demo (4 roles) ──
  const adminId = uuid();
  const comitenteId = uuid();
  const profesionalId = uuid();
  const constructorId = uuid();

  await prisma.usuario.createMany({
    data: [
      { id: adminId, email: 'admin@demo.obra', nombre: 'María Admin', passwordHash: HASH },
      { id: comitenteId, email: 'comitente@demo.obra', nombre: 'Carlos Comitente', passwordHash: HASH },
      { id: profesionalId, email: 'pro@demo.obra', nombre: 'Juan Profesional', passwordHash: HASH },
      { id: constructorId, email: 'construct@demo.obra', nombre: 'NITO Construcciones', passwordHash: HASH },
    ],
  });
  console.log('✅ 4 usuarios creados');

  // ── Obra demo ──
  const obraId = uuid();
  await prisma.obra.create({
    data: {
      id: obraId,
      nombre: 'Vivienda Demo 200 m²',
      tipo: 'VIVIENDA',
      pais: 'AR',
      monedaBase: 'ARS',
      superficieM2: 200,
      presupuestoObjetivo: 25000000,
      creadorId: adminId,
    },
  });

  // ── Miembros ──
  const tokenAdmin = crypto.randomBytes(16).toString('hex');
  await prisma.obraMiembro.createMany({
    data: [
      { id: uuid(), obraId, usuarioId: adminId, rol: 'ADMIN_OBRA', estado: 'ACTIVO', tokenInvitacion: tokenAdmin },
      { id: uuid(), obraId, usuarioId: comitenteId, rol: 'COMITENTE', estado: 'ACTIVO', tokenInvitacion: crypto.randomBytes(16).toString('hex') },
      { id: uuid(), obraId, usuarioId: profesionalId, rol: 'PROFESIONAL', estado: 'ACTIVO', tokenInvitacion: crypto.randomBytes(16).toString('hex') },
      { id: uuid(), obraId, usuarioId: constructorId, rol: 'CONSTRUCTOR', estado: 'ACTIVO', tokenInvitacion: crypto.randomBytes(16).toString('hex') },
    ],
  });
  console.log('✅ Obra demo + 4 miembros');

  // ── Rubros (catálogo + obra) ──
  const rubros = [
    { codigo: 'HA00', nombre: 'Hormigón armado' },
    { codigo: 'MA00', nombre: 'Mamposterías' },
    { codigo: 'CA00', nombre: 'Carpinterías' },
  ];
  // Catálogo global
  const catalogo = require('./rubros.json');
  for (const r of catalogo) {
    await prisma.rubroCatalogo.upsert({
      where: { codigo: r.codigo },
      update: {},
      create: { codigo: r.codigo, nombre: r.nombre, orden: r.orden },
    });
  }
  // Rubros de la obra
  const rubroHA = uuid(), rubroMA = uuid(), rubroCA = uuid();
  await prisma.rubroObra.createMany({
    data: [
      { id: rubroHA, obraId, codigo: 'HA00', nombre: 'Hormigón armado', orden: 1, origen: 'CATALOGO' },
      { id: rubroMA, obraId, codigo: 'MA00', nombre: 'Mamposterías', orden: 2, origen: 'CATALOGO' },
      { id: rubroCA, obraId, codigo: 'CA00', nombre: 'Carpinterías', orden: 3, origen: 'CATALOGO' },
    ],
  });
  console.log('✅ Catálogo de rubros + 3 rubros en obra');

  // ── Tareas (12 tareas, 3 niveles) ──
  const tareas = [
    // HA00
    { id: uuid(), obraId, rubroObraId: rubroHA, codigo: 'HA01', descripcion: 'Platea de fundación', nivel: 1, unidad: 'M3', cantidad: 24, orden: 1 },
    { id: uuid(), obraId, rubroObraId: rubroHA, codigo: 'HA02', descripcion: 'Columnas PB', nivel: 1, unidad: 'ML', cantidad: 48, orden: 2 },
    { id: uuid(), obraId, rubroObraId: rubroHA, codigo: 'HA03', descripcion: 'Vigas PB', nivel: 1, unidad: 'ML', cantidad: 60, orden: 3 },
    { id: uuid(), obraId, rubroObraId: rubroHA, codigo: 'HA04', descripcion: 'Losa PB', nivel: 1, unidad: 'M2', cantidad: 80, orden: 4 },
    // MA00
    { id: uuid(), obraId, rubroObraId: rubroMA, codigo: 'MA01', descripcion: 'Paredes PB', nivel: 1, unidad: 'M2', cantidad: 200, orden: 5 },
    { id: uuid(), obraId, rubroObraId: rubroMA, codigo: 'MA02', descripcion: 'Tabiques interiores', nivel: 1, unidad: 'M2', cantidad: 80, orden: 6 },
    { id: uuid(), obraId, rubroObraId: rubroMA, codigo: 'MA03', descripcion: 'Durlock cielorraso', nivel: 2, unidad: 'M2', cantidad: 70, orden: 7 },
    { id: uuid(), obraId, rubroObraId: rubroMA, codigo: 'MA04', descripcion: 'Bacha de cocina', nivel: 1, unidad: 'UN', cantidad: 2, orden: 8 },
    // CA00
    { id: uuid(), obraId, rubroObraId: rubroCA, codigo: 'CA01', descripcion: 'Puertas interiores', nivel: 1, unidad: 'UN', cantidad: 7, orden: 9 },
    { id: uuid(), obraId, rubroObraId: rubroCA, codigo: 'CA02', descripcion: 'Ventanas aluminio', nivel: 1, unidad: 'UN', cantidad: 6, orden: 10 },
    { id: uuid(), obraId, rubroObraId: rubroCA, codigo: 'CA03', descripcion: 'Frentes placard', nivel: 1, unidad: 'UN', cantidad: 3, orden: 11 },
    { id: uuid(), obraId, rubroObraId: rubroCA, codigo: 'CA04', descripcion: 'Pisos madera', nivel: 1, unidad: 'M2', cantidad: 100, orden: 12 },
  ];
  await prisma.tarea.createMany({ data: tareas });
  // Asignar padre a tareas nivel 2
  const durlock = await prisma.tarea.findFirst({ where: { codigo: 'MA03' } });
  const tabiques = await prisma.tarea.findFirst({ where: { codigo: 'MA02' } });
  if (durlock && tabiques) {
    await prisma.tarea.update({ where: { id: durlock.id }, data: { padreId: tabiques.id } });
  }
  console.log('✅ 12 tareas en 3 rubros');

  // ── Presupuesto REFERENCIA ──
  const refId = uuid();
  await prisma.presupuesto.create({
    data: {
      id: refId, obraId, tipo: 'REFERENCIA',
      nombre: 'Referencia inicial',
      moneda: 'ARS', fechaPrecio: new Date('2026-05-01'),
      estado: 'VIGENTE',
    },
  });
  // Items de referencia (para HA00 y parte de MA00)
  await prisma.presupuestoItem.createMany({
    data: [
      { id: uuid(), presupuestoId: refId, rubroObraId: rubroHA, tareaId: tareas[0].id, descripcion: 'Platea H21', tipoRecurso: 'MATERIAL', unidad: 'M3', cantidad: 24, precioUnitario: 180000, subtotal: 4320000 },
      { id: uuid(), presupuestoId: refId, rubroObraId: rubroHA, tareaId: tareas[1].id, descripcion: 'Columnas 20x30', tipoRecurso: 'MATERIAL', unidad: 'ML', cantidad: 48, precioUnitario: 35000, subtotal: 1680000 },
      { id: uuid(), presupuestoId: refId, rubroObraId: rubroMA, tareaId: tareas[4].id, descripcion: 'Ladrillo hueco 18', tipoRecurso: 'MATERIAL', unidad: 'M2', cantidad: 200, precioUnitario: 8500, subtotal: 1700000 },
      { id: uuid(), presupuestoId: refId, rubroObraId: rubroCA, tareaId: tareas[8].id, descripcion: 'Puertas placa', tipoRecurso: 'MATERIAL', unidad: 'UN', cantidad: 7, precioUnitario: 120000, subtotal: 840000 },
    ],
  });

  // ── Propuesta NITO (completa pero sin IG00) ──
  const propNitoId = uuid();
  await prisma.presupuesto.create({
    data: {
      id: propNitoId, obraId, tipo: 'PROPUESTA',
      nombre: 'NITO — Propuesta completa',
      contratistaMiembroId: (await prisma.obraMiembro.findFirst({ where: { obraId, usuarioId: constructorId } }))!.id,
      moneda: 'ARS', fechaPrecio: new Date('2026-06-01'),
      estado: 'VIGENTE',
    },
  });
  await prisma.presupuestoItem.createMany({
    data: [
      { id: uuid(), presupuestoId: propNitoId, rubroObraId: rubroHA, descripcion: 'Hormigón armado completo', tipoRecurso: 'MATERIAL', unidad: 'GL', cantidad: 1, precioUnitario: 5200000, subtotal: 5200000 },
      { id: uuid(), presupuestoId: propNitoId, rubroObraId: rubroMA, descripcion: 'Mamposterías completo', tipoRecurso: 'MATERIAL', unidad: 'GL', cantidad: 1, precioUnitario: 2800000, subtotal: 2800000 },
      { id: uuid(), presupuestoId: propNitoId, rubroObraId: rubroCA, descripcion: 'Carpinterías completo', tipoRecurso: 'MATERIAL', unidad: 'GL', cantidad: 1, precioUnitario: 1800000, subtotal: 1800000 },
      // No cotiza IG00 (instalación de gas) — hueco de alcance deliberado
    ],
  });

  // ── Propuesta Juan (incompleta, con "tareas no previstas") ──
  const propJuanId = uuid();
  await prisma.presupuesto.create({
    data: {
      id: propJuanId, obraId, tipo: 'PROPUESTA',
      nombre: 'Juan — Propuesta económica',
      proveedorNombre: 'Juan Carpintero',
      moneda: 'ARS', fechaPrecio: new Date('2026-06-05'),
      estado: 'VIGENTE',
      contratistaMiembroId: null,
    },
  });
  await prisma.presupuestoItem.createMany({
    data: [
      { id: uuid(), presupuestoId: propJuanId, rubroObraId: rubroHA, descripcion: 'HA parcial', tipoRecurso: 'MATERIAL', unidad: 'GL', cantidad: 1, precioUnitario: 4800000, subtotal: 4800000 },
      { id: uuid(), presupuestoId: propJuanId, rubroObraId: rubroCA, descripcion: 'Solo puertas (no ventanas)', tipoRecurso: 'MATERIAL', unidad: 'UN', cantidad: 1, precioUnitario: 900000, subtotal: 900000 },
      // No cotiza MA00 — hueco
    ],
  });

  // ── Adopción: rubro HA00 adoptado de NITO ──
  const adoptadoId = uuid();
  const decididoPor = adminId;
  await prisma.presupuesto.create({
    data: {
      id: adoptadoId, obraId, tipo: 'ADOPTADO',
      nombre: 'Presupuesto adoptado', moneda: 'ARS',
      fechaPrecio: new Date('2026-06-10'), estado: 'ADOPTADO_PARCIAL',
    },
  });
  // Copiar items adoptados de NITO HA00 al ADOPTADO
  const itemsNitoHA = await prisma.presupuestoItem.findMany({
    where: { presupuestoId: propNitoId, rubroObraId: rubroHA },
  });
  for (const item of itemsNitoHA) {
    await prisma.presupuestoItem.create({
      data: {
        id: uuid(), presupuestoId: adoptadoId, rubroObraId: rubroHA,
        descripcion: item.descripcion, tipoRecurso: item.tipoRecurso,
        unidad: item.unidad, cantidad: item.cantidad,
        precioUnitario: item.precioUnitario, subtotal: item.subtotal,
        origen: 'ADOPCION', origenItemId: item.id,
      },
    });
  }
  await prisma.adopcion.create({
    data: {
      id: uuid(), obraId, rubroObraId: rubroHA,
      presupuestoOrigenId: propNitoId,
      decididoPor, fecha: new Date('2026-06-10'),
      nota: 'Mejor precio y cobertura completa',
    },
  });
  // Actualizar NITO a ADOPTADO_PARCIAL
  await prisma.presupuesto.update({
    where: { id: propNitoId },
    data: { estado: 'ADOPTADO_PARCIAL' },
  });
  console.log('✅ Presupuestos: REFERENCIA + 2 propuestas + ADOPTADO parcial');

  // ── Movimientos de caja (6) ──
  const compromiso1Id = uuid();
  await prisma.movimiento.createMany({
    data: [
      { id: compromiso1Id, obraId, rubroObraId: rubroHA, tipo: 'COMPROMISO', fecha: new Date('2026-06-01'), proveedorNombre: 'Corralón San Martín', moneda: 'ARS', importe: 500000, estado: 'VIGENTE' },
      { id: uuid(), obraId, rubroObraId: rubroHA, tipo: 'PAGO', fecha: new Date('2026-06-02'), proveedorNombre: 'Corralón San Martín', moneda: 'ARS', importe: 200000, medioPago: 'TRANSFERENCIA', estado: 'VIGENTE', compromisoId: compromiso1Id },
      { id: uuid(), obraId, rubroObraId: rubroHA, tipo: 'PAGO', fecha: new Date('2026-06-10'), proveedorNombre: 'Corralón San Martín', moneda: 'ARS', importe: 300000, medioPago: 'TRANSFERENCIA', estado: 'VIGENTE', compromisoId: compromiso1Id },
      { id: uuid(), obraId, rubroObraId: rubroMA, tipo: 'COMPROMISO', fecha: new Date('2026-06-05'), proveedorNombre: 'Ladrillera Norte', moneda: 'ARS', importe: 350000, estado: 'VIGENTE' },
      { id: uuid(), obraId, rubroObraId: rubroMA, tipo: 'PAGO', fecha: new Date('2026-06-08'), proveedorNombre: 'Ladrillera Norte', moneda: 'ARS', importe: 350000, medioPago: 'EFECTIVO', estado: 'VIGENTE' },
      { id: uuid(), obraId, rubroObraId: rubroCA, tipo: 'PAGO', fecha: new Date('2026-06-09'), proveedorNombre: 'NITO Construcciones', moneda: 'ARS', importe: 600000, medioPago: 'TRANSFERENCIA', estado: 'VIGENTE', contratistaMiembroId: (await prisma.obraMiembro.findFirst({ where: { obraId, usuarioId: constructorId } }))!.id },
    ],
  });
  console.log('✅ 6 movimientos de caja');

  // ── OC: una aprobada, una pendiente ──
  await prisma.ordenCambio.createMany({
    data: [
      {
        id: uuid(), obraId, numero: 1, titulo: 'Refuerzo platea por terreno',
        motivo: 'IMPREVISTO', impactoCosto: 450000, moneda: 'ARS',
        impactoDias: 5, rubrosAfectados: [rubroHA],
        estado: 'APROBADA', solicitanteId: constructorId,
        resolutorId: adminId, fechaResolucion: new Date('2026-06-03'),
        notaResolucion: 'Aprobado. Necesario por informe de suelo.',
      },
      {
        id: uuid(), obraId, numero: 2, titulo: 'Cambio de ventanas por aluminio premium', descripcion: 'El cliente quiere mejora',
        motivo: 'PEDIDO_COMITENTE', impactoCosto: 120000, moneda: 'ARS',
        impactoDias: 3, rubrosAfectados: [rubroCA],
        estado: 'PENDIENTE', solicitanteId: comitenteId,
      },
    ],
  });
  console.log('✅ 2 órdenes de cambio (1 aprobada + 1 pendiente)');

  // ── Avances ──
  const tareasHa = await prisma.tarea.findMany({ where: { rubroObraId: rubroHA }, take: 4 });
  for (const t of tareasHa) {
    await prisma.avanceRegistro.create({
      data: {
        id: uuid(), tareaId: t.id, obraId, fecha: new Date('2026-06-10'),
        avancePct: 40, nota: 'Avance parcial', registradoPor: profesionalId,
      },
    });
    await prisma.tarea.update({ where: { id: t.id }, data: { avancePct: 40, estado: 'EN_CURSO' } });
  }
  console.log('✅ Avances al 40% en 4 tareas de HA00');

  // ── Eventos ──
  await prisma.evento.createMany({
    data: [
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'obra.creada', payload: { entidad_id: obraId, resumen_humano: 'María creó la obra Vivienda Demo 200 m²' }, fecha: new Date('2026-06-01') },
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'miembro.invitado', payload: { entidad_id: constructorId, resumen_humano: 'NITO Construcciones se sumó como Constructor' }, fecha: new Date('2026-06-01') },
      { id: uuid(), obraId, usuarioId: constructorId, tipo: 'miembro.activado', payload: { entidad_id: constructorId, resumen_humano: 'NITO Construcciones aceptó la invitación' }, fecha: new Date('2026-06-01') },
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'presupuesto.creado', payload: { entidad_id: refId, resumen_humano: 'María cargó el presupuesto de referencia: $8.540.000' }, fecha: new Date('2026-06-01') },
      { id: uuid(), obraId, usuarioId: constructorId, tipo: 'presupuesto.creado', payload: { entidad_id: propNitoId, resumen_humano: 'NITO presentó su propuesta: $9.800.000' }, fecha: new Date('2026-06-02') },
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'presupuesto.creado', payload: { entidad_id: propJuanId, resumen_humano: 'Juan Carpintero presentó propuesta económica: $5.700.000' }, fecha: new Date('2026-06-05') },
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'presupuesto.adoptado_rubro', payload: { entidad_id: rubroHA, resumen_humano: 'Se adoptó HORMIGÓN de NITO por $5.200.000' }, fecha: new Date('2026-06-10') },
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'caja.compromiso_registrado', payload: { entidad_id: compromiso1Id, resumen_humano: 'Compromiso con Corralón San Martín por $500.000 en HA00' }, fecha: new Date('2026-06-01') },
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'caja.pago_registrado', payload: { entidad_id: obraId, resumen_humano: 'Pago parcial a Corralón San Martín por $200.000' }, fecha: new Date('2026-06-02') },
      { id: uuid(), obraId, usuarioId: constructorId, tipo: 'oc.creada', payload: { entidad_id: obraId, resumen_humano: 'NITO creó OC #1: Refuerzo platea por terreno' }, fecha: new Date('2026-06-02') },
      { id: uuid(), obraId, usuarioId: adminId, tipo: 'oc.aprobada', payload: { entidad_id: obraId, resumen_humano: 'María aprobó la OC #1: +$450.000 y +5 días' }, fecha: new Date('2026-06-03') },
      { id: uuid(), obraId, usuarioId: comitenteId, tipo: 'oc.enviada', payload: { entidad_id: obraId, resumen_humano: 'Carlos envió OC #2: Cambio de ventanas premium' }, fecha: new Date('2026-06-10') },
    ],
  });
  console.log('✅ 12 eventos en la bitácora');

  console.log('🎉 Seed completo: obra demo lista para tests de integración');
  console.log(`   admin@demo.obra / demo123`);
  console.log(`   comitente@demo.obra / demo123`);
  console.log(`   pro@demo.obra / demo123`);
  console.log(`   construct@demo.obra / demo123`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
