"""
main.py — FastAPI application factory for q7-forms2apex.

Includes:
- All routers (auth, organizations, projects, migrations)
- CORS middleware
- Health check
- Jinja2 templates and static files
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import get_settings
from app.routers import auth, organizations, projects, migrations

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    yield
    # Shutdown


def create_app() -> FastAPI:
    """Factory that creates and configures the FastAPI app."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Migrate Oracle Forms to Oracle APEX",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth.router)
    app.include_router(organizations.router)
    app.include_router(projects.router)
    app.include_router(migrations.router)

    # Templates
    templates = Jinja2Templates(directory="/app/frontend/templates")

    # Health check
    @app.get("/health")
    async def health() -> dict:
        """Health check endpoint."""
        return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}

    # Root redirect to dashboard
    @app.get("/", response_class=HTMLResponse)
    async def root(request: Request) -> HTMLResponse:
        """Serve the dashboard."""
        return templates.TemplateResponse("dashboard.html", {"request": request})

    # Login page
    @app.get("/login", response_class=HTMLResponse)
    async def login_page(request: Request) -> HTMLResponse:
        """Serve the login page."""
        return templates.TemplateResponse("login.html", {"request": request})

    # Dashboard
    @app.get("/dashboard", response_class=HTMLResponse)
    async def dashboard_page(request: Request) -> HTMLResponse:
        """Serve the dashboard."""
        return templates.TemplateResponse("dashboard.html", {"request": request})

    # Static files
    app.mount("/static", StaticFiles(directory="/app/frontend/static"), name="static")

    return app


app = create_app()
