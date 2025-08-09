from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
import uuid

# 基础问题模型
class QuestionBase(BaseModel):
    question_text: str
    standard_answer: str
    category: Optional[str] = None
    difficulty: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[Union[Dict[str, Any], List[str]]] = None
    question_metadata: Optional[Dict[str, Any]] = None

# 创建问题时的请求模型
class QuestionCreate(QuestionBase):
    dataset_id: str

# 更新问题时的请求模型
class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    standard_answer: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    question_metadata: Optional[Dict[str, Any]] = None

# 首先添加一个 RAG 答案模型
class RagAnswerOut(BaseModel):
    id: str
    answer: str
    collection_method: str
    version: Optional[str] = None
    first_response_time: Optional[float] = None
    total_response_time: Optional[float] = None
    character_count: Optional[int] = None
    characters_per_second: Optional[float] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# 然后修改 QuestionOut 模型
class QuestionOut(QuestionBase):
    id: str
    dataset_id: str
    created_at: datetime
    updated_at: datetime
    rag_answers: Optional[List[RagAnswerOut]] = []
    
    model_config = ConfigDict(from_attributes=True)

# 批量创建问题请求
class QuestionBatchCreate(BaseModel):
    dataset_id: str
    questions: List[QuestionBase]

# 问题生成请求
class QuestionGenerateRequest(BaseModel):
    content: str
    count: int = 5
    difficulty: Optional[str] = "medium"
    question_types: Optional[List[str]] = ["factual", "conceptual", "applied"]
    model: str = "gpt-4"
    model_provider: str = "openai"
    save_to_dataset: bool = False
    dataset_id: Optional[str] = None

# 问题生成响应
class QuestionGenerateResponse(BaseModel):
    generated_questions: List[Dict[str, Any]]
    saved_questions: List[QuestionOut] = []
    count: int

# 新增的批量删除请求模式
class BatchDeleteRequest(BaseModel):
    """批量删除问题的请求模型"""
    question_ids: List[str]

    model_config = ConfigDict(from_attributes=True)

# 添加导入问题时包含RAG回答的模型
class QuestionImportWithRagAnswer(QuestionBase):
    rag_answer: Optional[str] = None
    
# 修改批量导入模型
class QuestionBatchImport(BaseModel):
    dataset_id: str
    questions: List[QuestionImportWithRagAnswer] 