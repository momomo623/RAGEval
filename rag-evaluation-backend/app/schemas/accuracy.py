from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator, constr
from uuid import UUID

# 基础模型
class AccuracyTestBase(BaseModel):
    name: str
    description: Optional[str] = None
    evaluation_type: str = Field(..., pattern="^(ai|manual|hybrid)$")
    scoring_method: str = Field(..., pattern="^(binary|three_scale|five_scale)$")
    dimensions: List[str] = Field(default=["accuracy"])
    weights: Optional[Dict[str, float]] = None
    prompt_template: Optional[str] = None
    version: Optional[str] = None
    # model_config: Optional[Dict[str, Any]] = None
    batch_settings: Optional[Dict[str, Any]] = None
    
    class Config:
        orm_mode = True

# 创建请求
class AccuracyTestCreate(AccuracyTestBase):
    project_id: UUID
    dataset_id: UUID

# 创建响应
class AccuracyTestCreateResponse(AccuracyTestBase):
    id: UUID
    project_id: UUID
    dataset_id: UUID
    status: str
    created_at: datetime
    total_questions: int = 0
    
    class Config:
        orm_mode = True

# 测试详情
class AccuracyTestDetail(AccuracyTestCreateResponse):
    processed_questions: int = 0
    success_questions: int = 0
    failed_questions: int = 0
    results_summary: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

# 测试进度
class AccuracyTestProgress(BaseModel):
    id: UUID
    total: int
    processed: int
    success: int
    failed: int
    status: str
    
    class Config:
        orm_mode = True

# 评测项创建请求
class AccuracyTestItemCreate(BaseModel):
    evaluation_id: UUID
    question_id: UUID
    rag_answer_id: UUID
    sequence_number: Optional[int] = None
    
    class Config:
        orm_mode = True

# AI评测结果
class AIEvaluationResult(BaseModel):
    score: float
    dimension_scores: Dict[str, float]
    evaluation_reason: str
    raw_response: Optional[Dict[str, Any]] = None

# 人工评测结果
class HumanEvaluationResult(BaseModel):
    score: float
    dimension_scores: Dict[str, float]
    evaluation_reason: str
    evaluator_id: str

# 评测项更新
class AccuracyTestItemUpdate(BaseModel):
    ai_result: Optional[AIEvaluationResult] = None
    human_result: Optional[HumanEvaluationResult] = None

# 评测项详情
class AccuracyTestItemDetail(BaseModel):
    id: UUID
    evaluation_id: UUID
    question_id: UUID
    rag_answer_id: UUID
    status: str
    final_score: Optional[float] = None
    final_dimension_scores: Optional[Dict[str, float]] = None
    final_evaluation_reason: Optional[str] = None
    final_evaluation_type: Optional[str] = None
    ai_score: Optional[float] = None
    ai_dimension_scores: Optional[Dict[str, float]] = None
    ai_evaluation_reason: Optional[str] = None
    ai_evaluation_time: Optional[datetime] = None
    human_score: Optional[float] = None
    human_dimension_scores: Optional[Dict[str, float]] = None
    human_evaluation_reason: Optional[str] = None
    human_evaluator_id: Optional[str] = None
    human_evaluation_time: Optional[datetime] = None
    sequence_number: Optional[int] = None
    
    # 额外信息 - 从关联表中获取
    question_content: Optional[str] = None
    reference_answer: Optional[str] = None
    rag_answer_content: Optional[str] = None
    
    class Config:
        orm_mode = True

# 人工评测任务创建
class HumanAssignmentCreate(BaseModel):
    evaluation_id: UUID
    evaluator_name: Optional[str] = None
    evaluator_email: Optional[str] = None
    item_count: int = Field(..., gt=0)
    expiration_days: Optional[int] = None

# 人工评测任务详情
class HumanAssignmentDetail(BaseModel):
    id: UUID
    evaluation_id: UUID
    access_code: str
    evaluator_name: Optional[str] = None
    total_items: int
    completed_items: int
    status: str
    is_active: bool
    expiration_date: Optional[datetime] = None
    assigned_at: datetime
    last_activity_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

# 开始测试请求
class StartAccuracyTestRequest(BaseModel):
    accuracy_test_id: UUID

# 获取评测项的请求
class GetTestItemsRequest(BaseModel):
    evaluation_id: UUID
    limit: Optional[int] = 50
    offset: Optional[int] = 0
    status: Optional[str] = None 