# TOOLS.md - Mauri-Dev

## Stack tecnológico principal

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express.js
- **Base de datos:** SQLite
- **Runtime:** Node.js

## Comandos frecuentes

```bash
# Instalar dependencias del proyecto
npm install

# Levantar servidor de desarrollo (frontend)
cd frontend && npm run dev

# Levantar backend
cd backend && npm run dev

# Ejecutar migrations de base de datos
npm run db:migrate

# Ver estado de la DB
npm run db:status
```

## Estructura del workspace

```
/mauri-dev/
├── frontend/        # React + Vite + TypeScript
├── backend/        # Express + SQLite
├── memory/         # Notas diarias de trabajo
├── AGENTS.md       # Este archivo
├── TOOLS.md        # Configuraciones locales
└── README.md       # Documentación del proyecto
```

## Notas de implementación

- El backend expone endpoints REST en puerto 3001.
- El frontend se conecta a `http://localhost:3001/api`.
- La base de datos SQLite se encuentra en `backend/data/app.db`.
- Usar `knex.js` como query builder para SQLite.

## Path de trabajo

Siempre operar dentro de `/home/node/.openclaw/workspace/mauri-dev`