from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    company: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = True
    is_admin: Optional[bool] = False

class UserCreate(UserBase):
    email: EmailStr
    password: str
    name: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserOut(UserBase):
    id: str
    email: EmailStr
    name: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None

class ApiKeyBase(BaseModel):
    name: str
    provider: str
    is_active: Optional[bool] = True

class ApiKeyCreate(ApiKeyBase):
    key: str

class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    key: Optional[str] = None
    provider: Optional[str] = None
    is_active: Optional[bool] = None

class ApiKeyOut(ApiKeyBase):
    id: str
    user_id: str
    key: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True 