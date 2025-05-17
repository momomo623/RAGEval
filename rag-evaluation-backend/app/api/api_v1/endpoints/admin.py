from typing import Any, List, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_active_admin, get_db
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.question import Question
from app.schemas.dataset import DatasetOut
from app.schemas.project import ProjectOut

router = APIRouter()

@router.get("/statistics", response_model=Dict[str, Any])
def get_system_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    获取系统统计信息（仅管理员可访问）
    """
    # 用户统计
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    admin_users = db.query(func.count(User.id)).filter(User.is_admin == True).scalar()
    
    # 项目统计
    total_projects = db.query(func.count(Project.id)).scalar()
    
    # 数据集统计
    total_datasets = db.query(func.count(Dataset.id)).scalar()
    public_datasets = db.query(func.count(Dataset.id)).filter(Dataset.is_public == True).scalar()
    
    # 问题统计
    total_questions = db.query(func.count(Question.id)).scalar()
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admin": admin_users
        },
        "projects": {
            "total": total_projects
        },
        "datasets": {
            "total": total_datasets,
            "public": public_datasets
        },
        "questions": {
            "total": total_questions
        }
    }
