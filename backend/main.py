import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure the backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Load .env file from root and backend
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from api.routes import router
from modules.decision_store import init_db

# Initialize database on start
init_db()

app = FastAPI(
    title="ORCA API",
    description="Operational Reasoning & Marine Intelligence Decision Engine",
    version="1.0.0"
)

# CORS middleware for frontend communication
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
if not origins:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.getenv("FRONTEND_URL", "http://localhost:3000")
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app" if not allowed_origins_env else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "code": "INTERNAL_SERVER_ERROR",
            "message": str(exc),
            "data": None
        }
    )

app.include_router(router)

from modules.decision_watcher_daemon import decision_watcher

@app.on_event("startup")
async def on_startup():
    await decision_watcher.start()

@app.on_event("shutdown")
async def on_shutdown():
    await decision_watcher.stop()

@app.get("/")
async def root():
    return {
        "service": "ORCA Marine Decision Engine",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
