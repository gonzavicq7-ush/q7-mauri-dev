# 06 — M5: PLAZOS Y AVANCE

**Agente:** A5 · **Depende de:** M0, M1 (los campos de plazos viven en `tarea`;
M5 es su dueño funcional). Recibe escritura de M4 (`dias_perdidos` por OC).
**Consumido por:** M6 (curva, % avance global, alertas de demora).

## 1. Objetivo
Llevar las fechas de la obra con la lógica probada de las planillas reales del
proyecto (días hábiles, días perdidos, nueva fecha, demora): para cada tarea
**cuándo empieza, cuánto debía durar, cuántos días se perdieron, cuándo termina
ahora y cuán avanzada está**, con curva prevista vs real simple y honesta.

## 2. Dentro / fuera
**Dentro:** edición de plazos por tarea (inicio, días hábiles previstos),
cálculo de fecha fin prevista y fecha fin nueva, registro de días perdidos con
motivo, registro de avance % con nota y foto, vista Gantt simplificada (barras
por tarea, sin dependencias), curva S prevista vs real, finalización de tarea.
**Fuera:** dependencias entre tareas y ruta crítica (v2), calendarios laborales
configurables (MVP: hábiles = lunes a viernes, sin feriados — documentar),
recursos asignados, replanificación masiva.

## 3. Entidades propias
Campos de plazos en `tarea` + `avance_registro` (doc 00 §5.2 y 5.6).

## 4. Endpoints
```
GET   /api/v1/obras/:obraId/plazos                  → árbol de tareas con plazos,
      rollup por rubro (R4) y datos de curva (R6)
PATCH /api/v1/obras/:obraId/tareas/:id/plazos       {fecha_inicio?,dias_habiles_prev?}
POST  /api/v1/obras/:obraId/tareas/:id/dias-perdidos {dias (+/-), motivo} 
      → acumula en dias_perdidos, registra evento con motivo
POST  /api/v1/obras/:obraId/tareas/:id/avance       {avance_pct,nota?,foto?}
      → crea avance_registro y actualiza tarea.avance_pct
POST  /api/v1/obras/:obraId/tareas/:id/finalizar    {fecha_fin_real} → estado
      FINALIZADA, avance 100
GET   /api/v1/obras/:obraId/tareas/:id/historial-avance → avance_registro[]
```

### Cálculos (server-side, `plazos/calculos.ts`)
```
fecha_fin_prevista = fecha_inicio + dias_habiles_prev (hábiles L-V)
fecha_fin_nueva    = fecha_fin_prevista + dias_perdidos (hábiles)
demora(tarea)      = dias hábiles entre fin_prevista y (fecha_fin_real | hoy si
                     vencida y no finalizada) ; 0 si terminó a tiempo
avance_rubro       = promedio ponderado por dias_habiles_prev de sus tareas hoja
curva_prevista(t)  = Σ dias_habiles_prev de tareas cuya fin_prevista ≤ t ÷ total
curva_real(t)      = Σ (dias_habiles_prev × avance_pct en t) ÷ total
                     (avance en t = último avance_registro ≤ t)
```

## 5. Pantallas
1. **/obras/:id/plazos** — cabecera: fecha inicio de obra (mín. de tareas),
   fin previsto, fin proyectado (con días perdidos), avance global %, badge
   "X días de demora acumulada" (peligro si >0). Pestañas:
   - **Cronograma:** Gantt simplificado — filas = tareas agrupadas por rubro
     colapsable; barra gris = previsto, superpuesta barra primaria = avance,
     extensión rayada ámbar = días perdidos; línea vertical "hoy". Tooltip por
     barra con todas las fechas. Zoom semana/mes. Mobile: lista (pestaña tabla).
   - **Tabla:** columnas inicio | días prev. | fin previsto | días perdidos |
     fin nuevo | avance % (editable con slider/stepper) | estado. Edición
     inline de inicio y días previstos.
   - **Curva:** gráfico de líneas curva prevista vs real (Recharts), eje x
     semanas, con anotación de OCs aprobadas que sumaron días.
2. **Drawer de tarea** — al click: ficha con plazos, botones "Registrar avance"
   (slider 0-100 + nota + foto), "Cargar días perdidos" (stepper + motivo
   obligatorio), "Finalizar", e historial de avances con fotos en miniatura.
3. **Carga rápida de avance (mobile-first):** desde el listado, swipe o botón
   por tarea EN_CURSO abre directamente el registro de avance con cámara.

## 6. Reglas de negocio
- **R1.** Solo tareas hoja (sin hijos) llevan plazos y avance; padres y rubros
  muestran rollup calculado, no editable.
- **R2.** `avance_pct` nuevo no puede ser menor al vigente (corrección = nota
  explicativa obligatoria con flag `es_correccion`, permitida solo a
  ADMIN/PROFESIONAL).
- **R3.** Tarea con avance > 0 pasa sola a EN_CURSO; finalizar exige avance
  100 (el endpoint lo fuerza) y `fecha_fin_real`.
- **R4.** Días perdidos aceptan negativo (recupero) pero el acumulado nunca
  baja de 0. Motivo obligatorio siempre; los que provienen de OC llevan motivo
  autogenerado "OC #n" (escritura de M4, este módulo solo la refleja).
- **R5.** Eventos: `plazos.avance_registrado` (resumen: "Mampostería PB al
  60%"), `plazos.dias_perdidos` (con motivo), `plazos.tarea_finalizada`.
  Además, al detectar en lectura una tarea vencida no finalizada por primera
  vez, emitir `plazos.dias_perdidos` NO — en cambio M6 la detecta como alerta
  (no duplicar fuente de verdad; documentado para A6).
- **R6.** Curvas devueltas por la API como series `[{fecha, prevista, real}]`
  semanales desde inicio de obra hasta max(fin_nueva, hoy).
- **R7.** Permisos: CONSTRUCTOR registra avance solo en tareas de rubros donde
  tiene adopciones o movimientos a su nombre (consulta a M2/M3 read-only); si
  no se puede determinar, puede registrar avance en cualquier tarea pero no
  editar plazos (regla simple MVP — documentar en DECISIONES.md cuál aplicó).

## 7. Criterios de aceptación
- [ ] Demo: cargar inicio y duración de 12 tareas → Gantt y fechas correctas
  (verificar cálculo de hábiles con un caso que cruce fin de semana).
- [ ] Sumar 5 días perdidos por OC (vía M4) → fin nuevo se corre y la curva
  muestra la anotación.
- [ ] Registrar avances en 3 fechas distintas → curva real escalona bien.
- [ ] Intentar bajar avance sin ser ADMIN → bloqueado.
- [ ] Finalizar tarea con avance 80 → rechazado con mensaje claro.
- [ ] Tests de R1–R6 y de los 5 cálculos.
