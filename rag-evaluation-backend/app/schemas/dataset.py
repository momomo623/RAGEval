from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)

# 数据集详情响应模型
class DatasetDetail(DatasetOut):
    projects: List[Dict[str, str]] = []
    
    model_config = ConfigDict(from_attributes=True)

# 项目-数据集关联模型
class ProjectDatasetLink(BaseModel):
    project_id: str
    dataset_id: str

    model_config = ConfigDict(from_attributes=True)

# 批量关联数据集请求
class BatchLinkDatasets(BaseModel):
    dataset_ids: List[str] 