from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
import uuid

from app.models.types import StringUUID

# 评测维度模型
class EvaluationDimension(BaseModel):
    name: str
    weight: float = 1.0
    description: Optional[str] = None
    enabled: bool = True

# 基础项目模型
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    public: Optional[bool] = False
    scoring_scale: Optional[str] = "1-5"
    evaluation_method: Optional[str] = "auto"
    settings: Optional[Dict[str, Any]] = {}
    evaluation_dimensions: Optional[List[EvaluationDimension]] = []

# 创建项目时的请求模型
class ProjectCreate(ProjectBase):
    pass

# 更新项目时的请求模型
class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    public: Optional[bool] = None
    status: Optional[str] = None
    scoring_scale: Optional[str] = None
    evaluation_method: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    evaluation_dimensions: Optional[List[EvaluationDimension]] = None

# 项目响应模型
class ProjectOut(ProjectBase):
    id: str
    user_id: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProjectDetail(ProjectOut):
    datasets: List[Dict[str, Any]] = []
    accuracy_tests: List[Dict[str, Any]] = []
    performance_tests: List[Dict[str, Any]] = []

class ProjectWithDimensions(ProjectOut):
    evaluation_dimensions: List[EvaluationDimension] = []