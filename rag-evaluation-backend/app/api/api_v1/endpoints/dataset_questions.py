from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.api.deps import get_current_user, get_db
from app.models.rag_answer import RagAnswer
from app.models.user import User
from app.models.dataset import Dataset
from app.models.question import Question
from app.schemas.question import (
    QuestionCreate, 
    QuestionUpdate, 
    QuestionOut,
    BatchDeleteRequest
)
from app.schemas.common import PaginatedResponse

router = APIRouter()

@router.get("/{dataset_id}/questions", response_model=PaginatedResponse[QuestionOut])
def read_questions(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    page: int = Query(1, gt=0),
    size: int = Query(10, gt=0, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Any:
    print("--------------------------------")    
    """
    获取数据集的问题列表
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查访问权限
    if not dataset.is_public and str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权访问此数据集")
    
    skip = (page - 1) * size
    
    # 构建查询
    query = db.query(Question).filter(Question.dataset_id == dataset_id)
    
    # 应用搜索过滤
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Question.question_text.ilike(search_term),
                Question.standard_answer.ilike(search_term)
            )
        )
    
    # 应用分类和难度过滤
    if category:
        query = query.filter(Question.category == category)
    
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    
    # 计算总数
    total = query.count()
    
    # 获取分页数据
    questions = query.offset(skip).limit(size).all()
    
    # 格式化返回数据
    result = []
    for question in questions:
        question_dict = {
            "id": str(question.id),
            "dataset_id": str(question.dataset_id),
            "question_text": question.question_text,
            "standard_answer": question.standard_answer,
            "category": question.category,
            "difficulty": question.difficulty,
            "type": question.type,
            "tags": question.tags,
            "question_metadata": question.question_metadata,
            "created_at": question.created_at,
            "updated_at": question.updated_at
        }
        result.append(question_dict)
    
    # 计算总页数
    pages = (total + size - 1) // size if total > 0 else 1

    print(f"result: {result}")
    
    # 返回符合前端期望的分页格式
    return {
        "items": result,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

@router.post("/{dataset_id}/questions", response_model=QuestionOut)
def create_question(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    question_in: dict = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建问题
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查操作权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此数据集")
    
    # 处理标签格式
    tags = question_in.get("tags", {})
    # 如果是列表格式，转换为字典格式 {tag: True}
    if isinstance(tags, list):
        tags = {tag: True for tag in tags}
    
    # 创建问题
    question = Question(
        dataset_id=dataset_id,
        question_text=question_in["question_text"],
        standard_answer=question_in["standard_answer"],
        category=question_in.get("category"),
        difficulty=question_in.get("difficulty"),
        type=question_in.get("type", "text"),
        tags=tags,  # 使用处理后的标签
        question_metadata=question_in.get("question_metadata", {})
    )
    
    db.add(question)
    db.commit()
    db.refresh(question)
    
    # 确保返回的标签格式符合期望
    question_dict = {
        "id": str(question.id),
        "dataset_id": str(question.dataset_id),
        "question_text": question.question_text,
        "standard_answer": question.standard_answer,
        "category": question.category,
        "difficulty": question.difficulty,
        "type": question.type,
        "tags": question.tags,  # 这里可能需要进一步处理
        "question_metadata": question.question_metadata,
        "created_at": question.created_at,
        "updated_at": question.updated_at
    }
    
    return question_dict

@router.put("/{dataset_id}/questions/{question_id}", response_model=QuestionOut)
def update_question(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    question_id: str,
    question_in: QuestionUpdate = Body(...),  # 同样修改为使用dict
    current_user: User = Depends(get_current_user)
) -> Any:
    print("==============")

    print(question_in.dict(exclude_unset=True))

    """
    更新问题
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查操作权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此数据集")
    
    # 获取问题
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.dataset_id == dataset_id
    ).first()
    
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 更新问题
    update_data = question_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)
    
    db.add(question)
    db.commit()
    db.refresh(question)
    
    return {
        "id": str(question.id),
        "dataset_id": str(question.dataset_id),
        "question_text": question.question_text,
        "standard_answer": question.standard_answer,
        "category": question.category,
        "difficulty": question.difficulty,
        "type": question.type,
        "tags": question.tags,
        "question_metadata": question.question_metadata,
        "created_at": question.created_at,
        "updated_at": question.updated_at
    }

@router.delete("/{dataset_id}/questions/{question_id}", response_model=dict)
def delete_question(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    question_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除问题
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查操作权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此数据集")
    
    # 获取问题
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.dataset_id == dataset_id
    ).first()
    
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    # 删除问题
    db.delete(question)
    db.commit()
    
    return {"detail": "问题已删除"}

@router.post("/{dataset_id}/questions/batch-delete", response_model=dict)
def batch_delete_questions(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    delete_data: BatchDeleteRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    批量删除问题
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查操作权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此数据集")
    
    # 批量删除
    questions = db.query(Question).filter(
        Question.id.in_(delete_data.question_ids),
        Question.dataset_id == dataset_id
    ).all()
    
    if not questions:
        raise HTTPException(status_code=404, detail="未找到要删除的问题")
    
    for question in questions:
        db.delete(question)
    
    db.commit()
    
    return {"detail": f"已删除 {len(questions)} 个问题"}

@router.post("/{dataset_id}/questions/with-rag", response_model=QuestionOut)
def create_question_with_rag(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    question_data: dict = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建问题并同时创建RAG回答
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此数据集")
    
    # 提取RAG回答数据
    rag_answer_data = question_data.pop('rag_answer', None)
    
    # 创建问题
    question = Question(
        dataset_id=dataset_id,
        question_text=question_data["question_text"],
        standard_answer=question_data["standard_answer"],
        category=question_data.get("category"),
        difficulty=question_data.get("difficulty"),
        type=question_data.get("type", "text"),
        tags=question_data.get("tags", {}),
        question_metadata=question_data.get("question_metadata", {})
    )
    
    db.add(question)
    db.flush()
    
    # 如果有RAG回答数据，创建RAG回答
    if rag_answer_data:
        # 将answer_text转换为answer以匹配数据库字段
        answer_text = rag_answer_data.pop("answer_text", None)
        
        rag_answer = RagAnswer(
            question_id=question.id,
            answer=answer_text,  # 使用正确的字段名
            collection_method=rag_answer_data.get("collection_method", "manual"),
            version=rag_answer_data.get("version", "v1")
        )
        db.add(rag_answer)
    
    db.commit()
    db.refresh(question)
    
    return question

# 批量创建问题
@router.post("/{dataset_id}/questions/batch", response_model=dict)
def batch_create_questions(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    data: dict = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    批量创建问题
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此数据集")
    
    questions_data = data.get("questions", [])
    
    # 检查上传限制
    MAX_BATCH_SIZE = 500  # 设置批量上限
    if len(questions_data) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"批量添加数量超过限制（最大{MAX_BATCH_SIZE}条）"
        )
    
    # 批量创建问题
    created_questions = []
    for q_data in questions_data:
        try:
            # 处理标签格式
            tags = q_data.get("tags", {})
            if isinstance(tags, list):
                tags = {tag: True for tag in tags}
            
            # 确保q_data至少包含最基本的字段，并添加默认值
            if "tags" not in q_data:
                q_data["tags"] = {}
            if "question_metadata" not in q_data:
                q_data["question_metadata"] = {}
            if "type" not in q_data:
                q_data["type"] = "text"
            
            # 直接创建问题对象并添加到数据库
            question = Question(
                dataset_id=dataset_id,
                question_text=q_data["question_text"],
                standard_answer=q_data["standard_answer"],
                category=q_data.get("category"),
                difficulty=q_data.get("difficulty"),
                type=q_data.get("type", "text"),
                tags=tags,  # 使用处理后的标签
                question_metadata=q_data.get("question_metadata", {})
            )
            
            db.add(question)
            db.flush()  # 获取ID但不提交事务
            created_questions.append(question)
        except Exception as e:
            # 记录错误但继续处理其他问题
            print(f"Error creating question: {str(e)}")
    
    # 最后一次性提交所有更改
    db.commit()
    
    # 刷新所有对象
    for question in created_questions:
        db.refresh(question)
    
    return {
        "success": True,
        "imported_count": len(created_questions),
        "total_count": len(questions_data)
    }

# 批量创建带RAG回答的问题
@router.post("/{dataset_id}/questions/batch-with-rag", response_model=dict)
def batch_create_questions_with_rag(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    data: dict = Body(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    批量创建带RAG回答的问题
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此数据集")
    
    questions_data = data.get("questions", [])
    
    # 检查上传限制
    MAX_BATCH_SIZE = 200  # 带RAG回答的批量限制可以小一些
    if len(questions_data) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"批量添加数量超过限制（最大{MAX_BATCH_SIZE}条）"
        )
    
    # 批量创建问题和RAG回答
    try:
        created_questions = []
        for q_data in questions_data:
            try:
                # 提取RAG回答数据
                rag_answer_data = q_data.pop('rag_answer', None)
                
                # 处理标签格式
                tags = q_data.get("tags", {})
                if isinstance(tags, list):
                    tags = {tag: True for tag in tags}
                
                # 确保数据完整性
                if "tags" not in q_data:
                    q_data["tags"] = {}
                if "question_metadata" not in q_data:
                    q_data["question_metadata"] = {}
                if "type" not in q_data:
                    q_data["type"] = "text"
                
                # 直接创建问题对象
                question = Question(
                    dataset_id=dataset_id,
                    question_text=q_data["question_text"],
                    standard_answer=q_data["standard_answer"],
                    category=q_data.get("category"),
                    difficulty=q_data.get("difficulty"),
                    type=q_data.get("type", "text"),
                    tags=tags,  # 使用处理后的标签
                    question_metadata=q_data.get("question_metadata", {})
                )
                
                db.add(question)
                db.flush()  # 获取问题ID但不提交事务
                
                # 如果有RAG回答数据，创建RAG回答
                if rag_answer_data:
                    # 确保RAG回答数据完整
                    if "collection_method" not in rag_answer_data:
                        rag_answer_data["collection_method"] = "import"
                    
                    # 将 answer_text 转换为 answer 以匹配数据库字段
                    answer_text = rag_answer_data.pop("answer_text", None)
                    
                    rag_answer = RagAnswer(
                        question_id=question.id,
                        answer=answer_text,  # 使用正确的字段名
                        collection_method=rag_answer_data.get("collection_method"),
                        version=rag_answer_data.get("version", "v1")
                    )
                    db.add(rag_answer)
                
                created_questions.append(question)
            except Exception as e:
                # 记录错误但继续处理其他问题
                print(f"Error creating question with RAG: {str(e)}")
        
        # 一次性提交所有更改
        db.commit()
        
        # 刷新所有对象
        for question in created_questions:
            db.refresh(question)
        
        return {
            "success": True,
            "imported_count": len(created_questions),
            "total_count": len(questions_data)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"批量创建失败: {str(e)}") 