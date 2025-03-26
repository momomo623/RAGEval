from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class RagAnswerBase(BaseModel):
    question_id: str
    answer: str
    collection_method: str  # api, manual
    # source_system: Optional[str] = None
    first_response_time: Optional[float] = None
    total_response_time: Optional[float] = None
    character_count: Optional[int] = None
    version: Optional[str] = "v1"  # 默认版本为v1

    class Config:
        fields = {
            "answer": "answer"
        }

class RagAnswerCreate(RagAnswerBase):
    raw_response: Optional[Dict[str, Any]] = None
    # api_config_id: Optional[str] = None
    # response_time: Optional[float] = None
    token_count: Optional[int] = None

class RagAnswerUpdate(BaseModel):
    answer: Optional[str] = None
    # source_system: Optional[str] = None
    version: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    # api_config_id: Optional[str] = None
    # response_time: Optional[float] = None
    token_count: Optional[int] = None

class RagAnswerInDBBase(RagAnswerBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class RagAnswerOut(RagAnswerInDBBase):
    pass

class RagAnswerDetail(RagAnswerInDBBase):
    raw_response: Optional[Dict[str, Any]] = None
    characters_per_second: Optional[float] = None

# API请求模型
class ApiRequestConfig(BaseModel):
    endpoint_url: str
    api_key: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    request_template: Dict[str, Any]
    response_path: str = "answer"  # 从响应中提取答案的JSON路径
    timeout: int = 60  # 秒

class BatchCollectionRequest(BaseModel):
    project_id: str
    question_ids: List[str]
    api_config: ApiRequestConfig
    concurrent_requests: int = 1
    max_attempts: int = 1
    # source_system: str = "RAG系统"
    collect_performance: bool = True

class BatchImportRequest(BaseModel):
    project_id: str
    answers: List[Dict[str, Any]]  # 包含question_id和answer的列表
    # source_system: str = "手动导入"

class CollectionProgress(BaseModel):
    total: int
    completed: int
    failed: int
    in_progress: int
    status: str  # queued, running, completed, failed
    job_id: Optional[str] = None
    errors: Optional[List[Dict[str, Any]]] = None

# 批量创建RAG回答的请求模型
class RagAnswerBatchCreate(BaseModel):
    items: List[RagAnswerCreate]

class RAGAnswerWithQuestion(BaseModel):
    id: str
    question_id: str
    question_content: str
    answer: Optional[str] = None
    total_response_time: Optional[float] = None
    first_response_time: Optional[float] = None
    success: bool = False
    sequence_number: Optional[int] = None
    
    class Config:
        orm_mode = True 