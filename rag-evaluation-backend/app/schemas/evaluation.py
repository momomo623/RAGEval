from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class DimensionBase(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    weight: float = 1.0

class EvaluationBase(BaseModel):
    question_id: str
    rag_answer_id: str
    dimension_id: str
    score: float
    explanation: Optional[str] = None
    evaluation_method: str  # auto, manual
    evaluator_id: Optional[str] = None  # 人工评测时的用户ID
    model_name: Optional[str] = None  # 自动评测时的模型名称

class EvaluationCreate(EvaluationBase):
    raw_model_response: Optional[Dict[str, Any]] = None

class EvaluationUpdate(BaseModel):
    score: Optional[float] = None
    explanation: Optional[str] = None

class EvaluationInDBBase(EvaluationBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True

class EvaluationOut(EvaluationInDBBase):
    pass

class EvaluationDetail(EvaluationInDBBase):
    raw_model_response: Optional[Dict[str, Any]] = None

# 自动评测相关模型
class AutoEvaluationDimension(BaseModel):
    id: str
    name: str
    description: str

class AutoEvaluationRequest(BaseModel):
    question_id: str
    question: str
    standard_answer: str
    rag_answer: str
    rag_answer_id: str
    dimensions: List[AutoEvaluationDimension]

class EvaluationResult(BaseModel):
    question_id: str
    rag_answer_id: str
    dimension_id: str
    score: float
    explanation: str
    model_name: str
    evaluation_method: str = "auto"
    raw_model_response: Optional[Dict[str, Any]] = None
    success: bool = True

class BatchEvaluationRequest(BaseModel):
    project_id: str
    model: str = "gpt-4"
    dimensions: List[str] = []  # 如果为空，则评测所有维度
    evaluation_type: str = "auto"  # auto, manual, hybrid
    question_ids: Optional[List[str]] = None  # 如果为空，则评测项目中的所有问题
    include_evaluated: bool = False  # 是否包含已评测的问题

class BatchEvaluationResponse(BaseModel):
    job_id: str
    status: str
    total: int
    completed: int = 0
    failed: int = 0
    in_progress: int = 0

class EvaluationSummary(BaseModel):
    dimension_name: str
    dimension_id: str
    average_score: float
    max_score: float
    min_score: float
    count: int
    weight: float

class ProjectEvaluationSummary(BaseModel):
    project_id: str
    project_name: str
    total_score: float
    dimension_scores: List[EvaluationSummary]
    question_count: int
    evaluated_count: int
    evaluation_progress: float  # 0-1 