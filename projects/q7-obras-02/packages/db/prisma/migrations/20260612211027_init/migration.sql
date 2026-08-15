-- CreateEnum
CREATE TYPE "TipoObra" AS ENUM ('VIVIENDA', 'REFORMA', 'COMERCIO', 'CONDOMINIO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoObra" AS ENUM ('ACTIVA', 'PAUSADA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "RolObra" AS ENUM ('ADMIN_OBRA', 'COMITENTE', 'PROFESIONAL', 'CONSTRUCTOR', 'PROVEEDOR');

-- CreateEnum
CREATE TYPE "EstadoMiembro" AS ENUM ('PENDIENTE', 'ACTIVO', 'REVOCADO');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Unidad" AS ENUM ('GL', 'M2', 'M3', 'ML', 'UN', 'KG', 'HS', 'DIA');

-- CreateEnum
CREATE TYPE "OrigenRubro" AS ENUM ('CATALOGO', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "TipoPresupuesto" AS ENUM ('REFERENCIA', 'PROPUESTA', 'ADOPTADO');

-- CreateEnum
CREATE TYPE "EstadoPresupuesto" AS ENUM ('BORRADOR', 'VIGENTE', 'ADOPTADO_PARCIAL', 'ADOPTADO_TOTAL', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "TipoRecurso" AS ENUM ('MO', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO', 'OTRO');

-- CreateEnum
CREATE TYPE "OrigenItem" AS ENUM ('MANUAL', 'IMPORTACION', 'ADOPCION', 'ORDEN_CAMBIO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('COMPROMISO', 'PAGO');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('VIGENTE', 'ANULADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoIndice" AS ENUM ('INFLACION_MENSUAL', 'TC_USD');

-- CreateEnum
CREATE TYPE "MotivoOC" AS ENUM ('PEDIDO_COMITENTE', 'IMPREVISTO', 'ERROR_PROYECTO', 'MEJORA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoOC" AS ENUM ('BORRADOR', 'PENDIENTE', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" VARCHAR(500),
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "tipo" "TipoObra" NOT NULL DEFAULT 'OTRO',
    "direccion" VARCHAR(500),
    "pais" CHAR(2) NOT NULL,
    "moneda_base" CHAR(3) NOT NULL,
    "superficie_m2" DECIMAL(10,2),
    "presupuesto_objetivo" DECIMAL(14,2),
    "estado" "EstadoObra" NOT NULL DEFAULT 'ACTIVA',
    "creador_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_miembro" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "usuario_id" UUID,
    "email_invitado" VARCHAR(255),
    "rol" "RolObra" NOT NULL,
    "estado" "EstadoMiembro" NOT NULL DEFAULT 'PENDIENTE',
    "token_invitacion" VARCHAR(64),
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "obra_miembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubro_catalogo" (
    "codigo" CHAR(4) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "rubro_catalogo_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "rubro_obra" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "codigo" CHAR(4) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "orden" INTEGER NOT NULL,
    "origen" "OrigenRubro" NOT NULL DEFAULT 'CATALOGO',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "rubro_obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "rubro_obra_id" UUID NOT NULL,
    "padre_id" UUID,
    "codigo" VARCHAR(8) NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "unidad" "Unidad" NOT NULL DEFAULT 'UN',
    "cantidad" DECIMAL(14,4),
    "orden" INTEGER NOT NULL,
    "fecha_inicio" DATE,
    "dias_habiles_prev" INTEGER,
    "fecha_fin_prevista" DATE,
    "dias_perdidos" INTEGER NOT NULL DEFAULT 0,
    "fecha_fin_nueva" DATE,
    "fecha_fin_real" DATE,
    "avance_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuesto" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "tipo" "TipoPresupuesto" NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "contratista_miembro_id" UUID,
    "proveedor_nombre" VARCHAR(255),
    "moneda" CHAR(3) NOT NULL,
    "fecha_precio" DATE NOT NULL,
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuesto_item" (
    "id" UUID NOT NULL,
    "presupuesto_id" UUID NOT NULL,
    "rubro_obra_id" UUID NOT NULL,
    "tarea_id" UUID,
    "descripcion" VARCHAR(500) NOT NULL,
    "tipo_recurso" "TipoRecurso" NOT NULL DEFAULT 'MATERIAL',
    "unidad" "Unidad" NOT NULL DEFAULT 'UN',
    "cantidad" DECIMAL(14,4) NOT NULL,
    "precio_unitario" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "incluye" VARCHAR(1000),
    "excluye" VARCHAR(1000),
    "no_cotizado" BOOLEAN NOT NULL DEFAULT false,
    "origen" "OrigenItem" NOT NULL DEFAULT 'MANUAL',
    "origen_item_id" UUID,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "presupuesto_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adopcion" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "rubro_obra_id" UUID NOT NULL,
    "presupuesto_origen_id" UUID NOT NULL,
    "decidido_por" UUID NOT NULL,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "adopcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "rubro_obra_id" UUID NOT NULL,
    "tarea_id" UUID,
    "tipo" "TipoMovimiento" NOT NULL,
    "compromiso_id" UUID,
    "fecha" DATE NOT NULL,
    "proveedor_nombre" VARCHAR(255) NOT NULL,
    "contratista_miembro_id" UUID,
    "descripcion" VARCHAR(500),
    "moneda" CHAR(3) NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "comprobante_url" VARCHAR(1000),
    "medio_pago" "MedioPago",
    "orden_cambio_id" UUID,
    "estado" "EstadoMovimiento" NOT NULL DEFAULT 'VIGENTE',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indice" (
    "tipo" "TipoIndice" NOT NULL,
    "fecha" DATE NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "indice_pkey" PRIMARY KEY ("tipo","fecha")
);

-- CreateTable
CREATE TABLE "orden_cambio" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "motivo" "MotivoOC" NOT NULL DEFAULT 'OTRO',
    "impacto_costo" DECIMAL(14,2) NOT NULL,
    "moneda" CHAR(3) NOT NULL,
    "impacto_dias" INTEGER NOT NULL DEFAULT 0,
    "rubros_afectados" UUID[],
    "estado" "EstadoOC" NOT NULL DEFAULT 'BORRADOR',
    "solicitante_id" UUID NOT NULL,
    "resolutor_id" UUID,
    "fecha_resolucion" TIMESTAMPTZ,
    "nota_resolucion" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "eliminado_en" TIMESTAMPTZ,

    CONSTRAINT "orden_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_cambio_item" (
    "id" UUID NOT NULL,
    "orden_cambio_id" UUID NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "tipo_recurso" "TipoRecurso" NOT NULL DEFAULT 'MATERIAL',
    "unidad" "Unidad" NOT NULL DEFAULT 'UN',
    "cantidad" DECIMAL(14,4) NOT NULL,
    "precio_unitario" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "orden_cambio_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avance_registro" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "avance_pct" DECIMAL(5,2) NOT NULL,
    "nota" VARCHAR(1000),
    "foto_url" VARCHAR(1000),
    "registrado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avance_registro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_semanal" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "semana_inicio" DATE NOT NULL,
    "generado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contenido" JSONB NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reporte_semanal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "obra_miembro_token_invitacion_key" ON "obra_miembro"("token_invitacion");

-- CreateIndex
CREATE UNIQUE INDEX "obra_miembro_obra_id_usuario_id_rol_key" ON "obra_miembro"("obra_id", "usuario_id", "rol");

-- CreateIndex
CREATE INDEX "evento_obra_id_fecha_idx" ON "evento"("obra_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "rubro_obra_obra_id_codigo_key" ON "rubro_obra"("obra_id", "codigo");

-- CreateIndex
CREATE INDEX "tarea_obra_id_rubro_obra_id_idx" ON "tarea"("obra_id", "rubro_obra_id");

-- CreateIndex
CREATE INDEX "movimiento_obra_id_fecha_idx" ON "movimiento"("obra_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "orden_cambio_obra_id_numero_key" ON "orden_cambio"("obra_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_semanal_obra_id_semana_inicio_key" ON "reporte_semanal"("obra_id", "semana_inicio");

-- AddForeignKey
ALTER TABLE "obra" ADD CONSTRAINT "obra_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_miembro" ADD CONSTRAINT "obra_miembro_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_miembro" ADD CONSTRAINT "obra_miembro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubro_obra" ADD CONSTRAINT "rubro_obra_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_rubro_obra_id_fkey" FOREIGN KEY ("rubro_obra_id") REFERENCES "rubro_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto" ADD CONSTRAINT "presupuesto_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto" ADD CONSTRAINT "presupuesto_contratista_miembro_id_fkey" FOREIGN KEY ("contratista_miembro_id") REFERENCES "obra_miembro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_item" ADD CONSTRAINT "presupuesto_item_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "presupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_item" ADD CONSTRAINT "presupuesto_item_rubro_obra_id_fkey" FOREIGN KEY ("rubro_obra_id") REFERENCES "rubro_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_item" ADD CONSTRAINT "presupuesto_item_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_item" ADD CONSTRAINT "presupuesto_item_origen_item_id_fkey" FOREIGN KEY ("origen_item_id") REFERENCES "presupuesto_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adopcion" ADD CONSTRAINT "adopcion_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adopcion" ADD CONSTRAINT "adopcion_rubro_obra_id_fkey" FOREIGN KEY ("rubro_obra_id") REFERENCES "rubro_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adopcion" ADD CONSTRAINT "adopcion_presupuesto_origen_id_fkey" FOREIGN KEY ("presupuesto_origen_id") REFERENCES "presupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adopcion" ADD CONSTRAINT "adopcion_decidido_por_fkey" FOREIGN KEY ("decidido_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_rubro_obra_id_fkey" FOREIGN KEY ("rubro_obra_id") REFERENCES "rubro_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_compromiso_id_fkey" FOREIGN KEY ("compromiso_id") REFERENCES "movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_contratista_miembro_id_fkey" FOREIGN KEY ("contratista_miembro_id") REFERENCES "obra_miembro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_orden_cambio_id_fkey" FOREIGN KEY ("orden_cambio_id") REFERENCES "orden_cambio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_cambio" ADD CONSTRAINT "orden_cambio_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_cambio" ADD CONSTRAINT "orden_cambio_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_cambio" ADD CONSTRAINT "orden_cambio_resolutor_id_fkey" FOREIGN KEY ("resolutor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_cambio_item" ADD CONSTRAINT "orden_cambio_item_orden_cambio_id_fkey" FOREIGN KEY ("orden_cambio_id") REFERENCES "orden_cambio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avance_registro" ADD CONSTRAINT "avance_registro_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avance_registro" ADD CONSTRAINT "avance_registro_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avance_registro" ADD CONSTRAINT "avance_registro_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_semanal" ADD CONSTRAINT "reporte_semanal_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
