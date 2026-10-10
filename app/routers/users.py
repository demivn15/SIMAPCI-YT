"""
File: routers/users.py
Description: Definition of endpoint for users.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.user import UserModel
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.post(
    "/", 
    response_model=UserResponse, 
    status_code=status.HTTP_201_CREATED
)
def create_user(user_input: UserCreate, db: Session = Depends(get_database_session)):
    existing_user = db.query(UserModel).filter(UserModel.email == user_input.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    fake_hashed_password = user_input.password + "_hashed_mock"

    new_user = UserModel(
        email=user_input.email,
        hashed_password=fake_hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user