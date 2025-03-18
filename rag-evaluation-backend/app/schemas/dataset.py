from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

# 基础数据集模型
class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: Optional[bool] = False
    tags: Optional[List[str]] = []
    dataset_metadata: Optional[Dict[str, Any]] = {}

# 创建数据集时的请求模型
class DatasetCreate(DatasetBase):
    pass

# 更新数据集时的请求模型
class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    tags: Optional[List[str]] = None
    dataset_metadata: Optional[Dict[str, Any]] = None

# 数据集响应模型
class DatasetOut(DatasetBase):
    id: str
    user_id: Optional[str] = None
    question_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        
        # 添加模型验证器，确保UUID被正确转换为字符串
        @classmethod
        def get_validators(cls):
            yield cls.validate_to_json

        @classmethod
        def validate_to_json(cls, value):
            if isinstance(value, UUID):
                return str(value)
            return value

# 数据集详情响应模型
class DatasetDetail(DatasetOut):
    projects: List[Dict[str, str]] = []
    
    class Config:
        from_attributes = True

# 项目-数据集关联模型
class ProjectDatasetLink(BaseModel):
    project_id: str
    dataset_id: str

    class Config:
        from_attributes = True

# 批量关联数据集请求
class BatchLinkDatasets(BaseModel):
    dataset_ids: List[str] 