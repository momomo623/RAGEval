from typing import Optional

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
    password: str = Field(..., min_length=8)
    name: Optional[str] = None

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: str

    class Config:
        orm_mode = True

class UserInDB(UserInDBBase):
    password_hash: str

class UserOut(UserInDBBase):
    pass 