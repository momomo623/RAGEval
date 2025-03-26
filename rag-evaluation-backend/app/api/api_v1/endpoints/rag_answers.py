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
    CollectionProgress,
    RagAnswerCreate,
    RagAnswerUpdate
)
from app.services.rag_service import RagService
from app.models.rag_answer import RagAnswer
from app.models.dataset import Dataset

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

@router.delete("/{answer_id}", response_model=Dict[str, Any])
def delete_rag_answer(
    *,
    db: Session = Depends(get_db),
    answer_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除RAG回答
    """
    rag_service = RagService(db)
    answer = rag_service.get_rag_answer(answer_id)
    
    if not answer:
        raise HTTPException(status_code=404, detail="回答未找到")
    
    # 检查权限 - 修复从问题查询到数据集
    question = db.query(Question).filter(Question.id == answer.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="相关问题未找到")
    
    # 问题属于数据集，不是项目
    dataset = db.query(Dataset).filter(Dataset.id == question.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="相关数据集未找到")
    
    # 检查用户权限 (使用数据集的user_id)
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权删除此回答")
    
    # 删除回答
    rag_service.delete_rag_answer(answer_id)
    
    return {"detail": "回答已删除"}

@router.post("", response_model=RagAnswerOut)
def create_rag_answer(
    *,
    db: Session = Depends(get_db),
    rag_answer_in: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建RAG回答
    """
    # 基本验证
    required_fields = ["question_id", "answer", "version"]
    for field in required_fields:
        if field not in rag_answer_in:
            raise HTTPException(status_code=400, detail=f"缺少必要字段: {field}")
    
    # 检查问题是否存在
    question = db.query(Question).filter(Question.id == rag_answer_in["question_id"]).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 检查是否已经存在相同版本的回答
    existing_answer = db.query(RagAnswer).filter(
        RagAnswer.question_id == rag_answer_in["question_id"],
        RagAnswer.version == rag_answer_in["version"]
    ).first()
    
    if existing_answer:
        raise HTTPException(status_code=400, detail=f"该问题的 {rag_answer_in['version']} 版本回答已存在")

    # 只提取数据库模型支持的字段
    valid_fields = ["question_id", "answer", "collection_method", "version", 
                    "first_response_time", "total_response_time", "character_count", "raw_response"
                    ,'charactersPerSecond'
                    ,'sequenceNumber' 
                    ,'characters_per_second'
                    ,'performance_test_id']
    
    rag_answer_data = {k: v for k, v in rag_answer_in.items() if k in valid_fields}
    
    # 设置默认值
    if "collection_method" not in rag_answer_data:
        rag_answer_data["collection_method"] = "manual"
    
    # 创建RAG回答
    rag_answer = RagAnswer(**rag_answer_data)
    db.add(rag_answer)
    db.commit()
    db.refresh(rag_answer)
    
    return rag_answer

@router.get("/question/{question_id}/version/{version}", response_model=RagAnswerOut)
def get_rag_answer_by_version(
    *,
    db: Session = Depends(get_db),
    question_id: str,
    version: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取指定问题的特定版本RAG回答
    """
    rag_answer = db.query(RagAnswer).filter(
        RagAnswer.question_id == question_id,
        RagAnswer.version == version
    ).first()
    
    if not rag_answer:
        raise HTTPException(status_code=404, detail="未找到指定版本的RAG回答")
    
    return rag_answer

@router.get("/question/{question_id}/versions", response_model=List[RagAnswerOut])
def get_all_rag_answer_versions(
    *,
    db: Session = Depends(get_db),
    question_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取问题的所有版本RAG回答
    """
    rag_answers = db.query(RagAnswer).filter(
        RagAnswer.question_id == question_id
    ).all()
    
    return rag_answers

@router.put("/{answer_id}", response_model=RagAnswerOut)
def update_rag_answer(
    *,
    db: Session = Depends(get_db),
    answer_id: str,
    rag_answer_in: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新RAG回答
    """
    # 获取现有回答
    rag_answer = db.query(RagAnswer).filter(RagAnswer.id == answer_id).first()
    if not rag_answer:
        raise HTTPException(status_code=404, detail="回答未找到")
    
    # 检查权限 - 修复从问题查询到数据集
    question = db.query(Question).filter(Question.id == rag_answer.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="相关问题未找到")
    
    # 问题属于数据集，不是项目，所以我们需要从数据集获取用户ID
    dataset = db.query(Dataset).filter(Dataset.id == question.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="相关数据集未找到")
    
    # 检查用户权限 (使用数据集的user_id)
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权更新此回答")
    
    # 如果版本发生变化，检查是否会与现有版本冲突
    if "version" in rag_answer_in and rag_answer_in["version"] != rag_answer.version:
        existing_version = db.query(RagAnswer).filter(
            RagAnswer.question_id == rag_answer.question_id,
            RagAnswer.version == rag_answer_in["version"],
            RagAnswer.id != answer_id
        ).first()
        
        if existing_version:
            raise HTTPException(status_code=400, detail=f"该问题的 {rag_answer_in['version']} 版本回答已存在")
    
    # 只更新模型支持的字段
    valid_fields = ["answer", "collection_method", "version", 
                   "first_response_time", "total_response_time", "character_count", "raw_response"]
    
    for key, value in rag_answer_in.items():
        if key in valid_fields:
            setattr(rag_answer, key, value)
    
    db.commit()
    db.refresh(rag_answer)
    
    return rag_answer 