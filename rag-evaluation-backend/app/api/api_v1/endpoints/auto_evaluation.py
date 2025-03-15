from typing import Any, List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks
from sqlalchemy.orm import Session
import uuid

from app.api.deps import get_current_user, get_db
from app.models.user import User, ApiKey
from app.models.project import Project, EvaluationDimension
from app.models.question import Question
from app.models.rag_answer import RagAnswer
from app.schemas.evaluation import (
    AutoEvaluationRequest, 
    EvaluationResult,
    BatchEvaluationRequest,
    BatchEvaluationResponse
)
from app.services.evaluation_service import EvaluationService

router = APIRouter()

@router.post("/single", response_model=List[EvaluationResult])
async def evaluate_single(
    *,
    db: Session = Depends(get_db),
    request: AutoEvaluationRequest = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    自动评测单个问题的RAG回答
    """
    # 获取问题，检查权限
    question = db.query(Question).filter(Question.id == request.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 检查项目权限
    project = db.query(Project).filter(Project.id == question.project_id).first()
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限评测此问题")
    
    # 获取API密钥
    api_key = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id,
        ApiKey.provider == "openai",
        ApiKey.is_active == True
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=400, detail="未找到有效的OpenAI API密钥")
    
    # 执行评测
    evaluation_service = EvaluationService(db)
    results = await evaluation_service.evaluate_auto(
        request=request,
        model="gpt-4",  # 可以改为从请求或设置中获取
        api_key=api_key.key
    )
    
    return results

@router.post("/batch", response_model=Dict[str, Any])
async def evaluate_batch(
    *,
    db: Session = Depends(get_db),
    request: BatchEvaluationRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    批量自动评测
    """
    # 检查项目权限
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限评测此项目")
    
    # 获取API密钥
    api_key = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id,
        ApiKey.provider == "openai",
        ApiKey.is_active == True
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=400, detail="未找到有效的OpenAI API密钥")
    
    # 执行批量评测
    evaluation_service = EvaluationService(db)
    results = await evaluation_service.evaluate_batch_auto(
        project_id=request.project_id,
        model=request.model,
        api_key=api_key.key,
        dimension_ids=request.dimensions if request.dimensions else None,
        question_ids=request.question_ids,
        include_evaluated=request.include_evaluated
    )
    
    return results 