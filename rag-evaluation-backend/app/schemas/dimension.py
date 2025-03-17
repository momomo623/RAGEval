from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

# 维度基础模型
class DimensionBase(BaseModel):
    name: str
    description: Optional[str] = None
    weight: float = 1.0

# 创建维度请求
class DimensionCreate(DimensionBase):
    project_id: str

# 更新维度请求
class DimensionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[float] = None

# 维度响应模型
class DimensionOut(DimensionBase):
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # 替代orm_mode=True

        @classmethod
        def get_validators(cls):
            yield cls.validate_to_json

        @classmethod
        def validate_to_json(cls, value):
            if isinstance(value, UUID):
                return str(value)
            return value 