from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectWithDimensions
from app.services.project_service import (
    create_project, 
    get_project, 
    update_project, 
    delete_project, 
    get_projects_by_user,
    get_project_with_dimensions
)

router = APIRouter()

@router.post("", response_model=ProjectOut)
def create_project_api(
    *,
    db: Session = Depends(get_db),
    project_in: ProjectCreate,
    # current_user: User = Depends(get_test_user)
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建新项目
    """
    # print("------------------------")
    # print(current_user.id)
    # current_user.id="b109e9b0-2674-4366-9cb5-61f12182ace3"
    project = create_project(db, obj_in=project_in, user_id=current_user.id)
    return project

@router.get("", response_model=List[ProjectOut])
def read_projects(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None, description="项目状态过滤"),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取用户的所有项目
    """
    projects = get_projects_by_user(
        db, user_id=current_user.id, skip=skip, limit=limit, status=status
    )
    return projects

@router.get("/{project_id}", response_model=ProjectWithDimensions)
def read_project(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取项目详情和评测维度
    """
    project = get_project_with_dimensions(db, project_id=project_id, user_id=current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    return project

@router.put("/{project_id}", response_model=ProjectOut)
def update_project_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    project_in: ProjectUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    更新项目
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限操作此项目")
    project = update_project(db, db_obj=project, obj_in=project_in)
    return project

@router.delete("/{project_id}")
def delete_project_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    删除项目
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限删除此项目")
    project = delete_project(db, project_id=project_id)
    return {"detail": "项目已删除"} 