from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


# ── Obra ──
class ObraCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: str = ""
    presupuesto_total: float = Field(default=0.0, ge=0)
    fecha_inicio: Optional[str] = None
    fecha_fin_prevista: Optional[str] = None


class ObraOut(BaseModel):
    id: int
    token: str
    nombre: str
    descripcion: str
    presupuesto_total: float
    fecha_inicio: Optional[date] = None
    fecha_fin_prevista: Optional[date] = None
    estado: str

    model_config = {"from_attributes": True}


# ── CategoriaPresupuesto ──
class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    monto_presupuestado: float = Field(default=0.0, ge=0)


class CategoriaOut(BaseModel):
    id: int
    obra_id: int
    nombre: str
    monto_presupuestado: float

    model_config = {"from_attributes": True}


# ── ItemPresupuesto ──
class ItemCreate(BaseModel):
    descripcion: str = Field(..., min_length=1, max_length=300)
    cantidad: float = Field(default=1.0, ge=0)
    precio_unitario: float = Field(default=0.0, ge=0)
    tipo: str = "material"


class ItemOut(BaseModel):
    id: int
    categoria_id: int
    descripcion: str
    cantidad: float
    precio_unitario: float
    tipo: str
    total: float

    model_config = {"from_attributes": True}


# ── Proveedor ──
class ProveedorCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    contacto: str = ""
    telefono: str = ""
    email: str = ""
    notas: str = ""


class ProveedorUpdate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    contacto: str = ""
    telefono: str = ""
    email: str = ""
    notas: str = ""


class ProveedorOut(BaseModel):
    id: int
    obra_id: int
    nombre: str
    contacto: str
    telefono: str
    email: str
    notas: str

    model_config = {"from_attributes": True}


# ── Gasto ──
class GastoCreate(BaseModel):
    descripcion: str = Field(..., min_length=1, max_length=300)
    monto: float = Field(..., gt=0)
    fecha: str  # YYYY-MM-DD
    categoria_id: Optional[int] = None
    tipo: str = "material"
    proveedor_id: Optional[int] = None
    comprobante: str = ""


class GastoOut(BaseModel):
    id: int
    obra_id: int
    descripcion: str
    monto: float
    fecha: date
    categoria_id: Optional[int] = None
    tipo: str
    proveedor_id: Optional[int] = None
    comprobante: str
    creada_en: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Panel (comparativa) ──
class CategoriaComparativa(BaseModel):
    id: int
    nombre: str
    presupuestado: float
    gastado: float
    diferencia: float
    porcentaje: float  # 0-100+


class PanelOut(BaseModel):
    obra: ObraOut
    total_presupuestado: float
    total_gastado: float
    saldo: float
    porcentaje_global: float
    categorias: list[CategoriaComparativa]
