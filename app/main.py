"""
File: main.py
Author: Demian Viteri
Description: FastAPI application entry point.
"""

from app.api.v1.auth import router as auth_router
from app.core.config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Institutional Professor Portal API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,  # e.g., ["http://localhost:5173"]
    allow_credentials=True,                        # MANDATORY for cookies to travel cross-port
    allow_methods=["*"],                           # Allows all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],                           # Allows all headers (Content-Type, Authorization, etc.)
)

# Include authentication routes
app.include_router(auth_router, prefix="/api/v1")

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "LDAP Auth API Running"}
