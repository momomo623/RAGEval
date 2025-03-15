from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class PerformanceTestBase(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    test_type: str = "latency"  # latency, throughput, concurrency
    config: Dict[str, Any] = {}

class PerformanceTestCreate(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    test_type: str
    config: Dict[str, Any]

class PerformanceTestUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

class PerformanceTestInDBBase(PerformanceTestBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class PerformanceTestOut(PerformanceTestInDBBase):
    pass

class PerformanceMetricBase(BaseModel):
    test_id: str
    rag_answer_id: Optional[str] = None
    concurrency_level: int = 1
    batch_size: Optional[int] = 1
    response_time: Optional[float] = None
    throughput: Optional[float] = None
    success_rate: Optional[float] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    status: str = "success"
    error_message: Optional[str] = None
    performance_metadata: Optional[Dict[str, Any]] = None

class PerformanceMetricCreate(PerformanceMetricBase):
    pass

class PerformanceMetricInDBBase(PerformanceMetricBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class PerformanceMetricOut(PerformanceMetricInDBBase):
    pass

# 性能测试请求模型
class PerformanceTestRequest(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    api_config_id: str
    concurrency: int = Field(ge=1, le=50, default=1)
    duration: int = Field(ge=1, le=300, default=60)  # 测试持续时间（秒）
    ramp_up: int = Field(ge=0, le=60, default=0)  # 逐步增加负载的时间（秒）
    requests_per_second: Optional[int] = Field(ge=1, default=None)  # 限制每秒请求数，None表示不限制
    question_ids: Optional[List[str]] = None  # 要测试的问题ID列表，None表示使用项目中的所有问题

class PerformanceTestRunResponse(BaseModel):
    test_id: str
    status: str = "running"
    start_time: datetime = Field(default_factory=datetime.now)
    estimated_completion: Optional[datetime] = None

class PerformanceTestResult(BaseModel):
    test_id: str
    status: str
    summary: Dict[str, Any]
    metrics: List[Dict[str, Any]]
    errors: Optional[List[Dict[str, Any]]] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: Optional[float] = None  # 实际测试持续时间（秒） 