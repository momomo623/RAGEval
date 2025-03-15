from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.question import Question
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionBase

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

def create_question(db: Session, obj_in: QuestionCreate) -> Question:
    """创建问题"""
    db_obj = Question(
        project_id=obj_in.project_id,
        question_text=obj_in.question_text,
        standard_answer=obj_in.standard_answer,
        category=obj_in.category,
        difficulty=obj_in.difficulty,
        tags=obj_in.tags,
        question_metadata=obj_in.question_metadata
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def create_questions_batch(
    db: Session, 
    project_id: str,
    questions: List[QuestionBase]
) -> List[Question]:
    """批量创建问题"""
    db_objs = []
    for q in questions:
        db_obj = Question(
            project_id=project_id,
            question_text=q.question_text,
            standard_answer=q.standard_answer,
            category=q.category,
            difficulty=q.difficulty,
            tags=q.tags,
            question_metadata=q.question_metadata
        )
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
    update_data = obj_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_question(db: Session, question_id: str) -> None:
    """删除问题"""
    db_obj = db.query(Question).filter(Question.id == question_id).first()
    db.delete(db_obj)
    db.commit() 