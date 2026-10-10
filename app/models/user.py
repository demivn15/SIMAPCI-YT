"""
File: models/user.py
Desciption: Definition of user entity in database.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import BaseModelClass

class UserModel(BaseModelClass):
    __tablename__ = "user"

    id = Column(
        Integer, 
        primary_key = True, 
        index = True, 
        autoincrement = True
    )
    email = Column(
        String(255), 
        unique = True, 
        index = True, 
        nullable = False
    )
    hashed_password = Column(
        String(255), 
        nullable = False
    )
    is_active = Column(
        Boolean, 
        default = True
    )