from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from app.schemas.evaluation import EvaluationSummary

class ReportBase(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    report_type: str = "evaluation"  # evaluation, performance, comparison
    public: bool = False

class ReportCreate(ReportBase):
    config: Dict[str, Any] = {}

class ReportUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    public: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None

class ReportInDBBase(ReportBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class ReportOut(ReportInDBBase):
    config: Dict[str, Any]

# 评测报告模型
class EvaluationReportDimensionResult(BaseModel):
    dimension_id: str
    dimension_name: str
    average_score: float
    distribution: Dict[str, int]  # 分数分布，例如 {"1": 5, "2": 10, ...}
    weight: float = 1.0

class EvaluationReportSystemResult(BaseModel):
    system_name: str
    average_score: float
    dimension_scores: List[EvaluationSummary]
    question_count: int
    evaluation_count: int

class EvaluationReportContent(BaseModel):
    total_score: float
    question_count: int
    evaluated_count: int
    dimension_results: List[EvaluationReportDimensionResult]
    system_results: List[EvaluationReportSystemResult]
    improvement_suggestions: Optional[List[str]] = None
    
class PerformanceReportContent(BaseModel):
    total_questions: int
    total_answers: int
    avg_first_response_time: float  # 毫秒
    avg_total_response_time: float  # 毫秒
    avg_characters_per_second: float
    response_time_distribution: Dict[str, int]  # 响应时间分布
    system_comparison: List[Dict[str, Any]]

class ComparisonReportContent(BaseModel):
    systems: List[str]
    question_count: int
    dimension_comparisons: List[Dict[str, Any]]
    overall_ranking: List[Dict[str, Any]]
    strengths_weaknesses: Dict[str, Any]

class ReportWithContent(ReportOut):
    content: Dict[str, Any]
    
class ReportExportRequest(BaseModel):
    report_id: str
    format: str = "pdf"  # pdf, html, md, csv, xlsx
    include_charts: bool = True 