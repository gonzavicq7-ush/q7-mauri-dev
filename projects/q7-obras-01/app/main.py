"""Q7 Obras — FastAPI application with all MVP routes."""

from datetime import date, datetime
from typing import Optional
from fastapi import FastAPI, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import desc
import os

from app.database import engine, get_db, Base
from app.models import (
    Obra, CategoriaPresupuesto, ItemPresupuesto,
    Proveedor, Gasto,
)
from app.schemas import PanelOut, ObraOut, CategoriaComparativa

# ── Create tables ──
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Q7 Obras", version="0.1.0")

# Templates setup
from fastapi.templating import Jinja2Templates
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Custom Jinja2 filters
templates.env.filters["min"] = lambda seq: min(seq)
templates.env.filters["round"] = lambda val, prec=0: round(val, prec)

# ── Helpers ──
def _format_money(val: float) -> str:
    """Format as Chilean-style currency: 1.500.000"""
    return f"{int(val):,}".replace(",", ".")

def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    return datetime.strptime(s, "%Y-%m-%d").date()

def _get_obra_or_404(token: str, db: Session) -> Obra:
    obra = db.query(Obra).filter(Obra.token == token).first()
    if not obra:
        raise HTTPException(status_code=404, detail="Obra no encontrada")
    return obra

def _build_panel(obra: Obra, db: Session) -> dict:
    """Build panel data for the obra."""
    categorias_db = db.query(CategoriaPresupuesto).filter(
        CategoriaPresupuesto.obra_id == obra.id
    ).all()

    total_presup = sum((c.monto_presupuestado for c in categorias_db), 0.0)
    total_gastado_val = sum(
        (g.monto for g in obra.gastos if g.categoria_id is not None), 0.0
    )
    saldo = total_presup - total_gastado_val
    pct = (total_gastado_val / total_presup * 100) if total_presup > 0 else 0

    comps = []
    for cat in categorias_db:
        gastado_cat = sum(
            (g.monto for g in obra.gastos if g.categoria_id == cat.id), 0.0
        )
        cat_pct = (gastado_cat / cat.monto_presupuestado * 100) if cat.monto_presupuestado > 0 else 0
        comps.append({
            "id": cat.id,
            "nombre": cat.nombre,
            "presupuestado": cat.monto_presupuestado,
            "gastado": gastado_cat,
            "diferencia": cat.monto_presupuestado - gastado_cat,
            "porcentaje": round(cat_pct, 1),
            "excedido": gastado_cat > cat.monto_presupuestado,
        })

    return {
        "obra": obra,
        "total_presupuestado": total_presup,
        "total_gastado": total_gastado_val,
        "saldo": saldo,
        "porcentaje_global": round(pct, 1),
        "categorias": comps,
        "format_money": _format_money,
        "gastos": sorted(obra.gastos, key=lambda g: g.fecha, reverse=True),
        "proveedores": obra.proveedores,
        "categorias_db": categorias_db,
    }


# ═══════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════

# ── Landing / Home ──
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})


# ── HU-1: Crear obra ──
@app.post("/obras", response_class=HTMLResponse)
def crear_obra(
    request: Request,
    nombre: str = Form(...),
    presupuesto_total: float = Form(0.0),
    fecha_inicio: Optional[str] = Form(None),
    fecha_fin_prevista: Optional[str] = Form(None),
    descripcion: str = Form(""),
    db: Session = Depends(get_db),
):
    obra = Obra(
        nombre=nombre,
        descripcion=descripcion,
        presupuesto_total=presupuesto_total,
        fecha_inicio=_parse_date(fecha_inicio),
        fecha_fin_prevista=_parse_date(fecha_fin_prevista),
        estado="planificada",
    )
    db.add(obra)
    db.commit()
    db.refresh(obra)
    return RedirectResponse(url=f"/obras/{obra.token}", status_code=303)


# ── HU-4: Panel principal ──
@app.get("/obras/{token}", response_class=HTMLResponse)
def panel_obra(request: Request, token: str, db: Session = Depends(get_db)):
    obra = _get_obra_or_404(token, db)
    data = _build_panel(obra, db)
    data["request"] = request
    return templates.TemplateResponse("panel.html", data)


# ═══════════════════════════════════════════
#  HU-2: Presupuesto (categorías + items)
# ═══════════════════════════════════════════

@app.get("/obras/{token}/presupuesto", response_class=HTMLResponse)
def presupuesto_page(request: Request, token: str, db: Session = Depends(get_db)):
    obra = _get_obra_or_404(token, db)
    categorias = db.query(CategoriaPresupuesto).filter(
        CategoriaPresupuesto.obra_id == obra.id
    ).all()

    # For each category, compute gastado from related expenses
    cat_data = []
    for c in categorias:
        gastado = sum(
            (g.monto for g in obra.gastos if g.categoria_id == c.id), 0.0
        )
        cat_data.append({
            "cat": c,
            "items": c.items,
            "gastado": gastado,
            "total_items": sum((it.total for it in c.items), 0.0),
        })

    return templates.TemplateResponse("presupuesto.html", {
        "request": request,
        "obra": obra,
        "cat_data": cat_data,
        "format_money": _format_money,
    })


@app.post("/obras/{token}/presupuesto/categoria", response_class=HTMLResponse)
def crear_categoria(
    request: Request,
    token: str,
    nombre: str = Form(...),
    monto_presupuestado: float = Form(0.0),
    db: Session = Depends(get_db),
):
    obra = _get_obra_or_404(token, db)
    cat = CategoriaPresupuesto(
        obra_id=obra.id, nombre=nombre, monto_presupuestado=monto_presupuestado
    )
    db.add(cat)
    db.commit()
    return RedirectResponse(url=f"/obras/{token}/presupuesto", status_code=303)


@app.post("/obras/{token}/presupuesto/categoria/{cat_id}/item", response_class=HTMLResponse)
def crear_item(
    request: Request,
    token: str,
    cat_id: int,
    descripcion: str = Form(...),
    cantidad: float = Form(1.0),
    precio_unitario: float = Form(0.0),
    tipo: str = Form("material"),
    db: Session = Depends(get_db),
):
    obra = _get_obra_or_404(token, db)
    cat = db.query(CategoriaPresupuesto).filter(
        CategoriaPresupuesto.id == cat_id,
        CategoriaPresupuesto.obra_id == obra.id,
    ).first()
    if not cat:
        raise HTTPException(404, "Categoría no encontrada")

    item = ItemPresupuesto(
        categoria_id=cat.id,
        descripcion=descripcion,
        cantidad=cantidad,
        precio_unitario=precio_unitario,
        tipo=tipo,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url=f"/obras/{token}/presupuesto", status_code=303)


@app.post("/obras/{token}/presupuesto/categoria/{cat_id}/delete")
def eliminar_categoria(
    token: str, cat_id: int, db: Session = Depends(get_db)
):
    obra = _get_obra_or_404(token, db)
    cat = db.query(CategoriaPresupuesto).filter(
        CategoriaPresupuesto.id == cat_id,
        CategoriaPresupuesto.obra_id == obra.id,
    ).first()
    if not cat:
        raise HTTPException(404, "Categoría no encontrada")
    db.delete(cat)
    db.commit()
    return RedirectResponse(url=f"/obras/{token}/presupuesto", status_code=303)


@app.post("/obras/{token}/presupuesto/item/{item_id}/delete")
def eliminar_item(
    token: str, item_id: int, db: Session = Depends(get_db)
):
    obra = _get_obra_or_404(token, db)
    item = db.query(ItemPresupuesto).join(CategoriaPresupuesto).filter(
        ItemPresupuesto.id == item_id,
        CategoriaPresupuesto.obra_id == obra.id,
    ).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    db.delete(item)
    db.commit()
    return RedirectResponse(url=f"/obras/{token}/presupuesto", status_code=303)


# ═══════════════════════════════════════════
#  HU-3: Registrar gastos
# ═══════════════════════════════════════════

@app.get("/obras/{token}/gastos/nuevo", response_class=HTMLResponse)
def gasto_form(request: Request, token: str, db: Session = Depends(get_db)):
    obra = _get_obra_or_404(token, db)
    categorias = db.query(CategoriaPresupuesto).filter(
        CategoriaPresupuesto.obra_id == obra.id
    ).all()
    proveedores = db.query(Proveedor).filter(
        Proveedor.obra_id == obra.id
    ).order_by(Proveedor.nombre).all()
    return templates.TemplateResponse("gasto_form.html", {
        "request": request,
        "obra": obra,
        "categorias": categorias,
        "proveedores": proveedores,
        "hoy": date.today().isoformat(),
    })


@app.post("/obras/{token}/gastos", response_class=HTMLResponse)
def crear_gasto(
    request: Request,
    token: str,
    descripcion: str = Form(...),
    monto: float = Form(...),
    fecha: str = Form(...),
    categoria_id: Optional[int] = Form(None),
    tipo: str = Form("material"),
    proveedor_id: Optional[int] = Form(None),
    comprobante: str = Form(""),
    db: Session = Depends(get_db),
):
    obra = _get_obra_or_404(token, db)

    # If proveedor_id is 0 or empty, treat as None
    if proveedor_id is not None and proveedor_id <= 0:
        proveedor_id = None
    if categoria_id is not None and categoria_id <= 0:
        categoria_id = None

    gasto = Gasto(
        obra_id=obra.id,
        descripcion=descripcion,
        monto=monto,
        fecha=_parse_date(fecha),
        categoria_id=categoria_id,
        tipo=tipo,
        proveedor_id=proveedor_id,
        comprobante=comprobante,
    )
    db.add(gasto)
    db.commit()

    # Update obra estado if needed
    if obra.estado == "planificada":
        obra.estado = "en_curso"
        db.commit()

    return RedirectResponse(url=f"/obras/{token}", status_code=303)


# ═══════════════════════════════════════════
#  HU-5: Lista de gastos
# ═══════════════════════════════════════════

@app.get("/obras/{token}/gastos", response_class=HTMLResponse)
def lista_gastos(
    request: Request,
    token: str,
    categoria: Optional[int] = None,
    db: Session = Depends(get_db),
):
    obra = _get_obra_or_404(token, db)
    query = db.query(Gasto).filter(Gasto.obra_id == obra.id)
    if categoria:
        query = query.filter(Gasto.categoria_id == categoria)
    gastos = query.order_by(desc(Gasto.fecha)).all()

    categorias = db.query(CategoriaPresupuesto).filter(
        CategoriaPresupuesto.obra_id == obra.id
    ).all()

    return templates.TemplateResponse("gasto_list.html", {
        "request": request,
        "obra": obra,
        "gastos": gastos,
        "categorias": categorias,
        "filtro_categoria": categoria,
        "format_money": _format_money,
    })


# ═══════════════════════════════════════════
#  HU-6: Proveedores
# ═══════════════════════════════════════════

@app.get("/obras/{token}/proveedores", response_class=HTMLResponse)
def proveedores_page(request: Request, token: str, db: Session = Depends(get_db)):
    obra = _get_obra_or_404(token, db)
    proveedores = db.query(Proveedor).filter(
        Proveedor.obra_id == obra.id
    ).order_by(Proveedor.nombre).all()

    # Count gastos per proveedor
    prov_data = []
    for p in proveedores:
        num_gastos = db.query(Gasto).filter(Gasto.proveedor_id == p.id).count()
        prov_data.append({"prov": p, "num_gastos": num_gastos})

    return templates.TemplateResponse("proveedores.html", {
        "request": request,
        "obra": obra,
        "prov_data": prov_data,
        "format_money": _format_money,
    })


@app.post("/obras/{token}/proveedores", response_class=HTMLResponse)
def crear_proveedor(
    request: Request,
    token: str,
    nombre: str = Form(...),
    contacto: str = Form(""),
    telefono: str = Form(""),
    email: str = Form(""),
    notas: str = Form(""),
    db: Session = Depends(get_db),
):
    obra = _get_obra_or_404(token, db)
    prov = Proveedor(
        obra_id=obra.id,
        nombre=nombre,
        contacto=contacto,
        telefono=telefono,
        email=email,
        notas=notas,
    )
    db.add(prov)
    db.commit()
    return RedirectResponse(url=f"/obras/{token}/proveedores", status_code=303)


@app.post("/obras/{token}/proveedores/{prov_id}/edit")
def editar_proveedor(
    token: str,
    prov_id: int,
    nombre: str = Form(...),
    contacto: str = Form(""),
    telefono: str = Form(""),
    email: str = Form(""),
    notas: str = Form(""),
    db: Session = Depends(get_db),
):
    obra = _get_obra_or_404(token, db)
    prov = db.query(Proveedor).filter(
        Proveedor.id == prov_id,
        Proveedor.obra_id == obra.id,
    ).first()
    if not prov:
        raise HTTPException(404, "Proveedor no encontrado")
    prov.nombre = nombre
    prov.contacto = contacto
    prov.telefono = telefono
    prov.email = email
    prov.notas = notas
    db.commit()
    return RedirectResponse(url=f"/obras/{token}/proveedores", status_code=303)


@app.post("/obras/{token}/proveedores/{prov_id}/delete")
def eliminar_proveedor(
    token: str, prov_id: int, db: Session = Depends(get_db)
):
    obra = _get_obra_or_404(token, db)
    prov = db.query(Proveedor).filter(
        Proveedor.id == prov_id,
        Proveedor.obra_id == obra.id,
    ).first()
    if not prov:
        raise HTTPException(404, "Proveedor no encontrado")
    # Unlink gastos from this proveedor
    db.query(Gasto).filter(Gasto.proveedor_id == prov_id).update(
        {Gasto.proveedor_id: None}
    )
    db.delete(prov)
    db.commit()
    return RedirectResponse(url=f"/obras/{token}/proveedores", status_code=303)
