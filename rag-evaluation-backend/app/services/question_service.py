from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from fastapi.encoders import jsonable_encoder

from app.models.question import Question
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionBase, QuestionImportWithRagAnswer
from app.models.rag_answer import RagAnswer

def get_question(db: Session, question_id: str) -> Optional[Question]:
    """获取单个问题"""
    return db.query(Question).filter(Question.id == question_id).first()

def get_questions_by_project(
    db: Session, 
    project_id: str, 
    skip: int = 0, 
    limit: int = 100,
    category: Optional[str] = None,
    difficulty: Optional[str] = None
) -> List[Question]:
    """获取项目中的问题列表"""
    query = db.query(Question).filter(Question.project_id == project_id)
    
    if category:
        query = query.filter(Question.category == category)
    
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    
    return query.offset(skip).limit(limit).all()

def search_questions(
    db: Session,
    project_id: str,
    query: str,
    skip: int = 0,
    limit: int = 100
) -> List[Question]:
    """搜索问题"""
    return db.query(Question).filter(
        Question.project_id == project_id,
        or_(
            Question.question_text.ilike(f"%{query}%"),
            Question.standard_answer.ilike(f"%{query}%")
        )
    ).offset(skip).limit(limit).all()

def create_question(
    db: Session, 
    obj_in: QuestionCreate
) -> Question:
    """创建问题"""
    obj_in_data = jsonable_encoder(obj_in)
    db_obj = Question(**obj_in_data)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def create_questions_batch(
    db: Session, 
    dataset_id: str, 
    questions: List[QuestionBase]
) -> List[Question]:
    """批量创建问题"""
    db_objs = []
    
    for q in questions:
        obj_in_data = jsonable_encoder(q)
        db_obj = Question(**obj_in_data, dataset_id=dataset_id)
        db.add(db_obj)
        db_objs.append(db_obj)
    
    db.commit()
    
    for obj in db_objs:
        db.refresh(obj)
        
    return db_objs

def update_question(
    db: Session, 
    db_obj: Question, 
    obj_in: QuestionUpdate
) -> Question:
    """更新问题"""
    obj_data = jsonable_encoder(db_obj)
    update_data = obj_in.dict(exclude_unset=True)
    
    for field in obj_data:
        if field in update_data:
            setattr(db_obj, field, update_data[field])
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_question(
    db: Session, 
    question_id: str
) -> bool:
    """删除问题"""
    db_obj = get_question(db, question_id)
    if not db_obj:
        return False
        
    db.delete(db_obj)
    db.commit()
    return True

def get_questions_by_dataset(
    db: Session, 
    dataset_id: str, 
    skip: int = 0, 
    limit: int = 100,
    category: Optional[str] = None,
    difficulty: Optional[str] = None
) -> List[Question]:
    """获取数据集中的所有问题"""
    query = db.query(Question).filter(Question.dataset_id == dataset_id)
    
    if category:
        query = query.filter(Question.category == category)
    
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
        
    return query.offset(skip).limit(limit).all()

def get_questions_by_project(
    db: Session, 
    project_id: str, 
    skip: int = 0, 
    limit: int = 100,
    category: Optional[str] = None,
    difficulty: Optional[str] = None
) -> List[Question]:
    """获取项目中的所有问题（通过关联数据集）"""
    from app.models.dataset import ProjectDataset
    
    # 获取项目关联的所有数据集ID
    dataset_ids = db.query(ProjectDataset.dataset_id).filter(
        ProjectDataset.project_id == project_id
    ).all()
    
    if not dataset_ids:
        return []
        
    dataset_ids = [d[0] for d in dataset_ids]
    
    # 查询这些数据集中的问题
    query = db.query(Question).filter(Question.dataset_id.in_(dataset_ids))
    
    if category:
        query = query.filter(Question.category == category)
    
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
        
    return query.offset(skip).limit(limit).all()

def import_questions_with_rag_answers(
    db: Session,
    dataset_id: str,
    questions_data: List[QuestionImportWithRagAnswer]
) -> List[Question]:
    """导入问题并同时导入RAG回答"""
    imported_questions = []
    
    for question_data in questions_data:
        # 提取RAG回答数据
        rag_answer_text = question_data.rag_answer
        question_data_dict = question_data.dict(exclude={"rag_answer"})
        
        # 创建问题
        question = Question(
            dataset_id=dataset_id,
            **question_data_dict
        )
        db.add(question)
        db.flush()  # 获取问题ID
        
        # 如果有RAG回答数据，创建RAG回答
        if rag_answer_text:
            rag_answer = RagAnswer(
                question_id=question.id,
                answer_text=rag_answer_text,
                collection_method="import",  # 设置默认值
                source_system="import",  # 设置默认值
                version="v1"  # 默认版本
            )
            db.add(rag_answer)
        
        imported_questions.append(question)
    
    db.commit()
    
    # 刷新问题对象以获取完整数据
    for question in imported_questions:
        db.refresh(question)
    
    return imported_questions 