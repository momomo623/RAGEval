from typing import Any, List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import Project
from app.models.question import Question
from app.models.rag_answer import RagAnswer
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationUpdate,
    EvaluationOut,
    EvaluationDetail
)
from app.services.evaluation_service import EvaluationService

router = APIRouter()

@router.post("", response_model=EvaluationOut)
def create_manual_evaluation(
    *,
    db: Session = Depends(get_db),
    evaluation_in: EvaluationCreate = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建人工评测
    """
    # 检查问题和回答
    question = db.query(Question).filter(Question.id == evaluation_in.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 检查项目权限
    project = db.query(Project).filter(Project.id == question.project_id).first()
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限评测此问题")
    
    # 创建评测
    evaluation_service = EvaluationService(db)
    evaluation = evaluation_service.create_manual_evaluation(
        obj_in=evaluation_in,
        evaluator_id=str(current_user.id)
    )
    
    return evaluation

@router.put("/{evaluation_id}", response_model=EvaluationOut)
def update_evaluation(
    *,
    db: Session = Depends(get_db),
    evaluation_id: str,
    evaluation_in: EvaluationUpdate = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新评测结果
    """
    # 检查评测是否存在
    evaluation_service = EvaluationService(db)
    evaluation = evaluation_service.get_evaluation(evaluation_id)
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="评测结果未找到")
    
    # 检查问题和权限
    question = db.query(Question).filter(Question.id == evaluation.question_id).first()
    project = db.query(Project).filter(Project.id == question.project_id).first()
    
    # 只有评测者本人、项目拥有者或管理员可以更新
    if (str(evaluation.evaluator_id) != str(current_user.id) and 
        project.user_id != current_user.id and 
        not current_user.is_admin):
        raise HTTPException(status_code=403, detail="无权限更新此评测")
    
    # 更新评测
    updated_evaluation = evaluation_service.update_evaluation(
        evaluation_id=evaluation_id,
        obj_in=evaluation_in
    )
    
    return updated_evaluation

@router.get("/question/{question_id}", response_model=List[EvaluationOut])
def read_question_evaluations(
    *,
    db: Session = Depends(get_db),
    question_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取问题的所有人工评测结果
    """
    # 检查问题
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 检查项目权限
    project = db.query(Project).filter(Project.id == question.project_id).first()
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限查看此问题的评测")
    
    # 获取评测结果
    evaluation_service = EvaluationService(db)
    evaluations = evaluation_service.get_evaluations_by_question(question_id)
    
    # 过滤出人工评测结果
    manual_evaluations = [e for e in evaluations if e.evaluation_method == "manual"]
    
    return manual_evaluations

@router.get("/{evaluation_id}", response_model=EvaluationDetail)
def read_evaluation(
    *,
    db: Session = Depends(get_db),
    evaluation_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取单个评测结果详情
    """
    evaluation_service = EvaluationService(db)
    evaluation = evaluation_service.get_evaluation(evaluation_id)
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="评测结果未找到")
    
    # 检查权限
    question = db.query(Question).filter(Question.id == evaluation.question_id).first()
    project = db.query(Project).filter(Project.id == question.project_id).first()
    
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限查看此评测")
    
    return evaluation

@router.delete("/{evaluation_id}")
def delete_evaluation(
    *,
    db: Session = Depends(get_db),
    evaluation_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除评测结果
    """
    evaluation_service = EvaluationService(db)
    evaluation = evaluation_service.get_evaluation(evaluation_id)
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="评测结果未找到")
    
    # 检查权限
    question = db.query(Question).filter(Question.id == evaluation.question_id).first()
    project = db.query(Project).filter(Project.id == question.project_id).first()
    
    # 只有评测者本人、项目拥有者或管理员可以删除
    if (str(evaluation.evaluator_id) != str(current_user.id) and 
        project.user_id != current_user.id and 
        not current_user.is_admin):
        raise HTTPException(status_code=403, detail="无权限删除此评测")
    
    # 删除评测
    evaluation_service.delete_evaluation(evaluation_id)
    
    return {"detail": "评测已删除"} 