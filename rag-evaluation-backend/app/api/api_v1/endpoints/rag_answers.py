from typing import Any, List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Body, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import Project
from app.models.question import Question
from app.schemas.rag_answer import (
    RagAnswerOut, 
    RagAnswerDetail,
    BatchCollectionRequest,
    BatchImportRequest,
    ApiRequestConfig,
    CollectionProgress
)
from app.services.rag_service import RagService

router = APIRouter()

@router.post("/collect", response_model=Dict[str, Any])
async def collect_rag_answers(
    *,
    db: Session = Depends(get_db),
    req: BatchCollectionRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    从RAG系统API收集回答
    """
    # 检查项目权限
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权在此项目中收集回答")
    
    # 检查问题是否属于项目
    questions = db.query(Question).filter(
        Question.id.in_(req.question_ids),
        Question.project_id == req.project_id
    ).all()
    
    if len(questions) != len(req.question_ids):
        raise HTTPException(status_code=400, detail="部分问题ID无效或不属于此项目")
    
    # 创建服务实例并收集回答
    rag_service = RagService(db)
    results = await rag_service.collect_answers_batch(
        req.question_ids,
        req.api_config,
        req.concurrent_requests,
        req.max_attempts,
        req.source_system,
        req.collect_performance
    )
    
    return results

@router.post("/import", response_model=Dict[str, Any])
def import_rag_answers(
    *,
    db: Session = Depends(get_db),
    req: BatchImportRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    手动导入RAG回答
    """
    # 检查项目权限
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权在此项目中导入回答")
    
    # 导入回答
    rag_service = RagService(db)
    results = rag_service.import_answers_manual(
        req.answers,
        req.source_system
    )
    
    return results

@router.get("/project/{project_id}", response_model=List[RagAnswerOut])
def read_project_answers(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取项目的所有RAG回答
    """
    # 检查项目权限
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此项目的回答")
    
    # 获取回答
    rag_service = RagService(db)
    answers = rag_service.get_answers_by_project(project_id, skip, limit)
    
    return answers

@router.get("/question/{question_id}", response_model=List[RagAnswerOut])
def read_question_answers(
    *,
    db: Session = Depends(get_db),
    question_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取问题的所有RAG回答
    """
    # 检查问题是否存在
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 检查项目权限
    project = db.query(Project).filter(Project.id == question.project_id).first()
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此问题的回答")
    
    # 获取回答
    rag_service = RagService(db)
    answers = rag_service.get_answers_by_question(question_id)
    
    return answers

@router.get("/{answer_id}", response_model=RagAnswerDetail)
def read_rag_answer(
    *,
    db: Session = Depends(get_db),
    answer_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取单个RAG回答详情
    """
    # 获取回答
    rag_service = RagService(db)
    answer = rag_service.get_rag_answer(answer_id)
    
    if not answer:
        raise HTTPException(status_code=404, detail="回答未找到")
    
    # 检查权限
    question = db.query(Question).filter(Question.id == answer.question_id).first()
    project = db.query(Project).filter(Project.id == question.project_id).first()
    
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此回答")
    
    return answer

@router.delete("/{answer_id}")
def delete_rag_answer(
    *,
    db: Session = Depends(get_db),
    answer_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除RAG回答
    """
    # 获取回答
    rag_service = RagService(db)
    answer = rag_service.get_rag_answer(answer_id)
    
    if not answer:
        raise HTTPException(status_code=404, detail="回答未找到")
    
    # 检查权限
    question = db.query(Question).filter(Question.id == answer.question_id).first()
    project = db.query(Project).filter(Project.id == question.project_id).first()
    
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权删除此回答")
    
    # 删除回答
    rag_service.delete_rag_answer(answer_id)
    
    return {"detail": "回答已删除"} 