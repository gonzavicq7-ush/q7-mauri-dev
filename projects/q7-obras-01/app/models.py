import uuid
from datetime import date, datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, func,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base


def _gen_token() -> str:
    return uuid.uuid4().hex


class Obra(Base):
    __tablename__ = "obras"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, default=_gen_token, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, default="")
    presupuesto_total: Mapped[float] = mapped_column(Float, default=0.0)
    fecha_inicio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_fin_prevista: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="planificada")
    creada_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    categorias: Mapped[List["CategoriaPresupuesto"]] = relationship(
        back_populates="obra", cascade="all, delete-orphan"
    )
    gastos: Mapped[List["Gasto"]] = relationship(
        back_populates="obra", cascade="all, delete-orphan"
    )
    proveedores: Mapped[List["Proveedor"]] = relationship(
        back_populates="obra", cascade="all, delete-orphan"
    )


class CategoriaPresupuesto(Base):
    __tablename__ = "categorias_presupuesto"

    id: Mapped[int] = mapped_column(primary_key=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obras.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    monto_presupuestado: Mapped[float] = mapped_column(Float, default=0.0)

    obra: Mapped["Obra"] = relationship(back_populates="categorias")
    items: Mapped[List["ItemPresupuesto"]] = relationship(
        back_populates="categoria", cascade="all, delete-orphan"
    )
    gastos: Mapped[List["Gasto"]] = relationship(back_populates="categoria")


class ItemPresupuesto(Base):
    __tablename__ = "items_presupuesto"

    id: Mapped[int] = mapped_column(primary_key=True)
    categoria_id: Mapped[int] = mapped_column(
        ForeignKey("categorias_presupuesto.id"), nullable=False
    )
    descripcion: Mapped[str] = mapped_column(String(300), nullable=False)
    cantidad: Mapped[float] = mapped_column(Float, default=1.0)
    precio_unitario: Mapped[float] = mapped_column(Float, default=0.0)
    tipo: Mapped[str] = mapped_column(String(30), default="material")

    categoria: Mapped["CategoriaPresupuesto"] = relationship(back_populates="items")

    @property
    def total(self) -> float:
        return self.cantidad * self.precio_unitario


class Proveedor(Base):
    __tablename__ = "proveedores"

    id: Mapped[int] = mapped_column(primary_key=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obras.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    contacto: Mapped[Optional[str]] = mapped_column(String(200), default="")
    telefono: Mapped[Optional[str]] = mapped_column(String(50), default="")
    email: Mapped[Optional[str]] = mapped_column(String(200), default="")
    notas: Mapped[Optional[str]] = mapped_column(Text, default="")

    obra: Mapped["Obra"] = relationship(back_populates="proveedores")
    gastos: Mapped[List["Gasto"]] = relationship(back_populates="proveedor")


class Gasto(Base):
    __tablename__ = "gastos"

    id: Mapped[int] = mapped_column(primary_key=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obras.id"), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(300), nullable=False)
    monto: Mapped[float] = mapped_column(Float, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    categoria_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categorias_presupuesto.id"), nullable=True
    )
    tipo: Mapped[str] = mapped_column(String(30), default="material")
    proveedor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("proveedores.id"), nullable=True
    )
    comprobante: Mapped[Optional[str]] = mapped_column(String(500), default="")
    creada_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    obra: Mapped["Obra"] = relationship(back_populates="gastos")
    categoria: Mapped[Optional["CategoriaPresupuesto"]] = relationship(
        back_populates="gastos"
    )
    proveedor: Mapped[Optional["Proveedor"]] = relationship(back_populates="gastos")
