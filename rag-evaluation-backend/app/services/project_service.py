from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.project import Project, EvaluationDimension
from app.schemas.project import (
    ProjectCreate, 
    ProjectUpdate, 
    DimensionCreate, 
    ProjectWithDimensions, 
    ProjectDetail
)
from app.schemas.dimension import DimensionOut

def create_project(db: Session, obj_in: ProjectCreate, user_id: str) -> Project:
    """创建新项目"""
    db_obj = Project(
        user_id=user_id,
        name=obj_in.name,
        description=obj_in.description,
        evaluation_method=obj_in.evaluation_method,
        scoring_scale=obj_in.scoring_scale,
        status=obj_in.status,
        settings=obj_in.settings
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    
    # 创建默认评测维度
    default_dimensions = [
        {"name": "accuracy", "display_name": "准确性", "description": "评估回答与标准答案的事实一致性", "weight": 1.0},
        {"name": "relevance", "display_name": "相关性", "description": "评估回答与问题的匹配度", "weight": 1.0},
        {"name": "completeness", "display_name": "完整性", "description": "评估回答的信息覆盖度", "weight": 1.0},
        {"name": "conciseness", "display_name": "简洁性", "description": "评估回答是否无冗余信息", "weight": 0.8}
    ]
    
    for dim in default_dimensions:
        dimension = EvaluationDimension(
            project_id=db_obj.id,
            name=dim["name"],
            display_name=dim["display_name"],
            description=dim["description"],
            weight=str(dim["weight"])
        )
        db.add(dimension)
    
    db.commit()
    return db_obj

def get_project(db: Session, project_id: str) -> Optional[Project]:
    """获取单个项目"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        # 手动转换 UUID 为字符串
        project.id = str(project.id)
        project.user_id = str(project.user_id)
    return project

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
) -> List[Dict[str, Any]]:
    """获取用户的所有项目"""
    query = db.query(Project).filter(Project.user_id == user_id)
    
    if status:
        query = query.filter(Project.status == status)
    
    projects = query.order_by(desc(Project.created_at)).offset(skip).limit(limit).all()
    
    # 手动转换UUID为字符串
    result = []
    for project in projects:
        project_dict = {
            "id": str(project.id),
            "user_id": str(project.user_id),
            "name": project.name,
            "description": project.description,
            "evaluation_method": project.evaluation_method,
            "scoring_scale": project.scoring_scale,
            "status": project.status,
            "settings": project.settings,
            "created_at": project.created_at,
            "updated_at": project.updated_at
        }
        result.append(project_dict)
    
    return result

def update_project(
    db: Session, 
    db_obj: Project,
    obj_in: ProjectUpdate
) -> Project:
    """更新项目"""
    update_data = obj_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_project(db: Session, project_id: str) -> Optional[Project]:
    """删除项目"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None
    
    # 删除项目关联的评测维度
    db.query(EvaluationDimension).filter(EvaluationDimension.project_id == project_id).delete()
    
    # 删除项目
    db.delete(project)
    db.commit()
    return project

def create_dimension(
    db: Session, 
    project_id: str,
    obj_in: DimensionCreate
) -> EvaluationDimension:
    """为项目创建评测维度"""
    db_obj = EvaluationDimension(
        project_id=project_id,
        name=obj_in.name,
        display_name=obj_in.display_name,
        description=obj_in.description,
        weight=str(obj_in.weight)
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_dimensions(db: Session, project_id: str) -> List[EvaluationDimension]:
    """获取项目的所有评测维度"""
    return db.query(EvaluationDimension).filter(
        EvaluationDimension.project_id == project_id
    ).all() 