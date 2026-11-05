"""
File: professor.py
Description: Private professor routes. Every route here requires an authenticated session holding the professor role.
"""

from app.api.deps import get_current_professor
from fastapi import APIRouter, Depends

router = APIRouter(prefix = "/professor", tags = ["Professor"])

@router.get("/dashboard")
def professor_dashboard(current_user: dict = Depends(get_current_professor)):
    """Example private function guarded by the professor role."""

    return {
        "message": f"Welcome, {current_user['name']}",
        "username": current_user["username"],
        "role": current_user["role"]
    }
