from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class ApiKeyBase(BaseModel):
    name: str
    provider: str
    is_active: bool = True

class ApiKeyCreate(ApiKeyBase):
    key: str = Field(..., min_length=5)

class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    key: Optional[str] = None
    is_active: Optional[bool] = None

class ApiKeyInDBBase(ApiKeyBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ApiKeyOut(ApiKeyInDBBase):
    key: str = Field(..., example="sk-***************") 