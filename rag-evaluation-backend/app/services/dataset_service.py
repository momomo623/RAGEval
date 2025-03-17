from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi.encoders import jsonable_encoder

from app.models.dataset import Dataset, ProjectDataset
from app.models.question import Question
from app.schemas.dataset import DatasetCreate, DatasetUpdate

def create_dataset(db: Session, obj_in: DatasetCreate, user_id: str) -> Dataset:
    """创建数据集"""
    obj_in_data = jsonable_encoder(obj_in)
    db_obj = Dataset(**obj_in_data, user_id=user_id)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_dataset(db: Session, dataset_id: str) -> Optional[Dataset]:
    """通过ID获取数据集"""
    return db.query(Dataset).filter(Dataset.id == dataset_id).first()

def get_datasets_by_user(
    db: Session, 
    user_id: str, 
    skip: int = 0, 
    limit: int = 100,
    tags: Optional[List[str]] = None,
    is_public: Optional[bool] = None
) -> List[Dataset]:
    """获取用户的所有数据集"""
    query = db.query(Dataset).filter(Dataset.user_id == user_id)
    
    if is_public is not None:
        query = query.filter(Dataset.is_public == is_public)
        
    if tags:
        for tag in tags:
            query = query.filter(Dataset.tags.contains([tag]))
            
    return query.offset(skip).limit(limit).all()

def get_public_datasets(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    tags: Optional[List[str]] = None
) -> List[Dataset]:
    """获取公开数据集"""
    query = db.query(Dataset).filter(Dataset.is_public == True)
    
    if tags:
        for tag in tags:
            query = query.filter(Dataset.tags.contains([tag]))
            
    return query.offset(skip).limit(limit).all()

def update_dataset(
    db: Session, 
    dataset_id: str, 
    obj_in: DatasetUpdate
) -> Optional[Dataset]:
    """更新数据集"""
    db_obj = get_dataset(db, dataset_id)
    if not db_obj:
        return None
        
    obj_data = jsonable_encoder(db_obj)
    update_data = obj_in.dict(exclude_unset=True)
    
    for field in obj_data:
        if field in update_data:
            setattr(db_obj, field, update_data[field])
            
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_dataset(db: Session, dataset_id: str) -> bool:
    """删除数据集"""
    db_obj = get_dataset(db, dataset_id)
    if not db_obj:
        return False
        
    db.delete(db_obj)
    db.commit()
    return True

def get_dataset_with_stats(db: Session, dataset_id: str) -> Dict[str, Any]:
    """获取数据集详情及统计信息"""
    dataset = get_dataset(db, dataset_id)
    if not dataset:
        return None
        
    # 统计问题数量
    question_count = db.query(func.count(Question.id)).filter(
        Question.dataset_id == dataset_id
    ).scalar()
    
    # 获取使用此数据集的项目
    projects = db.query(ProjectDataset).filter(
        ProjectDataset.dataset_id == dataset_id
    ).all()
    
    project_info = []
    for p in projects:
        from app.models.project import Project
        project = db.query(Project).filter(Project.id == p.project_id).first()
        if project:
            project_info.append({
                "id": str(project.id),
                "name": project.name
            })
    
    result = {
        "dataset": dataset,
        "question_count": question_count,
        "projects": project_info
    }
    
    return result

def link_dataset_to_project(
    db: Session, 
    project_id: str, 
    dataset_id: str
) -> Optional[ProjectDataset]:
    """关联数据集到项目"""
    # 检查关联是否已存在
    existing = db.query(ProjectDataset).filter(
        ProjectDataset.project_id == project_id,
        ProjectDataset.dataset_id == dataset_id
    ).first()
    
    if existing:
        return existing
        
    # 创建新关联
    db_obj = ProjectDataset(
        project_id=project_id,
        dataset_id=dataset_id
    )
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def unlink_dataset_from_project(
    db: Session, 
    project_id: str, 
    dataset_id: str
) -> bool:
    """从项目中移除数据集关联"""
    db_obj = db.query(ProjectDataset).filter(
        ProjectDataset.project_id == project_id,
        ProjectDataset.dataset_id == dataset_id
    ).first()
    
    if not db_obj:
        return False
        
    db.delete(db_obj)
    db.commit()
    return True

def get_datasets_by_project(
    db: Session, 
    project_id: str
) -> List[Dataset]:
    """获取项目关联的所有数据集"""
    dataset_ids = db.query(ProjectDataset.dataset_id).filter(
        ProjectDataset.project_id == project_id
    ).all()
    
    if not dataset_ids:
        return []
        
    dataset_ids = [d[0] for d in dataset_ids]
    
    datasets = db.query(Dataset).filter(
        Dataset.id.in_(dataset_ids)
    ).all()
    
    return datasets

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