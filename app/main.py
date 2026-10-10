"""
File: main.py
Description: [Pending]
"""

from fastapi import FastAPI
from app.routers import users, auth

app = FastAPI(title="SIMAPCI API")
app.include_router(users.router)
app.include_router(auth.router)