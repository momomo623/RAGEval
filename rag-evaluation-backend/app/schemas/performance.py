from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class PerformanceTestBase(BaseModel):
    name: str
    project_id: str
    dataset_id: Optional[str] = None
    description: Optional[str] = None
    concurrency: int = 1
    version: Optional[str] = None
    config: Dict[str, Any] = {}
    rag_config: Optional[str] = None

class PerformanceTestCreate(PerformanceTestBase):
    pass

class PerformanceTestUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    processed_questions: Optional[int] = None
    success_questions: Optional[int] = None
    failed_questions: Optional[int] = None
    summary_metrics: Optional[Dict[str, Any]] = None

class PerformanceTestInDBBase(PerformanceTestBase):
    id: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = Field(..., description="测试状态: created, running, completed, failed, terminated")
    total_questions: int
    processed_questions: int
    success_questions: int
    failed_questions: int
    summary_metrics: Dict[str, Any]
    interruption_reason: Optional[str] = None
    interruption_time: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PerformanceTestOut(PerformanceTestInDBBase):
    pass

class PerformanceTestDetail(PerformanceTestOut):
    pass

class PerformanceMetrics(BaseModel):
    response_time: Dict[str, Any]
    throughput: Dict[str, Any]
    character_stats: Dict[str, Any]
    success_rate: float
    test_duration_seconds: float

class StartPerformanceTestRequest(BaseModel):
    performance_test_id: str
    question_ids: Optional[List[str]] = None  # 可选，如果为空则使用数据集中的所有问题 