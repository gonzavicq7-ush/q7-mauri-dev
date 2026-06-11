# 01 — M0: SHELL, IDENTIDAD, OBRAS Y EQUIPO

**Agente:** A0 · **Bloqueante:** sí (los demás módulos dependen de esto)
**Lee:** 00_ARQUITECTURA_COMUN.md completo antes de empezar.
**Entregables extra de A0:** scaffold del monorepo, `packages/ui` completo
(tokens + componentes sección 7.3 del doc 00), `packages/db` con TODO el schema
de la sección 5 (de todos los módulos, para que nadie migre en paralelo), seeds.

## 1. Objetivo
Que un usuario se registre, cree una obra, invite a su equipo con roles, y que
exista el cascarón de navegación donde los otros 6 módulos enchufan sus rutas.

## 2. Dentro / fuera de alcance
**Dentro:** registro/login email+password, recuperación por email (token, sin
proveedor real: log a consola en dev), CRUD de obra, invitaciones por email/link,
gestión de miembros, shell de navegación, registro de rutas de módulos,
middleware de permisos, campana de notificaciones (lee tabla `evento`).
**Fuera:** OAuth social, 2FA, multi-idioma, facturación/planes, edición de
perfil avanzada.

## 3. Entidades propias
`usuario`, `obra`, `obra_miembro`, `evento` (def. exacta en doc 00 §5.1).

## 4. Endpoints
```
POST /api/v1/auth/registro            {email,nombre,password} → {token,usuario}
POST /api/v1/auth/login               {email,password} → {token,usuario}
POST /api/v1/auth/recuperar           {email} → 204
GET  /api/v1/yo                       → usuario + lista de obras con su rol
POST /api/v1/obras                    {nombre,tipo,pais,moneda_base,superficie_m2?,
                                       presupuesto_objetivo?} → obra
GET  /api/v1/obras/:obraId            → obra (según rol)
PATCH/api/v1/obras/:obraId            (ADMIN; PROFESIONAL solo campos no económicos)
GET  /api/v1/obras/:obraId/miembros
POST /api/v1/obras/:obraId/miembros   {email,rol} → invitación (estado PENDIENTE)
POST /api/v1/invitaciones/:token/aceptar  (crea usuario si no existe → ACTIVO)
DELETE /api/v1/obras/:obraId/miembros/:id (→ estado REVOCADO, nunca borra)
GET  /api/v1/obras/:obraId/eventos    ?desde&tipo&pagina  (feed de notificaciones)
```

## 5. Pantallas
1. **/login, /registro, /recuperar** — tarjeta centrada, logo, sin navegación.
2. **/obras (Mis obras)** — grilla de tarjetas: nombre, tipo, rol propio como
   `BadgeEstado`, mini-resumen (previsto/pagado si M6 ya expone el dato; si no,
   placeholder "—"). CTA "Nueva obra". Estado vacío con ilustración.
3. **/obras/nueva** — `Wizard` 2 pasos: (1) datos básicos, (2) "¿Quién más
   participa?" con filas email+rol opcionales (se puede saltar).
4. **/obras/:id/equipo** — tabla de miembros: avatar, nombre/email, rol,
   estado (`PENDIENTE` con botón "Reenviar invitación"), acciones revocar
   (ModalConfirmar). Botón "Invitar". Texto explicativo de qué ve cada rol
   (resumen humano de la matriz §4 doc 00).
5. **/invitacion/:token** — pantalla de aceptación: muestra obra, rol ofrecido,
   quién invita; pide crear cuenta o loguearse.
6. **Shell** — según doc 00 §7.2. Incluye: selector de obra (combobox con
   búsqueda), campana con contador de eventos no vistos (marca visto al abrir,
   persistir `ultimo_visto_en` por usuario+obra en localStorage), menú avatar
   (cerrar sesión).

## 6. Reglas de negocio (numeradas, testear cada una)
- **R1.** Quien crea la obra recibe rol ADMIN_OBRA automáticamente y es
  inmutable (no se puede revocar al último admin).
- **R2.** Un email puede estar invitado a una obra con un solo rol activo a la
  vez; reinvitar con otro rol revoca el anterior previa confirmación.
- **R3.** Invitación expira a los 14 días; aceptar una expirada devuelve
  `INVITACION_EXPIRADA` y la UI ofrece "pedir que te reinviten".
- **R4.** `moneda_base` no se puede cambiar si existen presupuestos o
  movimientos (consultar existencia, devolver `MONEDA_BLOQUEADA`).
- **R5.** Todo endpoint de obra pasa por `requiereRol`; un usuario sin
  membresía ACTIVA recibe 403 sin filtrar la existencia de la obra (404).
- **R6.** Eventos emitidos: `obra.creada`, `miembro.invitado`,
  `miembro.activado` con `resumen_humano` ("Pablo se sumó como Constructor").

## 7. Criterios de aceptación
- [ ] Flujo completo demo: registro → crear obra → invitar 3 roles → aceptar
  invitación en ventana incógnito → cada rol ve solo sus pestañas del shell.
- [ ] `registerModuleRoutes()` documentado con ejemplo y usado por un módulo
  dummy de prueba.
- [ ] Seeds corren y dejan la obra demo navegable.
- [ ] Matriz de permisos cubierta por tests (al menos 1 caso permitido y 1
  denegado por rol y recurso propio).
