"""
File: auth.py
Description: Authentication logic using JWT
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.user import UserModel
from app.security.jwt import verify_password, create_access_token

router = APIRouter(
    prefix = "/auth", 
    tags = ["Authentication"]
)

@router.post("/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_database_session)):
    """
    Authenticate a user via email and password, then return a JWT access token.
    Note: OAuth2PasswordRequestForm expects form fields named 'username' and 'password'. 
    In your project, the 'username' field will receive the user's email address.
    """
    
    # 1. Find the user in the database by email (username field)
    user = db.query(UserModel).filter(UserModel.email == form_data.username).first()
    
    # 2. Validate user existence and password hash
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Incorrect email or password",
            headers = {"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Create the JWT access token using the user's email as the subject ('sub')
    access_token = create_access_token(data = {"sub": user.email})
    
    # 4. Return the token and token type to the client
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }