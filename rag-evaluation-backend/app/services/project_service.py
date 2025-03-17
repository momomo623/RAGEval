from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi.encoders import jsonable_encoder

from app.models.project import Project
from app.schemas.project import (
    ProjectCreate, 
    ProjectUpdate, 
    ProjectWithDimensions, 
    ProjectDetail
)

def create_project(db: Session, obj_in: ProjectCreate, user_id: str) -> Project:
    """创建项目"""
    obj_in_data = jsonable_encoder(obj_in)
    
    # 如果没有提供评测维度，使用默认值
    if not obj_in_data.get("evaluation_dimensions"):
        obj_in_data["evaluation_dimensions"] = [
            {"name": "accuracy", "weight": 1.0, "description": "评估回答的事实准确性", "enabled": True},
            {"name": "relevance", "weight": 1.0, "description": "评估回答与问题的相关程度", "enabled": True},
            {"name": "completeness", "weight": 1.0, "description": "评估回答信息的完整性", "enabled": True},
            {"name": "conciseness", "weight": 1.0, "description": "评估回答是否简洁无冗余", "enabled": False}
        ]
    
    db_obj = Project(**obj_in_data, user_id=user_id)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_project(db: Session, project_id: str) -> Optional[Project]:
    """通过ID获取项目"""
    return db.query(Project).filter(Project.id == project_id).first()

def get_project_with_dimensions(db: Session, project_id: str, user_id: str) -> Optional[ProjectDetail]:
    """获取项目详情，包括评测维度"""
    project = get_project(db, project_id)
    if not project:
        return None
        
    # 检查权限
    if str(project.user_id) != user_id:
        # 检查管理员权限
        from app.models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        if not (user and user.is_admin):
            return None
    
    # 获取项目关联的维度
    from app.models.project import EvaluationDimension
    dimensions = db.query(EvaluationDimension).filter(EvaluationDimension.project_id == project_id).all()
    
    # 添加调试打印
    print(f"获取到维度数量: {len(dimensions)}")
    if dimensions:
        print(f"维度对象属性: {dir(dimensions[0])}")
    
    # 转换为响应模型
    from app.schemas.project import ProjectDetail
    
    # 创建一个基础的项目详情对象
    result = ProjectDetail(
        id=str(project.id),
        user_id=str(project.user_id),
        name=project.name,
        description=project.description,
        evaluation_method=project.evaluation_method,
        scoring_scale=project.scoring_scale,
        status=project.status,
        settings=project.settings,
        created_at=project.created_at,
        updated_at=project.updated_at,
        dimensions=[]
    )
    
    # 添加维度信息，手动转换UUID为字符串
    for dimension in dimensions:
        dim_dict = {
            "id": str(dimension.id),
            "project_id": str(dimension.project_id),
            "name": dimension.name,
            "description": dimension.description,
            "weight": dimension.weight,
            "created_at": dimension.created_at,
            # EvaluationDimension 没有 updated_at 属性，使用 created_at 代替
            "updated_at": dimension.created_at  # 或者完全移除这一行
        }
        result.dimensions.append(dim_dict)
    
    return result

def get_projects_by_user(
    db: Session, 
    user_id: str, 
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = None
) -> List[Project]:
    """获取用户的所有项目"""
    query = db.query(Project).filter(Project.user_id == user_id)
    
    if status:
        query = query.filter(Project.status == status)
            
    return query.offset(skip).limit(limit).all()

def update_project(
    db: Session, 
    project_id: str, 
    obj_in: ProjectUpdate
) -> Optional[Project]:
    """更新项目"""
    db_obj = get_project(db, project_id)
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

def delete_project(db: Session, project_id: str) -> bool:
    """删除项目"""
    db_obj = get_project(db, project_id)
    if not db_obj:
        return False
        
    db.delete(db_obj)
    db.commit()
    return True

def update_project_status(db: Session, project_id: str, status: str) -> Optional[Project]:
    """更新项目状态"""
    db_obj = get_project(db, project_id)
    if not db_obj:
        return None
        
    db_obj.status = status
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_project_dimensions(
    db: Session, 
    project_id: str, 
    dimensions: List[Dict[str, Any]]
) -> Optional[Project]:
    """更新项目评测维度"""
    db_obj = get_project(db, project_id)
    if not db_obj:
        return None
        
    db_obj.evaluation_dimensions = dimensions
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj 