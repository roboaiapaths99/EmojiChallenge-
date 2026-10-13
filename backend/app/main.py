from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.database import connect_database, close_database
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info("Starting %s (%s environment)...", settings.APP_NAME, settings.APP_ENV)
    await connect_database()
    yield
    # Shutdown
    logger.info("Shutting down %s...", settings.APP_NAME)
    await close_database()


app = FastAPI(
    title="Emoji Face Challenge API",
    description="Python FastAPI backend powering event game sessions, photo souvenirs, QR claims, and leaderboards.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads directory for direct photo preview URL access
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOADS_PATH)), name="uploads")

# Include Core API Routes
app.include_router(api_router)


# Global Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0]["msg"] if errors else "Validation error"
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": f"Schema validation error: {first_error}"
        }
    )


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }


@app.get("/claim/{token}", response_class=HTMLResponse)
@app.get("/photo/{token}", response_class=HTMLResponse)
async def claim_photo_page(token: str, request: Request):
    """
    Mobile claim and download page for QR code scanners.
    Displays photo preview, score, and lead capture form (name, mobile, email)
    before authorizing HD download.
    """
    from app.services.photo_service import photo_service
    from app.services.session_service import session_service
    from app.services.qr_service import qr_service
    from app.services.claim_page_service import render_claim_html

    photo = await photo_service.get_photo_by_token(token)
    session = None
    preview_url = ""
    host = request.headers.get("host") or "localhost:3001"
    scheme = request.url.scheme or "http"

    if photo:
        session = await session_service.get_session(photo["sessionId"])
        preview_url = qr_service.build_preview_url(photo["storageKey"], host, scheme)

    html_content = render_claim_html(
        token=token,
        photo=photo,
        session=session,
        preview_url=preview_url,
        host=host,
        scheme=scheme
    )
    return HTMLResponse(content=html_content)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.APP_ENV == "development")
    )
