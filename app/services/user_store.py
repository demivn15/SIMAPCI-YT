"""
File: app/services/user_store.py
Description: User storage and retrieval utility service.
"""
from sqlalchemy.orm import Session
from app.models.user import User


class UserStore:
    @staticmethod
    def get_by_username(db: Session, username: str) -> User | None:
        """Retrieve a user by username."""
        return db.query(User).filter(User.username == username).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        """Retrieve a user by email."""
        return db.query(User).filter(User.email == email).first()
