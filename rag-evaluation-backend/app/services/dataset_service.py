from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
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
    search: Optional[str] = None,
    include_public: bool = True,
    only_public: bool = False,
    only_private: bool = False,
    only_mine: bool = False,
    tags: Optional[List[str]] = None
) -> List[Dataset]:
    """
    获取用户的数据集，支持多种筛选条件
    
    参数:
        db: 数据库会话
        user_id: 用户ID
        skip: 分页偏移
        limit: 分页大小限制
        search: 搜索关键词，用于名称和描述的模糊搜索
        include_public: 是否包含其他用户的公开数据集
        only_public: 是否只返回公开数据集
        only_private: 是否只返回私有数据集
        only_mine: 是否只返回当前用户的数据集
        tags: 标签列表，用于筛选
    """
    # 基础查询
    query = db.query(Dataset)
    
    # 用户和公开状态筛选
    if only_public:
        # 只返回公开数据集
        query = query.filter(Dataset.is_public == True)
    elif only_private:
        # 只返回用户自己的私有数据集
        query = query.filter(
            Dataset.user_id == user_id,
            Dataset.is_public == False
        )
    elif only_mine:
        # 只返回用户自己的所有数据集
        query = query.filter(Dataset.user_id == user_id)
    elif include_public:
        # 返回用户自己的数据集和其他用户的公开数据集
        query = query.filter(
            or_(
                Dataset.user_id == user_id,
                Dataset.is_public == True
            )
        )
    else:
        # 只返回用户自己的数据集
        query = query.filter(Dataset.user_id == user_id)
    
    # 标签筛选
    if tags:
        for tag in tags:
            query = query.filter(Dataset.tags.contains([tag]))
    
    # 关键词搜索
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Dataset.name.ilike(search_term),
                Dataset.description.ilike(search_term)
            )
        )
    
    # 先展示用户自己的数据集，再展示其他公开数据集
    query = query.order_by(Dataset.user_id == user_id, desc(Dataset.created_at))
    
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

def copy_dataset(db: Session, source_dataset_id: str, user_id: str, new_name: Optional[str] = None) -> Optional[Dataset]:
    """复制公开数据集为用户的私人数据集"""
    # 获取源数据集
    source_dataset = get_dataset(db, dataset_id=source_dataset_id)
    if not source_dataset:
        return None
        
    # 检查源数据集是否公开
    if not source_dataset.is_public and str(source_dataset.user_id) != user_id:
        return None
    
    # 创建新数据集数据
    new_dataset_data = {
        "user_id": user_id,
        "name": new_name or f"{source_dataset.name} (复制)",
        "description": source_dataset.description,
        "is_public": False,  # 默认为私有
        "tags": source_dataset.tags,
        "dataset_metadata": source_dataset.dataset_metadata
    }
    
    # 创建新数据集
    new_dataset = Dataset(**new_dataset_data)
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    
    # 复制所有问题
    questions = db.query(Question).filter(
        Question.dataset_id == source_dataset_id
    ).all()
    
    for question in questions:
        new_question = Question(
            dataset_id=new_dataset.id,
            question_text=question.question_text,
            standard_answer=question.standard_answer,
            category=question.category,
            difficulty=question.difficulty,
            type=question.type,
            tags=question.tags,
            question_metadata=question.question_metadata
        )
        db.add(new_question)
    
    db.commit()
    
    return new_dataset 