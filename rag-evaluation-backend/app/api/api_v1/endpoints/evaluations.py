from typing import Any, List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import Project, EvaluationDimension
from app.models.question import Question
from app.models.rag_answer import RagAnswer
from app.models.evaluation import Evaluation
from app.schemas.evaluation import (
    EvaluationOut,
    ProjectEvaluationSummary
)
from app.services.evaluation_service import EvaluationService

router = APIRouter()

@router.get("/project/{project_id}/summary", response_model=ProjectEvaluationSummary)
def get_project_evaluation_summary(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取项目评测摘要
    """
    # 检查项目
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    # 检查权限
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限查看此项目的评测摘要")
    
    # 获取评测摘要
    evaluation_service = EvaluationService(db)
    summary = evaluation_service.get_project_evaluation_summary(project_id)
    
    if not summary:
        raise HTTPException(status_code=404, detail="未找到评测摘要")
    
    return summary

@router.get("/project/{project_id}", response_model=List[EvaluationOut])
def get_project_evaluations(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    skip: int = 0,
    limit: int = 100,
    method: Optional[str] = Query(None, description="评测方法: auto, manual"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取项目的所有评测结果
    """
    # 检查项目
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    # 检查权限
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限查看此项目的评测结果")
    
    # 获取项目的所有问题ID
    question_ids = [q[0] for q in db.query(Question.id).filter(
        Question.project_id == project_id
    ).all()]
    
    if not question_ids:
        return []
    
    # 查询评测结果
    query = db.query(Evaluation).filter(Evaluation.question_id.in_(question_ids))
    
    if method:
        query = query.filter(Evaluation.evaluation_method == method)
    
    evaluations = query.offset(skip).limit(limit).all()
    
    return evaluations

@router.get("/rag-answer/{rag_answer_id}", response_model=List[EvaluationOut])
def get_rag_answer_evaluations(
    *,
    db: Session = Depends(get_db),
    rag_answer_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取RAG回答的所有评测结果
    """
    # 获取RAG回答
    rag_answer = db.query(RagAnswer).filter(RagAnswer.id == rag_answer_id).first()
    if not rag_answer:
        raise HTTPException(status_code=404, detail="RAG回答未找到")
    
    # 获取问题和项目
    question = db.query(Question).filter(Question.id == rag_answer.question_id).first()
    project = db.query(Project).filter(Project.id == question.project_id).first()
    
    # 检查权限
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限查看此回答的评测结果")
    
    # 获取评测结果
    evaluation_service = EvaluationService(db)
    evaluations = evaluation_service.get_evaluations_by_rag_answer(rag_answer_id)
    
    return evaluations

@router.get("/compare/{question_id}", response_model=Dict[str, Any])
def compare_rag_answers(
    *,
    db: Session = Depends(get_db),
    question_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    比较问题的不同RAG回答的评测结果
    """
    # 检查问题
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 检查项目权限
    project = db.query(Project).filter(Project.id == question.project_id).first()
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限查看此问题的评测结果")
    
    # 获取问题的所有回答
    rag_answers = db.query(RagAnswer).filter(RagAnswer.question_id == question_id).all()
    if not rag_answers:
        return {"question": question, "comparisons": []}
    
    # 获取评测维度
    dimensions = db.query(EvaluationDimension).filter(
        EvaluationDimension.project_id == question.project_id
    ).all()
    
    # 获取每个回答的评测结果
    evaluation_service = EvaluationService(db)
    comparisons = []
    
    for answer in rag_answers:
        evaluations = evaluation_service.get_evaluations_by_rag_answer(str(answer.id))
        
        # 按维度整理评测结果
        dimension_scores = {}
        for dim in dimensions:
            dim_evals = [e for e in evaluations if str(e.dimension_id) == str(dim.id)]
            if dim_evals:
                # 使用最新的评测结果
                latest_eval = max(dim_evals, key=lambda e: e.created_at)
                dimension_scores[str(dim.id)] = {
                    "dimension_name": dim.display_name,
                    "score": latest_eval.score,
                    "explanation": latest_eval.explanation,
                    "evaluation_method": latest_eval.evaluation_method
                }
        
        # 计算总分
        total_score = 0
        total_weight = 0
        
        for dim in dimensions:
            if str(dim.id) in dimension_scores:
                total_score += dimension_scores[str(dim.id)]["score"] * dim.weight
                total_weight += dim.weight
        
        avg_score = total_score / total_weight if total_weight > 0 else 0
        
        comparisons.append({
            "rag_answer_id": str(answer.id),
            "source_system": answer.source_system,
            "answer_text": answer.answer_text,
            "dimension_scores": dimension_scores,
            "average_score": avg_score,
            "performance": {
                "first_response_time": answer.first_response_time,
                "total_response_time": answer.total_response_time,
                "character_count": answer.character_count,
                "characters_per_second": answer.characters_per_second
            }
        })
    
    # 按平均得分排序
    comparisons.sort(key=lambda x: x["average_score"], reverse=True)
    
    return {
        "question": {
            "id": str(question.id),
            "question_text": question.question_text,
            "standard_answer": question.standard_answer
        },
        "dimensions": [{
            "id": str(dim.id),
            "name": dim.display_name,
            "weight": dim.weight
        } for dim in dimensions],
        "comparisons": comparisons
    }

@router.get("", response_model=List[EvaluationOut])
def get_evaluations(
    *,
    db: Session = Depends(get_db),
    project_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    method: Optional[str] = Query(None, description="评测方法: auto, manual"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取评测列表，可通过项目ID过滤
    """
    # 如果提供了项目ID，则检查项目权限
    if project_id:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目未找到")
        
        if project.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="无权限查看此项目的评测结果")
        
        # 获取项目的所有问题ID
        question_ids = [q[0] for q in db.query(Question.id).filter(
            Question.project_id == project_id
        ).all()]
        
        if not question_ids:
            return []
        
        # 查询评测结果
        query = db.query(Evaluation).filter(Evaluation.question_id.in_(question_ids))
    else:
        # 如果没有提供项目ID，则返回用户有权限查看的所有评测
        # 管理员可以查看所有评测
        if current_user.is_admin:
            query = db.query(Evaluation)
        else:
            # 普通用户只能查看自己的项目评测
            user_project_ids = [p[0] for p in db.query(Project.id).filter(
                Project.user_id == current_user.id
            ).all()]
            
            if not user_project_ids:
                return []
            
            user_question_ids = [q[0] for q in db.query(Question.id).filter(
                Question.project_id.in_(user_project_ids)
            ).all()]
            
            if not user_question_ids:
                return []
            
            query = db.query(Evaluation).filter(Evaluation.question_id.in_(user_question_ids))
    
    if method:
        query = query.filter(Evaluation.evaluation_method == method)
    
    evaluations = query.offset(skip).limit(limit).all()
    
    return evaluations 