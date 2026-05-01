# Mauri-Dev

Agente especializado en desarrollo full-stack.

## Especialidades

- Frontend: React + Vite + TypeScript
- Backend: Express.js
- Bases de datos: SQLite
- Web Services: REST API
- UI Design: Interfaces mantenibles y escalables

## Stack Tecnológico

- **Frontend:** React 18 + Vite 6 + TypeScript
- **Backend:** Express.js 4 + Knex.js + better-sqlite3
- **Base de datos:** SQLite
- **Runtime:** Node.js 18+

## Estructura del Proyecto

```
mauri-dev/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx             # Componente principal con TaskList y TaskForm
│   │   ├── main.tsx            # Punto de entrada
│   │   └── components/         # Componentes adicionales
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── backend/                     # Express + SQLite
│   ├── src/
│   │   ├── index.js            # API REST (CRUD tasks)
│   │   └── db/
│   │       ├── knex.js         # Configuración de conexión
│   │       └── migrate.js     # Migration de tabla tasks
│   ├── data/                    # SQLite database (creado automáticamente)
│   ├── data/app.db             # Archivo de base de datos
│   └── package.json
├── AGENTS.md                    # Identidad y reglas del agente
├── TOOLS.md                     # Configuraciones y comandos
└── README.md                    # Este archivo
```

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/tasks` | Listar todas las tareas |
| POST | `/api/tasks` | Crear una tarea |
| PUT | `/api/tasks/:id` | Actualizar una tarea |
| DELETE | `/api/tasks/:id` | Eliminar una tarea |

## Modelo de Datos (Tabla: tasks)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| title | TEXT | Título de la tarea (requerido) |
| description | TEXT | Descripción (opcional) |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de última modificación |

## Instalación y Uso

### 1. Instalar dependencias

```bash
# Backend
cd /home/node/.openclaw/workspace/mauri-dev/backend
npm install

# Frontend
cd /home/node/.openclaw/workspace/mauri-dev/frontend
npm install
```

### 2. Ejecutar migrations de base de datos

```bash
cd /home/node/.openclaw/workspace/mauri-dev/backend
npm run db:migrate
```

Esto creará la tabla `tasks` en `backend/data/app.db`.

### 3. Levantar el proyecto

**Terminal 1 - Backend (puerto 3001):**
```bash
cd /home/node/.openclaw/workspace/mauri-dev/backend
npm run dev
```

**Terminal 2 - Frontend (puerto 5173):**
```bash
cd /home/node/.openclaw/workspace/mauri-dev/frontend
npm run dev
```

### URLs de acceso

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api
- **Health check:** http://localhost:3001/api/tasks

## Comandos Disponibles

```bash
# Backend
cd /home/node/.openclaw/workspace/mauri-dev/backend
npm run dev          # Levantar servidor Express
npm run db:migrate   # Crear/verificar tablas

# Frontend
cd /home/node/.openclaw/workspace/mauri-dev/frontend
npm run dev          # Levantar Vite dev server
npm run build        # Build para producción
```

## Configuración de Vite Proxy

El frontend está configurado para proxy автоматически redirigir `/api/*` a `http://localhost:3001`, así que no necesitas configurar CORS manualmente.

## Notas de Desarrollo

- La base de datos SQLite se crea automáticamente en `backend/data/app.db`
- El backend usa `better-sqlite3` para sincronía y mejor rendimiento
- Knex.js se usa como query builder para portability
- El frontend usa fetch API para comunicación con el backend

## Workspace

- **Ruta base:** `/home/node/.openclaw/workspace/mauri-dev`
- **Modelo configurado:** `ollama/minimax-m2.7:cloud`