from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class QuestionBase(BaseModel):
    question_text: str
    standard_answer: str
    category: Optional[str] = None
    difficulty: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[Union[List[str], Dict[str, Any]]] = None
    question_metadata: Optional[Dict[str, Any]] = None

class QuestionCreate(QuestionBase):
    project_id: str

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    standard_answer: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[Union[List[str], Dict[str, Any]]] = None
    question_metadata: Optional[Dict[str, Any]] = None

class QuestionInDBBase(QuestionBase):
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QuestionOut(QuestionInDBBase):
    pass

class QuestionBatchCreate(BaseModel):
    project_id: str
    questions: List[QuestionBase]

# 问答生成相关模型
class QuestionGenerateRequest(BaseModel):
    project_id: str
    content: str = Field(..., min_length=10)
    count: int = Field(10, ge=1, le=50)
    difficulty: str = "中等"
    question_types: List[str] = ["事实型", "推理型", "应用型"]
    model: str = "gpt-4"
    model_provider: str = "openai"
    save_to_project: bool = False

class QuestionGenerateResponse(BaseModel):
    generated_questions: List[Dict[str, Any]]
    saved_questions: List[QuestionOut] = []
    count: int 