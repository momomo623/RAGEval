from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import uuid

class DimensionBase(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    weight: float = 1.0

class DimensionCreate(DimensionBase):
    pass

class DimensionUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[float] = None

class DimensionInDBBase(DimensionBase):
    id: str
    project_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class DimensionOut(DimensionInDBBase):
    pass

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    evaluation_method: str = "auto"  # auto, manual, hybrid
    scoring_scale: str = "1-5"  # binary, 1-3, 1-5
    status: str = "created"  # created, in_progress, completed
    settings: Optional[Dict[str, Any]] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    evaluation_method: Optional[str] = None
    scoring_scale: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class ProjectInDBBase(ProjectBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProjectOut(ProjectBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

        @classmethod
        def get_validators(cls):
            yield cls.validate_to_json

        @classmethod
        def validate_to_json(cls, value):
            if isinstance(value, uuid.UUID):
                return str(value)
            return value

class ProjectDetail(ProjectOut):
    dimensions: List[Dict[str, Any]] = []

class ProjectWithDimensions(ProjectOut):
    dimensions: List[DimensionOut] = [] 